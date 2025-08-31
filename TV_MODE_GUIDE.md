# OpsiMate TV Mode Guide

## Overview

TV Mode is a specialized fullscreen interface designed for large-screen displays, wall-mounted monitors, and Network Operations Center (NOC) setups. It provides a high-density, auto-refreshing view of your services optimized for monitoring at a distance.

## Features

### 🖥️ **Fullscreen Display**
- Clean, distraction-free interface
- Optimized for large screens and wall mounts
- High contrast colors for visibility at distance

### 🔄 **Auto-Refresh**
- Configurable refresh intervals (10-300 seconds)
- Real-time service status updates
- Automatic data synchronization

### 🎯 **Visual Status Indicators**
- Color-coded service cards based on status:
  - **Green**: Running services
  - **Gray**: Stopped services  
  - **Red**: Error/failed services
  - **Yellow**: Unknown status
- Large status icons for quick identification
- Alert badges for services with active alerts

### 📊 **Statistics Dashboard**
- Real-time overview of all services
- Total service count
- Breakdown by status (Running, Stopped, Error, Unknown)
- Active alerts counter

### 🔄 **View Rotation** (Optional)
- Automatically cycles through different views
- Configurable rotation intervals (30-600 seconds)
- Cycles through: All → Running → Stopped → Error

### 🎛️ **Smart Grid Layout**
- **Automatic sizing**: Grid adapts based on service count
- **Optimized for 60-70+ services**: Ultra-compact layout for high-density monitoring
- **Responsive scaling**: Cards grow/shrink based on available space
- **Four size modes**: 
  - **Large (lg)**: 1-6 services, 3 columns max
  - **Medium (md)**: 7-12 services, 4 columns
  - **Small (sm)**: 13-48 services, 6-8 columns
  - **Extra Small (xs)**: 49+ services, 10 columns

### 💾 **Saved View Integration**
- **Inherits dashboard state**: Launches with current filters and search
- **Preserves column visibility**: Respects your table settings
- **Filter awareness**: Shows filtered vs total counts in statistics
- **Search integration**: Maintains search terms from main dashboard

### ⚡ **Service Control Actions**
- **Direct service management**: Start, stop, and restart services directly from TV Mode
- **Compact dropdown menu**: Space-efficient three-dot menu for all service actions
- **Context-aware actions**: Shows "Start" for stopped services, "Stop" for running services
- **Visual feedback**: Loading states and toast notifications for all actions
- **Universal restart**: Restart option available for all services regardless of status

### 🚨 **Alert Viewing**
- **Interactive alert badges**: Click alert count to view detailed alert information
- **Hover tooltips**: Rich alert details on hover with alert names and descriptions
- **Alert preview**: Shows up to 3 most recent alerts with overflow indicator
- **Contextual positioning**: Alert information positioned for optimal visibility

## How to Use TV Mode

### 1. **Launch TV Mode**
1. Navigate to your main Dashboard
2. Apply any filters, search terms, or saved views you want to monitor
3. Click the **"TV Mode"** button in the top-right corner
4. TV Mode launches instantly with your current dashboard state

### 2. **Default Configuration**

TV Mode launches with optimized default settings:

#### **Auto Refresh**
- **Enabled by default**: Refreshes every 30 seconds
- **Optimal for monitoring**: Balances real-time updates with performance

#### **View Rotation**
- **Disabled by default**: Stays on your selected view
- **Can be enabled**: Use keyboard shortcuts to cycle views manually

#### **Smart Grid System**
TV Mode automatically calculates the optimal layout based on your service count:

- **1-6 services**: Large cards in up to 3 columns for maximum visibility
- **7-12 services**: Medium cards in 4 columns for balanced view
- **13-24 services**: Small cards in 6 columns for efficient space usage
- **25-48 services**: Small cards in 8 columns for higher density
- **49+ services**: Extra-small cards in 10 columns for maximum capacity

**Automatic Adaptation**: 
- Cards scale down as service count increases
- Less information shown in compact modes (IP addresses, provider details hidden)
- Status badges become single letters in ultra-compact mode
- Alert counts always remain visible

#### **Saved View Integration**
- **Inherits your dashboard state**: Filters, search terms, and column settings
- **No configuration needed**: Just set up your view in the dashboard first
- **URL bookmarking**: Share specific TV Mode configurations via URL

### 3. **TV Mode Controls**

#### **View Filter Buttons**
- **All**: Show all services
- **Running**: Filter to running services only
- **Stopped**: Filter to stopped services only
- **Error**: Filter to error services only

#### **Exit TV Mode**
- Click the **"Exit TV Mode"** button to return to normal dashboard

## Service Card Information

Each service card displays:

### **Status Indicator**
- Large colored icon showing service status
- Service type icon (Docker, Systemd, Manual)

### **Service Details**
- **Service Name**: Primary identifier
- **IP Address**: Service or provider IP
- **Provider**: Host provider name
- **Container Image**: For Docker services
- **Status Badge**: Current service status

### **Alert Badge**
- Red badge showing number of active alerts
- Only appears when service has unresolved alerts

## Best Practices

### **For NOC/Operations Centers**
1. **Use large displays** (32" or larger) for best visibility
2. **Set auto-refresh** to 30-60 seconds
3. **Enable view rotation** to cycle through different perspectives
4. **Position displays** at eye level for operators
5. **Use high contrast themes** for better visibility

### **For Team Monitoring**
1. **Configure shorter refresh intervals** (15-30 seconds) for active monitoring
2. **Focus on error view** during incident response
3. **Use running view** for general health monitoring
4. **Adjust grid columns** based on number of services

### **For Wall Mounts**
1. **Use 4K displays** for maximum information density
2. **Set longer rotation intervals** (90-120 seconds) for readability
3. **Ensure proper lighting** to avoid screen glare
4. **Test visibility** from typical viewing distances

## URL Parameters

TV Mode settings are stored in URL parameters, allowing you to:
- **Bookmark configurations** for different use cases
- **Share specific setups** with team members
- **Create multiple TV mode profiles**

Example URL:
```
/tv-mode?autoRefresh=true&refreshInterval=30000&viewRotation=true&rotationInterval=60000&defaultView=all&gridColumns=6
```

## Troubleshooting

### **Services Not Updating**
- Check auto-refresh is enabled
- Verify network connectivity
- Ensure backend services are running

### **Display Issues**
- Adjust grid columns for your screen size
- Check browser zoom level (should be 100%)
- Ensure display resolution is set correctly

### **Performance Issues**
- Increase refresh interval to reduce load
- Disable view rotation if not needed
- Close other browser tabs to free memory

## Integration with OpsiMate Features

TV Mode integrates seamlessly with:
- **Service Management**: All service operations available
- **Alert System**: Real-time alert notifications
- **Provider Management**: Multi-provider service monitoring
- **Authentication**: Secure access control

## Keyboard Shortcuts

- **Escape**: Exit TV Mode (also exits fullscreen automatically)
- **F11**: Toggle browser fullscreen
- **Ctrl+R** / **Cmd+R**: Manual refresh with loading animation
- **1-4**: Switch between view filters (All, Running, Stopped, Error)

## Service Actions

TV Mode provides direct service control capabilities:

### **Compact Action Menu**
- **Three-dot menu**: Click the ⋮ button on any service card to access actions
- **Start**: Available for stopped services (play icon)
- **Stop**: Available for running services (square icon) 
- **Restart**: Always available for all services (rotating arrow icon)

### **Alert Information**
- **Alert badges**: Services with alerts show a red badge with alert count
- **Hover details**: Hover over alert badge to see alert names and descriptions
- **Alert preview**: Shows up to 3 most recent alerts in tooltip
- **Overflow indicator**: Shows "+X more alerts" when there are additional alerts

### **Menu Availability**
- **Large cards** (1-6 services): Full dropdown menu with alert badges
- **Medium cards** (7-12 services): Full dropdown menu with alert badges
- **Small cards** (13-48 services): Compact dropdown menu with alert badges
- **Extra small cards** (49+ services): No action menu (too compact for usability)

### **User Feedback**
- **Loading states**: Menu items show disabled state during operations
- **Toast notifications**: Success/error messages for all actions
- **Automatic refresh**: Service list updates after successful operations
- **Rich tooltips**: Detailed alert information with proper formatting

## Technical Requirements

- **Modern web browser** with JavaScript enabled
- **Minimum resolution**: 1920x1080 (1080p)
- **Recommended resolution**: 3840x2160 (4K)
- **Network connection** for real-time updates
- **OpsiMate backend** running and accessible

---

*For additional support or feature requests, please contact your OpsiMate administrator.*
