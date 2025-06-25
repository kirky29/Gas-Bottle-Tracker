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

        // Tab functionality for analytics
        this.setupTabs();

        // Debug section toggle
        this.setupDebugToggle();
    }

    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;

                // Remove active class from all buttons and contents
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                // Add active class to clicked button and corresponding content
                button.classList.add('active');
                document.getElementById(`${targetTab}-tab`).classList.add('active');
            });
        });
    }

    setupDebugToggle() {
        const debugToggle = document.getElementById('debugToggle');
        const debugContent = document.getElementById('debugContent');
        const toggleIcon = debugToggle.querySelector('.toggle-icon');

        if (debugToggle && debugContent && toggleIcon) {
            debugToggle.addEventListener('click', () => {
                const isVisible = debugContent.style.display !== 'none';
                
                if (isVisible) {
                    debugContent.style.display = 'none';
                    toggleIcon.classList.remove('rotated');
                } else {
                    debugContent.style.display = 'block';
                    toggleIcon.classList.add('rotated');
                }
            });
        }
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

        // Calculate new comprehensive statistics
        const currentVsPreviousBottle = this.calculateCurrentVsPreviousBottle();
        const gasUsageStats = this.calculateGasUsageStats();
        const bottleAverages = this.calculateBottleAverages();
        const comprehensiveStats = this.calculateComprehensiveStats();

        return {
            totalConnections,
            totalSpent,
            avgCost,
            totalGas,
            costPerDay,
            recentCostPerDay,
            overallCostPerDay,
            recentDaysBetween,
            projectedMonthly,
            currentVsPreviousBottle,
            gasUsageStats,
            bottleAverages,
            comprehensiveStats
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

    calculateCurrentVsPreviousBottle() {
        if (this.connections.length < 2) {
            return {
                currentBottleDays: 0,
                previousBottleDays: 0,
                currentCostPerDay: 0,
                previousCostPerDay: 0,
                currentGasPerDay: 0,
                previousGasPerDay: 0,
                costDifference: 0,
                gasEfficiencyDifference: 0,
                hasData: false
            };
        }

        const sortedConnections = [...this.connections].sort((a, b) => new Date(b.date) - new Date(a.date));
        const currentBottle = sortedConnections[0];
        const previousBottle = sortedConnections[1];
        const thirdBottle = sortedConnections[2] || null;

        // Current bottle analysis (from current bottle back to previous)
        const currentBottleDate = new Date(currentBottle.date);
        const previousBottleDate = new Date(previousBottle.date);
        const currentBottleDays = Math.ceil((currentBottleDate - previousBottleDate) / (1000 * 60 * 60 * 24));

        // Previous bottle analysis (from previous bottle back to the one before)
        let previousBottleDays = 0;
        if (thirdBottle) {
            const thirdBottleDate = new Date(thirdBottle.date);
            previousBottleDays = Math.ceil((previousBottleDate - thirdBottleDate) / (1000 * 60 * 60 * 24));
        }

        // Calculate cost per day for each bottle
        const currentCostPerDay = currentBottleDays > 0 ? currentBottle.cost / currentBottleDays : 0;
        const previousCostPerDay = previousBottleDays > 0 ? previousBottle.cost / previousBottleDays : 0;

        // Calculate gas usage per day (weight / days)
        const currentGasPerDay = currentBottleDays > 0 ? this.settings.bottleWeight / currentBottleDays : 0;
        const previousGasPerDay = previousBottleDays > 0 ? this.settings.bottleWeight / previousBottleDays : 0;

        // Calculate differences
        const costDifference = currentCostPerDay - previousCostPerDay;
        const gasEfficiencyDifference = currentGasPerDay - previousGasPerDay;

        return {
            currentBottleDays,
            previousBottleDays,
            currentCostPerDay,
            previousCostPerDay,
            currentGasPerDay,
            previousGasPerDay,
            costDifference,
            gasEfficiencyDifference,
            hasData: true,
            currentBottleDate: currentBottle.date,
            previousBottleDate: previousBottle.date,
            currentBottleCost: currentBottle.cost,
            previousBottleCost: previousBottle.cost
        };
    }

    calculateGasUsageStats() {
        if (this.connections.length === 0) {
            return {
                totalGasUsed: 0,
                avgGasPerBottle: 0,
                avgGasPerDay: 0,
                gasEfficiencyTrend: 0,
                projectedAnnualGas: 0
            };
        }

        const totalGasUsed = this.connections.length * this.settings.bottleWeight;
        const avgGasPerBottle = this.settings.bottleWeight; // This is constant per bottle

        // Calculate average gas per day across all bottles
        let avgGasPerDay = 0;
        if (this.connections.length >= 2) {
            const sortedConnections = [...this.connections].sort((a, b) => new Date(a.date) - new Date(b.date));
            const firstDate = new Date(sortedConnections[0].date);
            const lastDate = new Date(sortedConnections[sortedConnections.length - 1].date);
            const totalDays = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24));
            
            if (totalDays > 0) {
                avgGasPerDay = totalGasUsed / totalDays;
            }
        }

        // Calculate gas efficiency trend (comparing recent vs older usage)
        let gasEfficiencyTrend = 0;
        if (this.connections.length >= 4) {
            const recentConnections = this.connections.slice(0, Math.ceil(this.connections.length / 2));
            const olderConnections = this.connections.slice(Math.ceil(this.connections.length / 2));
            
            const recentAvgDays = this.calculateAvgDaysBetweenConnections(recentConnections);
            const olderAvgDays = this.calculateAvgDaysBetweenConnections(olderConnections);
            
            const recentGasPerDay = recentAvgDays > 0 ? this.settings.bottleWeight / recentAvgDays : 0;
            const olderGasPerDay = olderAvgDays > 0 ? this.settings.bottleWeight / olderAvgDays : 0;
            
            gasEfficiencyTrend = recentGasPerDay - olderGasPerDay;
        }

        // Project annual gas usage based on current rate
        const projectedAnnualGas = avgGasPerDay * 365;

        return {
            totalGasUsed,
            avgGasPerBottle,
            avgGasPerDay,
            gasEfficiencyTrend,
            projectedAnnualGas
        };
    }

    calculateBottleAverages() {
        if (this.connections.length < 2) {
            return {
                avgDaysBetweenBottles: 0,
                avgCostPerBottle: 0,
                avgCostPerDay: 0,
                avgGasPerDay: 0,
                medianDaysBetween: 0,
                mostEfficientBottleDays: 0,
                leastEfficientBottleDays: 0
            };
        }

        // Calculate days between each bottle
        const sortedConnections = [...this.connections].sort((a, b) => new Date(a.date) - new Date(b.date));
        const daysBetweenBottles = [];
        
        for (let i = 1; i < sortedConnections.length; i++) {
            const prevDate = new Date(sortedConnections[i - 1].date);
            const currDate = new Date(sortedConnections[i].date);
            const days = Math.ceil((currDate - prevDate) / (1000 * 60 * 60 * 24));
            daysBetweenBottles.push(days);
        }

        const avgDaysBetweenBottles = daysBetweenBottles.reduce((sum, days) => sum + days, 0) / daysBetweenBottles.length;
        const avgCostPerBottle = this.connections.reduce((sum, conn) => sum + conn.cost, 0) / this.connections.length;
        const avgCostPerDay = avgDaysBetweenBottles > 0 ? avgCostPerBottle / avgDaysBetweenBottles : 0;
        const avgGasPerDay = avgDaysBetweenBottles > 0 ? this.settings.bottleWeight / avgDaysBetweenBottles : 0;

        // Calculate median
        const sortedDays = [...daysBetweenBottles].sort((a, b) => a - b);
        const medianDaysBetween = sortedDays.length > 0 ? 
            sortedDays.length % 2 === 0 ? 
                (sortedDays[sortedDays.length / 2 - 1] + sortedDays[sortedDays.length / 2]) / 2 :
                sortedDays[Math.floor(sortedDays.length / 2)] : 0;

        // Find most and least efficient bottles
        const mostEfficientBottleDays = Math.max(...daysBetweenBottles, 0);
        const leastEfficientBottleDays = Math.min(...daysBetweenBottles, 0);

        return {
            avgDaysBetweenBottles,
            avgCostPerBottle,
            avgCostPerDay,
            avgGasPerDay,
            medianDaysBetween,
            mostEfficientBottleDays,
            leastEfficientBottleDays
        };
    }

    calculateComprehensiveStats() {
        const totalSpent = this.connections.reduce((sum, conn) => sum + conn.cost, 0);
        const totalBottles = this.connections.length;
        
        // Calculate time-based statistics
        let timeStats = {
            totalDaysTracked: 0,
            avgBottleLifespan: 0,
            shortestBottleLifespan: 0,
            longestBottleLifespan: 0
        };

        if (this.connections.length >= 2) {
            const sortedConnections = [...this.connections].sort((a, b) => new Date(a.date) - new Date(b.date));
            const firstDate = new Date(sortedConnections[0].date);
            const lastDate = new Date(sortedConnections[sortedConnections.length - 1].date);
            timeStats.totalDaysTracked = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24));

            // Calculate individual bottle lifespans
            const bottleLifespans = [];
            for (let i = 1; i < sortedConnections.length; i++) {
                const prevDate = new Date(sortedConnections[i - 1].date);
                const currDate = new Date(sortedConnections[i].date);
                const days = Math.ceil((currDate - prevDate) / (1000 * 60 * 60 * 24));
                bottleLifespans.push(days);
            }

            if (bottleLifespans.length > 0) {
                timeStats.avgBottleLifespan = bottleLifespans.reduce((sum, days) => sum + days, 0) / bottleLifespans.length;
                timeStats.shortestBottleLifespan = Math.min(...bottleLifespans);
                timeStats.longestBottleLifespan = Math.max(...bottleLifespans);
            }
        }

        // Calculate cost efficiency metrics
        const costEfficiency = {
            totalSpent,
            avgSpendingPerMonth: 0,
            costPerKg: totalBottles > 0 ? totalSpent / (totalBottles * this.settings.bottleWeight) : 0,
            projectedAnnualSpending: 0
        };

        if (timeStats.totalDaysTracked > 0) {
            const dailySpending = totalSpent / timeStats.totalDaysTracked;
            costEfficiency.avgSpendingPerMonth = dailySpending * 30;
            costEfficiency.projectedAnnualSpending = dailySpending * 365;
        }

        return {
            timeStats,
            costEfficiency,
            bottleEfficiencyRating: this.calculateBottleEfficiencyRating()
        };
    }

    calculateBottleEfficiencyRating() {
        if (this.connections.length < 3) {
            return { rating: 'N/A', description: 'Need more data', score: 0 };
        }

        const recentStats = this.calculateCurrentVsPreviousBottle();
        const averages = this.calculateBottleAverages();
        
        let score = 0;
        let factors = [];

        // Factor 1: Current bottle efficiency vs average
        if (recentStats.hasData && recentStats.currentBottleDays > 0) {
            const currentEfficiency = recentStats.currentBottleDays;
            const avgEfficiency = averages.avgDaysBetweenBottles;
            
            if (currentEfficiency > avgEfficiency * 1.1) {
                score += 25;
                factors.push('Above average bottle lifespan');
            } else if (currentEfficiency < avgEfficiency * 0.9) {
                score -= 15;
                factors.push('Below average bottle lifespan');
            } else {
                score += 10;
                factors.push('Average bottle lifespan');
            }
        }

        // Factor 2: Consistency (low variance in bottle lifespans)
        const bottleAverages = this.calculateBottleAverages();
        const consistencyScore = (bottleAverages.mostEfficientBottleDays - bottleAverages.leastEfficientBottleDays);
        if (consistencyScore < 7) {
            score += 25;
            factors.push('Very consistent usage');
        } else if (consistencyScore < 14) {
            score += 15;
            factors.push('Fairly consistent usage');
        } else {
            score += 5;
            factors.push('Variable usage patterns');
        }

        // Factor 3: Improvement trend
        if (recentStats.hasData) {
            if (recentStats.currentBottleDays > recentStats.previousBottleDays) {
                score += 20;
                factors.push('Improving efficiency');
            } else if (recentStats.currentBottleDays < recentStats.previousBottleDays) {
                score -= 10;
                factors.push('Declining efficiency');
            }
        }

        // Factor 4: Overall efficiency based on bottle lifespan
        if (averages.avgDaysBetweenBottles > 21) {
            score += 30;
            factors.push('Excellent bottle longevity');
        } else if (averages.avgDaysBetweenBottles > 14) {
            score += 20;
            factors.push('Good bottle longevity');
        } else if (averages.avgDaysBetweenBottles > 7) {
            score += 10;
            factors.push('Average bottle longevity');
        } else {
            score -= 10;
            factors.push('Short bottle lifespan');
        }

        // Determine rating
        let rating, description;
        if (score >= 80) {
            rating = 'Excellent';
            description = 'Very efficient gas usage';
        } else if (score >= 60) {
            rating = 'Good';
            description = 'Above average efficiency';
        } else if (score >= 40) {
            rating = 'Average';
            description = 'Standard gas usage patterns';
        } else if (score >= 20) {
            rating = 'Below Average';
            description = 'Room for improvement';
        } else {
            rating = 'Poor';
            description = 'Consider usage optimization';
        }

        return { rating, description, score, factors };
    }

    calculateAvgDaysBetweenConnections(connections) {
        if (connections.length < 2) return 0;

        const sortedConnections = [...connections].sort((a, b) => new Date(a.date) - new Date(b.date));
        let totalDays = 0;
        let intervals = 0;

        for (let i = 1; i < sortedConnections.length; i++) {
            const prevDate = new Date(sortedConnections[i - 1].date);
            const currDate = new Date(sortedConnections[i].date);
            const days = Math.ceil((currDate - prevDate) / (1000 * 60 * 60 * 24));
            totalDays += days;
            intervals++;
        }

        return intervals > 0 ? totalDays / intervals : 0;
    }

    updateDisplay() {
        // Update settings inputs
        document.getElementById('bottleWeight').value = this.settings.bottleWeight;
        document.getElementById('bottlePrice').value = this.settings.bottlePrice;

        // Calculate and update statistics
        const stats = this.calculateStats();
        
        // Update overview stats
        document.getElementById('totalConnections').textContent = stats.totalConnections;
        document.getElementById('totalSpent').textContent = `£${stats.totalSpent.toFixed(2)}`;
        document.getElementById('recentCostPerDay').textContent = `£${stats.recentCostPerDay.toFixed(2)}`;
        
        // Update efficiency rating in overview
        const overviewRating = document.getElementById('bottleEfficiencyRating');
        if (overviewRating) {
            overviewRating.textContent = stats.comprehensiveStats.bottleEfficiencyRating.rating;
            overviewRating.className = `stat-value rating-${stats.comprehensiveStats.bottleEfficiencyRating.rating.toLowerCase().replace(' ', '-')}`;
        }

        // Update all detailed statistics
        this.updateCurrentVsPreviousBottleDisplay(stats.currentVsPreviousBottle);
        this.updateAnalyticsTabsDisplay(stats);
        this.updateEfficiencyDisplay(stats.comprehensiveStats);

        // Show/hide sections based on data availability
        this.updateSectionVisibility(stats);

        // Update connections list
        this.updateConnectionsList();

        // Update settings preview
        this.updateSettingsPreview();
    }

    updateAnalyticsTabsDisplay(stats) {
        // Usage tab
        const totalGasUsedEl = document.getElementById('totalGasUsed');
        const avgGasPerDayEl = document.getElementById('avgGasPerDay');
        const projectedAnnualGasEl = document.getElementById('projectedAnnualGas');
        const gasEfficiencyTrendEl = document.getElementById('gasEfficiencyTrend');

        if (totalGasUsedEl) totalGasUsedEl.textContent = `${stats.gasUsageStats.totalGasUsed} KG`;
        if (avgGasPerDayEl) avgGasPerDayEl.textContent = `${stats.gasUsageStats.avgGasPerDay.toFixed(2)} KG`;
        if (projectedAnnualGasEl) projectedAnnualGasEl.textContent = `${stats.gasUsageStats.projectedAnnualGas.toFixed(0)} KG`;

        if (gasEfficiencyTrendEl) {
            const trend = stats.gasUsageStats.gasEfficiencyTrend;
            const prefix = trend > 0 ? '+' : '';
            const trendClass = trend > 0 ? 'trend-up' : trend < 0 ? 'trend-down' : 'trend-neutral';
            gasEfficiencyTrendEl.textContent = `${prefix}${trend.toFixed(2)} KG/day`;
            gasEfficiencyTrendEl.className = `analytics-value trend ${trendClass}`;
        }

        // Costs tab
        const avgSpendingPerMonthEl = document.getElementById('avgSpendingPerMonth');
        const costPerKgEl = document.getElementById('costPerKg');
        const projectedAnnualSpendingEl = document.getElementById('projectedAnnualSpending');
        const avgCostEl = document.getElementById('avgCost');

        if (avgSpendingPerMonthEl) avgSpendingPerMonthEl.textContent = `£${stats.comprehensiveStats.costEfficiency.avgSpendingPerMonth.toFixed(2)}`;
        if (costPerKgEl) costPerKgEl.textContent = `£${stats.comprehensiveStats.costEfficiency.costPerKg.toFixed(2)}`;
        if (projectedAnnualSpendingEl) projectedAnnualSpendingEl.textContent = `£${stats.comprehensiveStats.costEfficiency.projectedAnnualSpending.toFixed(2)}`;
        if (avgCostEl) avgCostEl.textContent = `£${stats.avgCost.toFixed(2)}`;

        // Performance tab
        const avgDaysBetweenBottlesEl = document.getElementById('avgDaysBetweenBottles');
        const mostEfficientBottleEl = document.getElementById('mostEfficientBottle');
        const leastEfficientBottleEl = document.getElementById('leastEfficientBottle');
        const totalDaysTrackedEl = document.getElementById('totalDaysTracked');

        if (avgDaysBetweenBottlesEl) avgDaysBetweenBottlesEl.textContent = `${stats.bottleAverages.avgDaysBetweenBottles.toFixed(1)} days`;
        if (mostEfficientBottleEl) mostEfficientBottleEl.textContent = `${stats.bottleAverages.mostEfficientBottleDays} days`;
        if (leastEfficientBottleEl) leastEfficientBottleEl.textContent = `${stats.bottleAverages.leastEfficientBottleDays} days`;
        if (totalDaysTrackedEl) totalDaysTrackedEl.textContent = `${stats.comprehensiveStats.timeStats.totalDaysTracked} days`;
    }

    updateCurrentVsPreviousBottleDisplay(currentVsPrevious) {
        // Current vs Previous Bottle Analysis
        const currentBottleDaysEl = document.getElementById('currentBottleDays');
        const previousBottleDaysEl = document.getElementById('previousBottleDays');
        const currentCostPerDayEl = document.getElementById('currentCostPerDay');
        const previousCostPerDayEl = document.getElementById('previousCostPerDay');
        const currentGasPerDayEl = document.getElementById('currentGasPerDay');
        const previousGasPerDayEl = document.getElementById('previousGasPerDay');
        const costDifferenceEl = document.getElementById('costDifference');
        const gasEfficiencyDifferenceEl = document.getElementById('gasEfficiencyDifference');

        if (!currentVsPrevious.hasData) {
            // Show "Need more data" message for all elements
            const elements = [currentBottleDaysEl, previousBottleDaysEl, currentCostPerDayEl, 
                            previousCostPerDayEl, currentGasPerDayEl, previousGasPerDayEl, 
                            costDifferenceEl, gasEfficiencyDifferenceEl];
            elements.forEach(el => {
                if (el) el.textContent = 'N/A';
            });
            return;
        }

        if (currentBottleDaysEl) currentBottleDaysEl.textContent = `${currentVsPrevious.currentBottleDays}`;
        if (previousBottleDaysEl) previousBottleDaysEl.textContent = `${currentVsPrevious.previousBottleDays}`;
        if (currentCostPerDayEl) currentCostPerDayEl.textContent = `£${currentVsPrevious.currentCostPerDay.toFixed(2)}`;
        if (previousCostPerDayEl) previousCostPerDayEl.textContent = `£${currentVsPrevious.previousCostPerDay.toFixed(2)}`;
        if (currentGasPerDayEl) currentGasPerDayEl.textContent = `${currentVsPrevious.currentGasPerDay.toFixed(2)}`;
        if (previousGasPerDayEl) previousGasPerDayEl.textContent = `${currentVsPrevious.previousGasPerDay.toFixed(2)}`;
        
        // Cost difference with trend indicator
        if (costDifferenceEl) {
            const diff = currentVsPrevious.costDifference;
            const prefix = diff > 0 ? '+' : '';
            const trendClass = diff > 0 ? 'trend-up' : diff < 0 ? 'trend-down' : 'trend-neutral';
            costDifferenceEl.textContent = `${prefix}£${diff.toFixed(2)}`;
            costDifferenceEl.className = `indicator-value ${trendClass}`;
        }

        // Gas efficiency difference with trend indicator  
        if (gasEfficiencyDifferenceEl) {
            const diff = currentVsPrevious.gasEfficiencyDifference;
            const prefix = diff > 0 ? '+' : '';
            const trendClass = diff > 0 ? 'trend-up' : diff < 0 ? 'trend-down' : 'trend-neutral';
            gasEfficiencyDifferenceEl.textContent = `${prefix}${diff.toFixed(2)} KG`;
            gasEfficiencyDifferenceEl.className = `indicator-value ${trendClass}`;
        }
    }

    updateEfficiencyDisplay(comprehensiveStats) {
        // Efficiency rating in detailed section
        const bottleEfficiencyRatingDisplayEl = document.getElementById('bottleEfficiencyRatingDisplay');
        const bottleEfficiencyDescriptionEl = document.getElementById('bottleEfficiencyDescription');
        const bottleEfficiencyScoreEl = document.getElementById('bottleEfficiencyScore');
        const bottleEfficiencyFactorsEl = document.getElementById('bottleEfficiencyFactors');

        const rating = comprehensiveStats.bottleEfficiencyRating;
        if (bottleEfficiencyRatingDisplayEl) {
            bottleEfficiencyRatingDisplayEl.textContent = rating.rating;
            bottleEfficiencyRatingDisplayEl.className = `efficiency-rating-display rating-${rating.rating.toLowerCase().replace(' ', '-')}`;
        }
        if (bottleEfficiencyDescriptionEl) bottleEfficiencyDescriptionEl.textContent = rating.description;
        if (bottleEfficiencyScoreEl) bottleEfficiencyScoreEl.textContent = `${rating.score}/100`;
        
        if (bottleEfficiencyFactorsEl && rating.factors) {
            bottleEfficiencyFactorsEl.innerHTML = rating.factors.map(factor => 
                `<li class="efficiency-factor">${factor}</li>`
            ).join('');
        }
    }

    updateSectionVisibility(stats) {
        // Show comparison section only if we have at least 2 bottles
        const comparisonSection = document.getElementById('comparisonSection');
        if (comparisonSection) {
            if (stats.totalConnections >= 2) {
                comparisonSection.style.display = 'block';
            } else {
                comparisonSection.style.display = 'none';
            }
        }

        // Show efficiency section only if we have at least 3 bottles
        const efficiencySection = document.getElementById('efficiencySection');
        if (efficiencySection) {
            if (stats.totalConnections >= 3) {
                efficiencySection.style.display = 'block';
            } else {
                efficiencySection.style.display = 'none';
            }
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


}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    window.app = new GasBottleTracker();
    console.log('App initialized successfully');
}); 