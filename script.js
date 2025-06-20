// Gas Bottle Tracker App with Firebase Sync
import { db, collection, doc, setDoc, getDoc, getDocs, deleteDoc, onSnapshot, query, orderBy } from './firebase-config.js';

class GasBottleTracker {
    constructor() {
        this.connections = [];
        this.settings = {
            bottleWeight: 47,
            bottlePrice: 83.50
        };
        this.syncStatus = 'connecting'; // connecting, connected, error
        this.userId = this.generateUserId();
        this.unsubscribe = null;
        
        this.init();
    }

    init() {
        this.initFirebase().then(() => {
            this.setupEventListeners();
            this.setDefaultDate();
            this.updateDisplay();
        }).catch(() => {
            // Fallback to local storage if Firebase fails
            this.loadData();
            this.setupEventListeners();
            this.setDefaultDate();
            this.updateDisplay();
        });
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
        document.getElementById('clearDebug').addEventListener('click', () => {
            this.clearDebugConsole();
        });

        document.getElementById('testFirebase').addEventListener('click', () => {
            this.testFirebaseConnection();
        });

        // Set default report dates
        this.setDefaultReportDates();
    }

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('connectionDate').value = today;
    }

    setDefaultReportDates() {
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        document.getElementById('reportStartDate').value = thirtyDaysAgo.toISOString().split('T')[0];
        document.getElementById('reportEndDate').value = today.toISOString().split('T')[0];
    }

    updateSettings() {
        const bottleWeight = parseFloat(document.getElementById('bottleWeight').value);
        const bottlePrice = parseFloat(document.getElementById('bottlePrice').value);

        if (bottleWeight <= 0 || bottlePrice < 0) {
            this.showMessage('Please enter valid settings values.', 'error');
            return;
        }

        this.settings.bottleWeight = bottleWeight;
        this.settings.bottlePrice = bottlePrice;
        this.saveDataToFirebase();
        this.showMessage('Settings updated successfully!', 'success');
    }

    addConnection() {
        const date = document.getElementById('connectionDate').value;
        const cost = parseFloat(document.getElementById('connectionCost').value);

        if (!date || cost < 0) {
            this.showMessage('Please enter valid connection details.', 'error');
            return;
        }

        const connection = {
            id: Date.now(),
            date: date,
            cost: cost,
            timestamp: new Date().toISOString()
        };

        this.connections.push(connection);
        this.connections.sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date descending
        
        // Save to Firebase (which will trigger the real-time update)
        this.saveDataToFirebase();
        this.resetForm();
        this.showMessage('Connection added successfully!', 'success');
    }

    deleteConnection(id) {
        if (confirm('Are you sure you want to delete this connection?')) {
            this.deleteConnectionFromFirebase(id);
        }
    }

    clearHistory() {
        if (confirm('Are you sure you want to clear all connection history? This action cannot be undone.')) {
            this.connections = [];
            this.saveDataToFirebase();
            this.showMessage('History cleared successfully!', 'success');
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

        // Calculate cost per day
        const costPerDay = this.calculateCostPerDay();

        return {
            totalConnections,
            totalSpent,
            avgCost,
            totalGas,
            costPerDay
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

    calculateEnhancedStats() {
        const stats = this.calculateStats();
        
        // Calculate recent cost per day (last 2 bottles)
        const recentCostPerDay = this.calculateRecentCostPerDay();
        
        // Calculate overall cost per day (all bottles)
        const overallCostPerDay = this.calculateOverallCostPerDay();
        
        // Calculate projected monthly cost
        const projectedMonthly = recentCostPerDay > 0 ? recentCostPerDay * 30 : 0;
        
        return {
            ...stats,
            recentCostPerDay,
            overallCostPerDay,
            projectedMonthly
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
        const stats = this.calculateEnhancedStats();
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
    }

    updateCostPerDayDisplay(costPerDay) {
        const costPerDayElement = document.getElementById('costPerDay');
        const daysBetweenElement = document.getElementById('daysBetween');
        const totalDaysElement = document.getElementById('totalDays');

        if (costPerDay.dailyRate > 0) {
            costPerDayElement.textContent = `£${costPerDay.dailyRate.toFixed(2)}`;
            daysBetweenElement.textContent = `${costPerDay.daysBetween.toFixed(1)} days`;
            totalDaysElement.textContent = `${costPerDay.totalDays} days`;
        } else {
            costPerDayElement.textContent = '£0.00';
            daysBetweenElement.textContent = '0 days';
            totalDaysElement.textContent = '0 days';
        }
    }

    updateEnhancedCostAnalysis(stats) {
        const recentCostPerDayElement = document.getElementById('recentCostPerDay');
        const overallCostPerDayElement = document.getElementById('overallCostPerDay');
        const recentDaysBetweenElement = document.getElementById('recentDaysBetween');
        const projectedMonthlyElement = document.getElementById('projectedMonthly');

        recentCostPerDayElement.textContent = `£${stats.recentCostPerDay.toFixed(2)}`;
        overallCostPerDayElement.textContent = `£${stats.overallCostPerDay.toFixed(2)}`;
        recentDaysBetweenElement.textContent = `${this.calculateRecentDaysBetween()} days`;
        projectedMonthlyElement.textContent = `£${stats.projectedMonthly.toFixed(2)}`;
    }

    generateReport() {
        const startDate = document.getElementById('reportStartDate').value;
        const endDate = document.getElementById('reportEndDate').value;

        if (!startDate || !endDate) {
            this.showMessage('Please select both start and end dates.', 'error');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            this.showMessage('Start date must be before end date.', 'error');
            return;
        }

        // Filter connections within the date range
        const filteredConnections = this.connections.filter(conn => {
            const connDate = new Date(conn.date);
            const start = new Date(startDate);
            const end = new Date(endDate);
            return connDate >= start && connDate <= end;
        });

        if (filteredConnections.length === 0) {
            this.showMessage('No connections found in the selected date range.', 'error');
            return;
        }

        // Calculate report statistics
        const reportStats = this.calculateReportStats(filteredConnections, startDate, endDate);

        // Display report results
        this.displayReportResults(reportStats, filteredConnections);

        // Show export button
        document.getElementById('exportReport').style.display = 'inline-flex';
    }

    calculateReportStats(connections, startDate, endDate) {
        const totalConnections = connections.length;
        const totalSpent = connections.reduce((sum, conn) => sum + conn.cost, 0);
        const avgCost = totalConnections > 0 ? totalSpent / totalConnections : 0;

        // Calculate period length
        const start = new Date(startDate);
        const end = new Date(endDate);
        const periodDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates

        // Calculate cost per day for the period
        const costPerDay = periodDays > 0 ? totalSpent / periodDays : 0;

        // Calculate projected annual cost based on this period's rate
        const projectedAnnual = costPerDay * 365;

        return {
            totalConnections,
            totalSpent,
            avgCost,
            costPerDay,
            periodDays,
            projectedAnnual
        };
    }

    displayReportResults(stats, connections) {
        // Update report statistics
        document.getElementById('reportConnections').textContent = stats.totalConnections;
        document.getElementById('reportTotalSpent').textContent = `£${stats.totalSpent.toFixed(2)}`;
        document.getElementById('reportAvgCost').textContent = `£${stats.avgCost.toFixed(2)}`;
        document.getElementById('reportCostPerDay').textContent = `£${stats.costPerDay.toFixed(2)}`;
        document.getElementById('reportPeriod').textContent = `${stats.periodDays} days`;
        document.getElementById('reportProjectedAnnual').textContent = `£${stats.projectedAnnual.toFixed(2)}`;

        // Display connections in the report
        this.displayReportConnections(connections);

        // Show the results section
        document.getElementById('reportResults').style.display = 'block';
    }

    displayReportConnections(connections) {
        const reportConnectionsList = document.getElementById('reportConnectionsList');
        
        if (connections.length === 0) {
            reportConnectionsList.innerHTML = '<p>No connections found in this period.</p>';
            return;
        }

        // Sort connections by date (newest first)
        const sortedConnections = [...connections].sort((a, b) => new Date(b.date) - new Date(a.date));

        reportConnectionsList.innerHTML = sortedConnections.map(connection => {
            const formattedDate = this.formatDate(connection.date);
            const formattedCost = `£${connection.cost.toFixed(2)}`;
            
            return `
                <div class="connection-item">
                    <div class="connection-info">
                        <div class="connection-date">${formattedDate}</div>
                        <div class="connection-cost">${formattedCost}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    exportReport() {
        const startDate = document.getElementById('reportStartDate').value;
        const endDate = document.getElementById('reportEndDate').value;
        
        if (!startDate || !endDate) {
            this.showMessage('Please generate a report first.', 'error');
            return;
        }

        // Filter connections within the date range
        const filteredConnections = this.connections.filter(conn => {
            const connDate = new Date(conn.date);
            const start = new Date(startDate);
            const end = new Date(endDate);
            return connDate >= start && connDate <= end;
        });

        const reportStats = this.calculateReportStats(filteredConnections, startDate, endDate);

        const reportData = {
            reportPeriod: {
                startDate,
                endDate,
                periodDays: reportStats.periodDays
            },
            statistics: reportStats,
            connections: filteredConnections,
            settings: this.settings,
            generatedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gas-bottle-report-${startDate}-to-${endDate}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showMessage('Report exported successfully!', 'success');
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

        connectionsList.innerHTML = this.connections.map((connection, index) => {
            const formattedDate = this.formatDate(connection.date);
            const formattedCost = `£${connection.cost.toFixed(2)}`;
            
            // Calculate days since this connection (if not the most recent)
            let daysSince = '';
            if (index > 0) {
                const connectionDate = new Date(connection.date);
                const nextConnectionDate = new Date(this.connections[index - 1].date);
                const daysDiff = Math.ceil((nextConnectionDate - connectionDate) / (1000 * 60 * 60 * 24));
                daysSince = `<div class="days-since">Lasted ${daysDiff} days</div>`;
            }
            
            return `
                <div class="connection-item" data-id="${connection.id}">
                    <div class="connection-info">
                        <div class="connection-date">${formattedDate}</div>
                        <div class="connection-cost">${formattedCost}</div>
                        ${daysSince}
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

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    showMessage(message, type = 'success') {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());

        // Create new message
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = message;

        // Insert at the top of main content
        const mainContent = document.querySelector('.main-content');
        mainContent.insertBefore(messageElement, mainContent.firstChild);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.remove();
            }
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
                this.settings = data.settings || this.settings;
            } catch (error) {
                console.error('Error loading saved data:', error);
                this.connections = [];
                this.settings = {
                    bottleWeight: 47,
                    bottlePrice: 83.50
                };
            }
        }
    }

    // Export data functionality
    exportData() {
        const data = {
            connections: this.connections,
            settings: this.settings,
            stats: this.calculateEnhancedStats(),
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gas-bottle-tracker-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Import data functionality
    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.connections && data.settings) {
                    this.connections = data.connections;
                    this.settings = data.settings;
                    this.saveData();
                    this.updateDisplay();
                    this.showMessage('Data imported successfully!', 'success');
                } else {
                    this.showMessage('Invalid data format.', 'error');
                }
            } catch (error) {
                this.showMessage('Error importing data.', 'error');
            }
        };
        reader.readAsText(file);
    }

    generateUserId() {
        // Generate a unique user ID based on device/browser
        let userId = localStorage.getItem('gasBottleUserId');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('gasBottleUserId', userId);
        }
        return userId;
    }

    async initFirebase() {
        try {
            this.logDebug('Initializing Firebase...', 'info');
            this.updateSyncStatus('connecting');
            
            this.logDebug(`User ID: ${this.userId}`, 'info');
            this.logDebug('Setting up Firestore real-time listener...', 'info');
            
            // Set up real-time listener for data changes
            const userDocRef = doc(db, 'users', this.userId);
            this.logDebug(`Document reference: users/${this.userId}`, 'info');
            
            this.unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
                this.logDebug('Firestore snapshot received', 'info');
                
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    this.logDebug(`Document exists, data: ${JSON.stringify(data)}`, 'success');
                    this.connections = data.connections || [];
                    this.settings = data.settings || this.settings;
                    this.updateDisplay();
                    this.updateSyncStatus('connected');
                    this.logDebug(`Loaded ${this.connections.length} connections`, 'success');
                } else {
                    this.logDebug('Document does not exist, creating new document...', 'warning');
                    // First time user, create document
                    this.saveDataToFirebase();
                }
            }, (error) => {
                this.logDebug(`Firestore listener error: ${error.message}`, 'error');
                this.logDebug(`Error code: ${error.code}`, 'error');
                console.error('Firebase sync error:', error);
                this.updateSyncStatus('error');
                // Fallback to local storage
                this.loadData();
            });

            this.logDebug('Firebase initialization completed', 'success');

        } catch (error) {
            this.logDebug(`Firebase initialization error: ${error.message}`, 'error');
            this.logDebug(`Error code: ${error.code}`, 'error');
            console.error('Firebase initialization error:', error);
            this.updateSyncStatus('error');
            // Fallback to local storage
            this.loadData();
        }
    }

    updateSyncStatus(status) {
        this.syncStatus = status;
        const indicator = document.getElementById('syncIndicator');
        const syncText = document.getElementById('syncText');
        
        if (indicator && syncText) {
            indicator.className = `sync-indicator ${status}`;
            
            switch (status) {
                case 'connected':
                    syncText.textContent = 'Synced';
                    indicator.innerHTML = '<i class="fas fa-cloud"></i><span>Synced</span>';
                    break;
                case 'connecting':
                    syncText.textContent = 'Connecting...';
                    indicator.innerHTML = '<i class="fas fa-cloud"></i><span>Connecting...</span>';
                    break;
                case 'error':
                    syncText.textContent = 'Offline';
                    indicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Offline</span>';
                    break;
            }
        }
    }

    async saveDataToFirebase() {
        try {
            this.logDebug('Saving data to Firebase...', 'info');
            this.logDebug(`Connections: ${this.connections.length}`, 'info');
            this.logDebug(`Settings: ${JSON.stringify(this.settings)}`, 'info');
            
            const userDocRef = doc(db, 'users', this.userId);
            const dataToSave = {
                connections: this.connections,
                settings: this.settings,
                lastUpdated: new Date().toISOString()
            };
            
            this.logDebug(`Saving to document: users/${this.userId}`, 'info');
            await setDoc(userDocRef, dataToSave);
            
            this.logDebug('✅ Data saved to Firebase successfully!', 'success');
            this.updateSyncStatus('connected');
        } catch (error) {
            this.logDebug(`❌ Error saving to Firebase: ${error.message}`, 'error');
            this.logDebug(`Error code: ${error.code}`, 'error');
            this.logDebug(`Error details: ${JSON.stringify(error)}`, 'error');
            console.error('Error saving to Firebase:', error);
            this.updateSyncStatus('error');
            // Fallback to local storage
            this.saveData();
        }
    }

    async deleteConnectionFromFirebase(connectionId) {
        try {
            // Remove from local array first
            this.connections = this.connections.filter(conn => conn.id !== connectionId);
            
            // Update Firebase
            await this.saveDataToFirebase();
            
            this.updateDisplay();
            this.showMessage('Connection deleted successfully!', 'success');
        } catch (error) {
            console.error('Error deleting from Firebase:', error);
            this.updateSyncStatus('error');
            this.showMessage('Error deleting connection. Please try again.', 'error');
        }
    }

    cleanup() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
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
        
        // Also log to browser console
        console.log(`[DEBUG] ${message}`);
    }

    clearDebugConsole() {
        const debugConsole = document.getElementById('debugConsole');
        if (debugConsole) {
            debugConsole.innerHTML = '<div class="debug-entry">Debug console cleared...</div>';
        }
    }

    async testFirebaseConnection() {
        this.logDebug('Testing Firebase connection...', 'info');
        
        try {
            const userDocRef = doc(db, 'users', this.userId);
            const testData = {
                test: true,
                timestamp: new Date().toISOString(),
                message: 'Firebase connection test'
            };
            
            this.logDebug(`Attempting to write test data to user: ${this.userId}`, 'info');
            await setDoc(userDocRef, testData);
            this.logDebug('✅ Firebase write test successful!', 'success');
            
            this.logDebug('Attempting to read test data...', 'info');
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                this.logDebug('✅ Firebase read test successful!', 'success');
                this.logDebug(`Data: ${JSON.stringify(docSnap.data())}`, 'info');
            } else {
                this.logDebug('❌ Firebase read test failed - document not found', 'error');
            }
            
        } catch (error) {
            this.logDebug(`❌ Firebase test failed: ${error.message}`, 'error');
            this.logDebug(`Error code: ${error.code}`, 'error');
            this.logDebug(`Error details: ${JSON.stringify(error)}`, 'error');
        }
    }
}

// Initialize the app when the page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new GasBottleTracker();
});

// Cleanup when page is unloaded
window.addEventListener('beforeunload', () => {
    if (app) {
        app.cleanup();
    }
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to submit form
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const form = document.getElementById('connectionForm');
        if (form.checkValidity()) {
            app.addConnection();
        }
    }
});

// Add service worker for PWA capabilities (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
} 