# TV Mode Screenshot Guide

This guide explains how to capture and add screenshots for the TV Mode documentation.

## Required Screenshots

The TV Mode documentation references the following screenshots:

### 1. Default TV Mode View (Already exists)
- **Path:** `assets/images/tv-mode.png`
- **Status:** ✅ Already available
- **Description:** Shows the default TV Mode view with multiple services
- **Used in:** README.md and tv-mode.md

### 2. Additional Recommended Screenshots

To enhance the documentation, consider adding these optional screenshots:

#### Filtered View - Running Services Only
- **Suggested path:** `assets/images/tv-mode-running.png`
- **What to capture:** TV Mode filtered to show only running services (press `2` in TV Mode)
- **Purpose:** Show how filters work and the visual appearance of running-only view

#### Alert Monitoring View
- **Suggested path:** `assets/images/tv-mode-alerts.png`
- **What to capture:** TV Mode showing services with active alerts
- **Purpose:** Demonstrate alert visibility in TV Mode

#### Smart Grid - High Density
- **Suggested path:** `assets/images/tv-mode-density.png`
- **What to capture:** TV Mode with 30+ services showing the compact grid layout
- **Purpose:** Show how TV Mode handles large numbers of services

#### Fullscreen Mode
- **Suggested path:** `assets/images/tv-mode-fullscreen.png`
- **What to capture:** TV Mode in fullscreen (F11) on a large display
- **Purpose:** Show the wall-display use case

## How to Capture Screenshots

### Step-by-Step Process

1. **Launch OpsiMate and Navigate to TV Mode**
   - Access: `http://localhost:8080/tv-mode`
   - Wait for services to load

2. **Configure the View (if needed)**
   - Apply filters for specific screenshot types
   - Adjust window/screen size appropriately
   - Ensure data is visible and representative

3. **Capture the Screenshot**
   - **Windows:** Press `Win + Shift + S` or use Snipping Tool
   - **Mac:** Press `Cmd + Shift + 4`
   - **Linux:** Use `gnome-screenshot` or similar tool

4. **Save and Optimize**
   - Save as PNG format
   - Use descriptive filename
   - Optimize file size if needed (use tools like TinyPNG)

5. **Place in Project**
   - Save to: `assets/images/`
   - Use naming convention: `tv-mode-[description].png`

6. **Update Documentation**
   - Reference the image in `docs/tv-mode.md`
   - Add alt text for accessibility
   - Provide caption if helpful

### Screenshot Guidelines

**Resolution:**
- Minimum width: 1280px
- Recommended width: 1920px
- Maintain aspect ratio

**Content:**
- Show representative data (not empty screens)
- Include enough services to demonstrate the feature
- Ensure text is readable
- Avoid sensitive information (use demo data)

**Quality:**
- Use PNG format for clarity
- Ensure good contrast
- Capture in good lighting (if photographing a display)

**File Size:**
- Optimize images to keep them under 500KB when possible
- Use compression tools if needed

## Updating Documentation with New Screenshots

When adding new screenshots, update the relevant markdown files:

### In `docs/tv-mode.md`

Add image references in the "Example Screenshots" section:

```markdown
### [Screenshot Name]

![Description](../assets/images/tv-mode-[name].png)

*Caption explaining what the screenshot shows*
```

### In `README.md`

If adding to the main README, use:

```markdown
![OpsiMate TV Mode - Description](assets/images/tv-mode-[name].png)
```

## Current Screenshot Inventory

| Screenshot | Path | Status | Used In |
|------------|------|--------|---------|
| Default TV Mode | `assets/images/tv-mode.png` | ✅ Exists | README.md, docs/tv-mode.md |
| Running Services | `assets/images/tv-mode-running.png` | 📋 Planned | docs/tv-mode.md |
| Alert View | `assets/images/tv-mode-alerts.png` | 📋 Planned | docs/tv-mode.md |
| High Density | `assets/images/tv-mode-density.png` | 📋 Planned | docs/tv-mode.md |
| Fullscreen | `assets/images/tv-mode-fullscreen.png` | 📋 Planned | docs/tv-mode.md |

## Need Help?

If you're contributing screenshots and need assistance:

1. Check existing images in `assets/images/` for reference
2. Refer to the [Contributing Guide](../CONTRIBUTING.md)
3. Ask in the [Slack Community](https://join.slack.com/t/opsimate/shared_invite/zt-39bq3x6et-NrVCZzH7xuBGIXmOjJM7gA)
4. Open an issue on GitHub for guidance

---

*Last updated: October 2025*
