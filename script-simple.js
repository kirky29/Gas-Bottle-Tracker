// Simplified Gas Bottle Tracker App without Firebase
class GasBottleTracker {
    constructor() {
        this.connections = [];
        this.settings = {
            bottleWeight: 47,
            bottlePrice: 83.50
        };
        
        this.loadData();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setDefaultDate();
        this.updateDisplay();
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
        this.saveData();
        this.showMessage('Settings updated successfully!', 'success');
        this.updateDisplay();
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
        this.connections.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        this.saveData();
        this.resetForm();
        this.showMessage('Connection added successfully!', 'success');
        this.updateDisplay();
    }

    clearHistory() {
        if (confirm('Are you sure you want to clear all connection history? This action cannot be undone.')) {
            this.connections = [];
            this.saveData();
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

        return {
            totalConnections,
            totalSpent,
            avgCost,
            totalGas
        };
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

        // Update connections list
        this.updateConnectionsList();
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
            this.saveData();
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
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());

        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;

        // Insert at the top of the main content
        const mainContent = document.querySelector('.main-content');
        mainContent.insertBefore(messageDiv, mainContent.firstChild);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            messageDiv.remove();
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
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    window.app = new GasBottleTracker();
    console.log('App initialized successfully');
}); 