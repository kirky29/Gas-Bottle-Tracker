// Gas Bottle Tracker App
class GasBottleTracker {
    constructor() {
        this.connections = [];
        this.settings = {
            bottleWeight: 47,
            bottlePrice: 83.50
        };
        
        this.init();
    }

    init() {
        this.loadData();
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
    }

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('connectionDate').value = today;
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
        this.updateDisplay();
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
        
        this.saveData();
        this.updateDisplay();
        this.resetForm();
        this.showMessage('Connection added successfully!', 'success');
    }

    deleteConnection(id) {
        if (confirm('Are you sure you want to delete this connection?')) {
            this.connections = this.connections.filter(conn => conn.id !== id);
            this.saveData();
            this.updateDisplay();
            this.showMessage('Connection deleted successfully!', 'success');
        }
    }

    clearHistory() {
        if (confirm('Are you sure you want to clear all connection history? This action cannot be undone.')) {
            this.connections = [];
            this.saveData();
            this.updateDisplay();
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
            stats: this.calculateStats(),
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
}

// Initialize the app when the page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new GasBottleTracker();
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