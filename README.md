# Gas Bottle Tracker

A simple, mobile-first web application to track your gas bottle spending and usage.

*Latest update: Added cost per day calculations and daily spending analysis*

## Features

- **Mobile-First Design**: Fully responsive interface optimized for smartphones
- **Track Connections**: Record when you connect a gas bottle and the cost
- **Flexible Pricing**: Update bottle weight and price as needed
- **Statistics**: View total connections, spending, average costs, and gas usage
- **Daily Analysis**: Calculate cost per day and time between bottles
- **Data Persistence**: All data is saved locally in your browser
- **Clean Interface**: Modern, intuitive design with smooth animations

## How It Works

The app tracks your gas bottle connections by:

1. **Recording Connections**: Add the date and cost when you connect a new gas bottle
2. **Calculating Usage**: Uses the bottle weight (default 47KG) to calculate total gas usage
3. **Tracking Costs**: Monitors total spending and average costs per bottle
4. **Flexible Settings**: Update bottle weight and price as they change over time

## Default Settings

- **Bottle Weight**: 47 KG (UK standard)
- **Bottle Price**: £83.50

You can update these settings at any time to reflect current prices and bottle sizes.

## Usage

### Adding a Connection
1. Enter the date you connected the gas bottle
2. Enter the cost you paid
3. Click "Add Connection"

### Updating Settings
1. Modify the bottle weight or price in the settings section
2. Click "Update Settings" to save changes

### Viewing Statistics
The app automatically calculates and displays:
- Total number of connections
- Total amount spent
- Average cost per bottle
- Total gas usage (in KG)

### Managing History
- View all your connections in chronological order
- Delete individual connections if needed
- Clear all history (with confirmation)

## Technical Details

- **Pure HTML/CSS/JavaScript**: No frameworks or dependencies
- **Local Storage**: Data is saved in your browser's local storage
- **Progressive Web App**: Can be installed on mobile devices
- **Responsive Design**: Works on all screen sizes

## Installation

1. Clone or download this repository
2. Open `index.html` in your web browser
3. Start tracking your gas bottle usage!

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Data Storage

All data is stored locally in your browser using localStorage. This means:
- Your data stays private and local
- No internet connection required after initial load
- Data persists between browser sessions
- Clearing browser data will remove your tracking history

## Future Enhancements

Potential features for future versions:
- Export/import data functionality
- Charts and graphs for spending trends
- Multiple gas bottle types
- Cost per KG calculations
- Usage predictions based on historical data

## Contributing

Feel free to fork this project and submit pull requests for improvements!

## License

This project is open source and available under the MIT License. 