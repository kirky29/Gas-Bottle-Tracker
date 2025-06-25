// Gas Bottle Tracker App with Firebase Sync and Local Storage Fallback
let db = null;
let firebaseLoaded = false;

// Try to import Firebase modules with error handling
async function initFirebaseModules() {
    try {
        const firebaseConfig = await import('./firebase-config.js');
        db = firebaseConfig.db;
        firebaseLoaded = true;
        console.log('Firebase loaded successfully');
        return firebaseConfig;
    } catch (error) {
        console.warn('Firebase failed to load, using local storage:', error);
        firebaseLoaded = false;
        return null;
    }
}

class GasBottleTracker {
    constructor() {
        this.connections = [];
        this.settings = {
            bottleWeight: 47,
            bottlePrice: 83.50
        };
        this.syncStatus = 'connecting';
        this.userId = this.generateUserId();
        this.unsubscribe = null;
        this.firebase = null;
        
        this.init();
    }

    async init() {
        // Always load from local storage first
        this.loadData();
        
        // Try to initialize Firebase
        try {
            this.firebase = await initFirebaseModules();
            if (this.firebase && firebaseLoaded) {
                await this.initFirebase();
            }
        } catch (error) {
            console.warn('Firebase initialization failed, continuing with local storage:', error);
            this.updateSyncStatus('error');
        }
        
        // Always continue with app initialization regardless of Firebase status
        this.setupEventListeners();
        this.setDefaultDate();
        this.updateDisplay();
        
        // If Firebase didn't load, update status to show local storage
        if (!firebaseLoaded) {
            this.updateSyncStatus('local');
        }
    }

    async initFirebase() {
        try {
            await this.performFirebaseInit();
            this.updateSyncStatus('connected');
        } catch (error) {
            console.error('Firebase initialization error:', error);
            this.updateSyncStatus('error');
        }
    }

    async performFirebaseInit() {
        if (!this.firebase || !firebaseLoaded) {
            throw new Error('Firebase not available');
        }

        const { collection, doc, onSnapshot, query, orderBy, getDocs } = this.firebase;

        try {
            this.logDebug('Loading data from Firebase...', 'info');
            
            // Load user settings
            const userDocRef = doc(db, 'users', this.userId);
            const userDocSnap = await this.firebase.getDoc(userDocRef);
            
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                if (userData.settings) {
                    this.settings = { ...this.settings, ...userData.settings };
                    this.logDebug('Settings loaded from Firebase', 'success');
                }
            }

            // Load connections from subcollection
            const connectionsRef = collection(db, 'users', this.userId, 'connections');
            const q = query(connectionsRef, orderBy('date', 'desc'));
            const connectionsSnapshot = await getDocs(q);
            
            this.connections = [];
            connectionsSnapshot.forEach((doc) => {
                const data = doc.data();
                this.connections.push({
                    id: parseInt(doc.id), // Convert back to number
                    date: data.date,
                    cost: data.cost,
                    timestamp: data.timestamp
                });
            });
            
            this.logDebug(`Loaded ${this.connections.length} connections from Firebase`, 'success');
            this.updateDisplay();

            // Set up real-time listener for connections
            this.unsubscribe = onSnapshot(q, (snapshot) => {
                const connections = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    connections.push({
                        id: parseInt(doc.id),
                        date: data.date,
                        cost: data.cost,
                        timestamp: data.timestamp
                    });
                });
                
                // Only update if the data has actually changed
                if (JSON.stringify(connections) !== JSON.stringify(this.connections)) {
                    this.connections = connections;
                    this.updateDisplay();
                    this.logDebug('Real-time update received from Firebase', 'info');
                }
            }, (error) => {
                console.error('Real-time listener error:', error);
                this.logDebug(`Real-time sync error: ${error.message}`, 'error');
                this.updateSyncStatus('error');
            });

            // If no data exists, save current local data
            if (this.connections.length === 0 && !userDocSnap.exists()) {
                await this.saveDataToFirebase();
                this.logDebug('Initial data saved to Firebase', 'info');
            }

        } catch (error) {
            console.error('Firebase data operation error:', error);
            this.logDebug(`Firebase error: ${error.message}`, 'error');
            throw error;
        }
    }

    setupEventListeners() {
        // Settings update
        document.getElementById('updateSettings').addEventListener('click', () => {
            this.updateSettings();
        });

        // Add new connection
        document.getElementById('connectionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addConnection();
        });

        // Clear history
        document.getElementById('clearHistory').addEventListener('click', () => {
            this.clearHistory();
        });

        // Report functionality
        document.getElementById('generateReport').addEventListener('click', () => {
            this.generateReport();
        });

        document.getElementById('exportReport').addEventListener('click', () => {
            this.exportReport();
        });

        // Debug console controls
        const clearDebugBtn = document.getElementById('clearDebug');
        const testFirebaseBtn = document.getElementById('testFirebase');
        const manualSyncBtn = document.getElementById('manualSync');

        if (clearDebugBtn) {
            clearDebugBtn.addEventListener('click', () => {
                this.clearDebugConsole();
            });
        }

        if (testFirebaseBtn) {
            testFirebaseBtn.addEventListener('click', () => {
                this.testFirebaseConnection();
            });
        }

        if (manualSyncBtn) {
            manualSyncBtn.addEventListener('click', () => {
                this.manualSync();
            });
        }

        // Set default report dates
        this.setDefaultReportDates();

        // Settings modal controls
        document.getElementById('editSettings').addEventListener('click', () => {
            this.showSettingsModal();
        });

        document.getElementById('closeSettings').addEventListener('click', () => {
            this.hideSettingsModal();
        });

        // Close modal when clicking backdrop
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop')) {
                this.hideSettingsModal();
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('settingsModal').classList.contains('show')) {
                this.hideSettingsModal();
            }
        });
    }

    updateSyncStatus(status) {
        this.syncStatus = status;
        // Sync status indicator removed from UI
        // Status is now only logged to debug console
    }

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('connectionDate').value = today;
    }

    setDefaultReportDates() {
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        const startDateEl = document.getElementById('reportStartDate');
        const endDateEl = document.getElementById('reportEndDate');
        
        if (startDateEl) startDateEl.value = thirtyDaysAgo.toISOString().split('T')[0];
        if (endDateEl) endDateEl.value = today.toISOString().split('T')[0];
    }

    showSettingsModal() {
        const modal = document.getElementById('settingsModal');
        modal.classList.add('show');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    hideSettingsModal() {
        const modal = document.getElementById('settingsModal');
        modal.classList.remove('show');
        document.body.style.overflow = ''; // Restore scrolling
    }

    updateSettingsPreview() {
        document.getElementById('previewWeight').textContent = `${this.settings.bottleWeight} KG`;
        document.getElementById('previewPrice').textContent = `£${this.settings.bottlePrice.toFixed(2)}`;
    }

    async updateSettings() {
        const bottleWeight = parseFloat(document.getElementById('bottleWeight').value);
        const bottlePrice = parseFloat(document.getElementById('bottlePrice').value);

        if (bottleWeight <= 0 || bottlePrice < 0) {
            this.showMessage('Please enter valid settings values.', 'error');
            return;
        }

        this.settings.bottleWeight = bottleWeight;
        this.settings.bottlePrice = bottlePrice;
        
        // Save to local storage immediately
        this.saveData();
        
        // Save settings to Firebase
        if (firebaseLoaded && this.firebase) {
            try {
                const { doc, setDoc } = this.firebase;
                const userDocRef = doc(db, 'users', this.userId);
                await setDoc(userDocRef, {
                    settings: this.settings,
                    lastUpdated: new Date().toISOString(),
                    totalConnections: this.connections.length
                });
                
                this.logDebug('Settings saved to Firebase', 'success');
                this.updateSyncStatus('connected');
            } catch (error) {
                console.error('Firebase settings save error:', error);
                this.logDebug(`Firebase settings save error: ${error.message}`, 'error');
                this.updateSyncStatus('error');
            }
        } else {
            this.logDebug('Firebase not available, settings saved locally only', 'warning');
        }
        
        this.showMessage('Settings updated successfully!', 'success');
        this.updateDisplay();
        this.updateSettingsPreview();
        this.hideSettingsModal();
    }

    addConnection() {
        const date = document.getElementById('connectionDate').value;

        if (!date) {
            this.showMessage('Please select a connection date.', 'error');
            return;
        }

        const connection = {
            id: Date.now(),
            date: date,
            cost: this.settings.bottlePrice, // Use current bottle price
            timestamp: new Date().toISOString()
        };

        this.connections.push(connection);
        this.connections.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Save to local storage immediately
        this.saveData();
        
        // Save to Firebase
        if (firebaseLoaded) {
            this.saveConnectionToFirebase(connection);
        } else {
            this.logDebug('Firebase not available, connection saved locally only', 'warning');
        }
        
        this.resetForm();
        this.showMessage('Bottle added successfully!', 'success');
        this.updateDisplay();
    }

    async clearHistory() {
        if (confirm('Are you sure you want to clear all connection history? This action cannot be undone.')) {
            const connectionsToDelete = [...this.connections]; // Copy for Firebase deletion
            this.connections = [];
            
            // Save to local storage immediately
            this.saveData();
            
            // Clear from Firebase
            if (firebaseLoaded && this.firebase) {
                try {
                    const { doc, deleteDoc, setDoc } = this.firebase;
                    
                    // Delete all connection documents
                    for (const connection of connectionsToDelete) {
                        const connectionDocRef = doc(db, 'users', this.userId, 'connections', connection.id.toString());
                        await deleteDoc(connectionDocRef);
                    }
                    
                    // Update user summary
                    const userDocRef = doc(db, 'users', this.userId);
                    await setDoc(userDocRef, {
                        settings: this.settings,
                        lastUpdated: new Date().toISOString(),
                        totalConnections: 0
                    });
                    
                    this.logDebug('All connections cleared from Firebase', 'success');
                } catch (error) {
                    console.error('Firebase clear error:', error);
                    this.logDebug(`Firebase clear error: ${error.message}`, 'error');
                }
            } else {
                this.logDebug('Firebase not available, history cleared locally only', 'warning');
            }
            
            this.showMessage('History cleared successfully!', 'success');
            this.updateDisplay();
        }
    }

    resetForm() {
        document.getElementById('connectionForm').reset();
        this.setDefaultDate();
    }

    calculateStats() {
        const totalConnections = this.connections.length;
        const totalSpent = this.connections.reduce((sum, conn) => sum + conn.cost, 0);
        const avgCost = totalConnections > 0 ? totalSpent / totalConnections : 0;
        const totalGas = totalConnections * this.settings.bottleWeight;
        
        // Calculate enhanced stats
        const costPerDay = this.calculateCostPerDay();
        const recentCostPerDay = this.calculateRecentCostPerDay();
        const overallCostPerDay = this.calculateOverallCostPerDay();
        const recentDaysBetween = this.calculateRecentDaysBetween();
        const projectedMonthly = recentCostPerDay > 0 ? recentCostPerDay * 30 : 0;

        return {
            totalConnections,
            totalSpent,
            avgCost,
            totalGas,
            costPerDay,
            recentCostPerDay,
            overallCostPerDay,
            recentDaysBetween,
            projectedMonthly
        };
    }

    calculateCostPerDay() {
        if (this.connections.length < 2) {
            return {
                dailyRate: 0,
                daysBetween: 0,
                totalDays: 0,
                averageDailyCost: 0
            };
        }

        // Sort connections by date (oldest first for calculations)
        const sortedConnections = [...this.connections].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const firstDate = new Date(sortedConnections[0].date);
        const lastDate = new Date(sortedConnections[sortedConnections.length - 1].date);
        
        // Calculate total days between first and last connection
        const totalDays = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24));
        
        // Calculate total cost
        const totalCost = sortedConnections.reduce((sum, conn) => sum + conn.cost, 0);
        
        // Calculate average daily cost over the entire period
        const averageDailyCost = totalDays > 0 ? totalCost / totalDays : 0;

        // Calculate average days between connections
        let totalDaysBetween = 0;
        for (let i = 1; i < sortedConnections.length; i++) {
            const prevDate = new Date(sortedConnections[i - 1].date);
            const currDate = new Date(sortedConnections[i].date);
            const daysBetween = Math.ceil((currDate - prevDate) / (1000 * 60 * 60 * 24));
            totalDaysBetween += daysBetween;
        }
        const avgDaysBetween = sortedConnections.length > 1 ? totalDaysBetween / (sortedConnections.length - 1) : 0;

        // Calculate cost per day based on average days between bottles
        const costPerDay = avgDaysBetween > 0 ? this.settings.bottlePrice / avgDaysBetween : 0;

        return {
            dailyRate: costPerDay,
            daysBetween: avgDaysBetween,
            totalDays: totalDays,
            averageDailyCost: averageDailyCost
        };
    }

    calculateRecentCostPerDay() {
        if (this.connections.length < 2) {
            return 0;
        }

        // Get the two most recent connections
        const sortedConnections = [...this.connections].sort((a, b) => new Date(b.date) - new Date(a.date));
        const mostRecent = sortedConnections[0];
        const secondMostRecent = sortedConnections[1];

        const mostRecentDate = new Date(mostRecent.date);
        const secondMostRecentDate = new Date(secondMostRecent.date);
        
        const daysBetween = Math.ceil((mostRecentDate - secondMostRecentDate) / (1000 * 60 * 60 * 24));
        
        if (daysBetween <= 0) {
            return 0;
        }

        return this.settings.bottlePrice / daysBetween;
    }

    calculateOverallCostPerDay() {
        if (this.connections.length < 2) {
            return 0;
        }

        const sortedConnections = [...this.connections].sort((a, b) => new Date(a.date) - new Date(b.date));
        const firstDate = new Date(sortedConnections[0].date);
        const lastDate = new Date(sortedConnections[sortedConnections.length - 1].date);
        
        const totalDays = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24));
        
        if (totalDays <= 0) {
            return 0;
        }

        const totalCost = sortedConnections.reduce((sum, conn) => sum + conn.cost, 0);
        return totalCost / totalDays;
    }

    calculateRecentDaysBetween() {
        if (this.connections.length < 2) {
            return 0;
        }

        const sortedConnections = [...this.connections].sort((a, b) => new Date(b.date) - new Date(a.date));
        const mostRecent = sortedConnections[0];
        const secondMostRecent = sortedConnections[1];

        const mostRecentDate = new Date(mostRecent.date);
        const secondMostRecentDate = new Date(secondMostRecent.date);
        
        return Math.ceil((mostRecentDate - secondMostRecentDate) / (1000 * 60 * 60 * 24));
    }

    updateDisplay() {
        // Update settings inputs
        document.getElementById('bottleWeight').value = this.settings.bottleWeight;
        document.getElementById('bottlePrice').value = this.settings.bottlePrice;

        // Calculate and update statistics
        const stats = this.calculateStats();
        document.getElementById('totalConnections').textContent = stats.totalConnections;
        document.getElementById('totalSpent').textContent = `£${stats.totalSpent.toFixed(2)}`;
        document.getElementById('avgCost').textContent = `£${stats.avgCost.toFixed(2)}`;
        document.getElementById('totalGas').textContent = `${stats.totalGas} KG`;

        // Update cost per day statistics
        this.updateCostPerDayDisplay(stats.costPerDay);

        // Update enhanced cost analysis
        this.updateEnhancedCostAnalysis(stats);

        // Update connections list
        this.updateConnectionsList();

        // Update settings preview
        this.updateSettingsPreview();
    }

    updateCostPerDayDisplay(costPerDay) {
        const costPerDayElement = document.getElementById('costPerDay');
        const daysBetweenElement = document.getElementById('daysBetween');
        const totalDaysElement = document.getElementById('totalDays');

        if (costPerDayElement && costPerDay.dailyRate > 0) {
            costPerDayElement.textContent = `£${costPerDay.dailyRate.toFixed(2)}`;
        } else if (costPerDayElement) {
            costPerDayElement.textContent = '£0.00';
        }

        if (daysBetweenElement && costPerDay.daysBetween > 0) {
            daysBetweenElement.textContent = `${costPerDay.daysBetween.toFixed(1)} days`;
        } else if (daysBetweenElement) {
            daysBetweenElement.textContent = '0 days';
        }

        if (totalDaysElement && costPerDay.totalDays > 0) {
            totalDaysElement.textContent = `${costPerDay.totalDays} days`;
        } else if (totalDaysElement) {
            totalDaysElement.textContent = '0 days';
        }
    }

    updateEnhancedCostAnalysis(stats) {
        const recentCostPerDayElement = document.getElementById('recentCostPerDay');
        const overallCostPerDayElement = document.getElementById('overallCostPerDay');
        const recentDaysBetweenElement = document.getElementById('recentDaysBetween');
        const projectedMonthlyElement = document.getElementById('projectedMonthly');

        if (recentCostPerDayElement) {
            recentCostPerDayElement.textContent = `£${stats.recentCostPerDay.toFixed(2)}`;
        }

        if (overallCostPerDayElement) {
            overallCostPerDayElement.textContent = `£${stats.overallCostPerDay.toFixed(2)}`;
        }

        if (recentDaysBetweenElement) {
            recentDaysBetweenElement.textContent = `${stats.recentDaysBetween} days`;
        }

        if (projectedMonthlyElement) {
            projectedMonthlyElement.textContent = `£${stats.projectedMonthly.toFixed(2)}`;
        }
    }

    updateConnectionsList() {
        const connectionsList = document.getElementById('connectionsList');
        
        if (this.connections.length === 0) {
            connectionsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-gas-pump"></i>
                    <h3>No connections yet</h3>
                    <p>Add your first gas bottle connection to start tracking!</p>
                </div>
            `;
            return;
        }

        connectionsList.innerHTML = this.connections.map(connection => {
            const formattedDate = this.formatDate(connection.date);
            const formattedCost = `£${connection.cost.toFixed(2)}`;
            
            return `
                <div class="connection-item">
                    <div class="connection-info">
                        <div class="connection-date">${formattedDate}</div>
                        <div class="connection-cost">${formattedCost}</div>
                    </div>
                    <div class="connection-actions">
                        <button class="btn btn-small btn-delete" onclick="app.deleteConnection(${connection.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    deleteConnection(id) {
        if (confirm('Are you sure you want to delete this connection?')) {
            this.connections = this.connections.filter(conn => conn.id !== id);
            
            // Save to local storage immediately
            this.saveData();
            
            // Delete from Firebase
            if (firebaseLoaded) {
                this.deleteConnectionFromFirebase(id);
            } else {
                this.logDebug('Firebase not available, connection deleted locally only', 'warning');
            }
            
            this.showMessage('Connection deleted successfully!', 'success');
            this.updateDisplay();
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }

    showMessage(message, type = 'success') {
        // Remove existing toasts
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => toast.remove());

        // Create new toast
        const toastDiv = document.createElement('div');
        toastDiv.className = `toast ${type}`;
        
        // Add icon based on type
        const icon = type === 'success' ? 'fas fa-check-circle' : 
                    type === 'error' ? 'fas fa-exclamation-circle' :
                    type === 'warning' ? 'fas fa-exclamation-triangle' :
                    'fas fa-info-circle';
        
        toastDiv.innerHTML = `<i class="${icon}"></i><span>${message}</span>`;

        // Add to body
        document.body.appendChild(toastDiv);

        // Trigger animation
        setTimeout(() => {
            toastDiv.classList.add('show');
        }, 100);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            toastDiv.classList.remove('show');
            setTimeout(() => {
                if (toastDiv.parentNode) {
                    toastDiv.remove();
                }
            }, 300);
        }, 3000);
    }

    saveData() {
        const data = {
            connections: this.connections,
            settings: this.settings
        };
        localStorage.setItem('gasBottleTracker', JSON.stringify(data));
    }

    loadData() {
        const savedData = localStorage.getItem('gasBottleTracker');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                this.connections = data.connections || [];
                this.settings = { ...this.settings, ...data.settings };
            } catch (error) {
                console.error('Error loading saved data:', error);
            }
        }
    }

    async saveDataToFirebase() {
        if (!firebaseLoaded || !this.firebase) {
            this.logDebug('Firebase not available, skipping save', 'warning');
            return;
        }

        try {
            const { doc, setDoc, collection } = this.firebase;
            
            // Save user settings
            const userDocRef = doc(db, 'users', this.userId);
            await setDoc(userDocRef, {
                settings: this.settings,
                lastUpdated: new Date().toISOString(),
                totalConnections: this.connections.length
            });
            
            // Save individual connections
            for (const connection of this.connections) {
                const connectionDocRef = doc(db, 'users', this.userId, 'connections', connection.id.toString());
                await setDoc(connectionDocRef, {
                    date: connection.date,
                    cost: connection.cost,
                    timestamp: connection.timestamp,
                    bottleWeight: this.settings.bottleWeight // Store bottle weight at time of connection
                });
            }
            
            this.logDebug(`Data saved to Firebase successfully - ${this.connections.length} connections`, 'success');
        } catch (error) {
            console.error('Firebase save error:', error);
            this.logDebug(`Firebase save error: ${error.message}`, 'error');
            this.updateSyncStatus('error');
        }
    }

    async saveConnectionToFirebase(connection) {
        if (!firebaseLoaded || !this.firebase) {
            this.logDebug('Firebase not available, skipping connection save', 'warning');
            return;
        }

        try {
            const { doc, setDoc } = this.firebase;
            
            // Save individual connection
            const connectionDocRef = doc(db, 'users', this.userId, 'connections', connection.id.toString());
            await setDoc(connectionDocRef, {
                date: connection.date,
                cost: connection.cost,
                timestamp: connection.timestamp,
                bottleWeight: this.settings.bottleWeight
            });

            // Update user summary
            const userDocRef = doc(db, 'users', this.userId);
            await setDoc(userDocRef, {
                settings: this.settings,
                lastUpdated: new Date().toISOString(),
                totalConnections: this.connections.length
            });
            
            this.logDebug(`Connection ${connection.id} saved to Firebase`, 'success');
            this.updateSyncStatus('connected');
        } catch (error) {
            console.error('Firebase connection save error:', error);
            this.logDebug(`Firebase connection save error: ${error.message}`, 'error');
            this.updateSyncStatus('error');
        }
    }

    async deleteConnectionFromFirebase(connectionId) {
        if (!firebaseLoaded || !this.firebase) {
            this.logDebug('Firebase not available, skipping connection delete', 'warning');
            return;
        }

        try {
            const { doc, deleteDoc, setDoc } = this.firebase;
            
            // Delete the connection document
            const connectionDocRef = doc(db, 'users', this.userId, 'connections', connectionId.toString());
            await deleteDoc(connectionDocRef);

            // Update user summary
            const userDocRef = doc(db, 'users', this.userId);
            await setDoc(userDocRef, {
                settings: this.settings,
                lastUpdated: new Date().toISOString(),
                totalConnections: this.connections.length
            });
            
            this.logDebug(`Connection ${connectionId} deleted from Firebase`, 'success');
        } catch (error) {
            console.error('Firebase connection delete error:', error);
            this.logDebug(`Firebase connection delete error: ${error.message}`, 'error');
        }
    }

    generateUserId() {
        let userId = localStorage.getItem('gasBottleTracker_userId');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('gasBottleTracker_userId', userId);
        }
        return userId;
    }

    logDebug(message, type = 'info') {
        const debugConsole = document.getElementById('debugConsole');
        if (!debugConsole) return;

        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `debug-entry ${type}`;
        entry.textContent = `[${timestamp}] ${message}`;
        
        debugConsole.appendChild(entry);
        debugConsole.scrollTop = debugConsole.scrollHeight;
    }

    clearDebugConsole() {
        const debugConsole = document.getElementById('debugConsole');
        if (debugConsole) {
            debugConsole.innerHTML = '<div class="debug-entry">Debug console cleared...</div>';
        }
    }

    async testFirebaseConnection() {
        this.logDebug('Testing Firebase connection...', 'info');
        
        if (!firebaseLoaded) {
            this.logDebug('Firebase not loaded, attempting to initialize...', 'warning');
            try {
                this.firebase = await initFirebaseModules();
                if (this.firebase && firebaseLoaded) {
                    await this.initFirebase();
                    this.logDebug('Firebase connection successful!', 'success');
                } else {
                    this.logDebug('Firebase initialization failed', 'error');
                }
            } catch (error) {
                this.logDebug(`Firebase test failed: ${error.message}`, 'error');
            }
        } else {
            this.logDebug('Firebase already connected', 'success');
        }
    }

    async manualSync() {
        this.logDebug('Manual sync initiated...', 'info');
        
        if (firebaseLoaded) {
            try {
                await this.saveDataToFirebase();
                this.logDebug('Manual sync completed successfully', 'success');
            } catch (error) {
                this.logDebug(`Manual sync failed: ${error.message}`, 'error');
            }
        } else {
            this.logDebug('Cannot sync - Firebase not available', 'warning');
        }
    }

    generateReport() {
        // Placeholder for report functionality
        this.showMessage('Report feature not yet implemented in this version', 'info');
    }

    exportReport() {
        // Placeholder for export functionality
        this.showMessage('Export feature not yet implemented in this version', 'info');
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    window.app = new GasBottleTracker();
    console.log('App initialized successfully');
}); 