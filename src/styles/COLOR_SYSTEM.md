# Silica Color System

This document explains the centralized color system for the Silica app.

## Overview

All colors are defined in `/src/styles/colors.css` and can be easily modified in one place to affect the entire application.

## How to Change Colors

To change any color in the app, simply edit the values in `/src/styles/colors.css`:

### Light Mode Colors
```css
:root {
  --color-primary-bg: #FFFFFF;      /* Main background */
  --color-secondary-bg: #F5F5F5;    /* Cards, sidebars */
  --color-text-primary: #1C1C1C;    /* Main text */
  --color-text-secondary: #999999;  /* Secondary text */
  --color-accent-primary: #007AFF;  /* Buttons, links */
  /* ... and more */
}
```

### Dark Mode Colors
```css
[data-theme="dark"] {
  --color-primary-bg: #1A1A1A;      /* Main background */
  --color-secondary-bg: #2C2C2C;    /* Cards, sidebars */
  --color-text-primary: #FAFAFA;    /* Main text */
  --color-text-secondary: #AAAAAA;  /* Secondary text */
  --color-accent-primary: #5AC8FA;  /* Buttons, links */
  /* ... and more */
}
```

## Using Colors in Components

Always use the semantic aliases in your CSS:

```css
/* Good ✅ */
.my-component {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border);
}

/* Avoid ❌ */
.my-component {
  background: #FFFFFF;
  color: #1C1C1C;
  border: 1px solid rgba(0, 0, 0, 0.1);
}
```

## Available Color Variables

### Backgrounds
- `--bg-primary` - Main background
- `--bg-secondary` - Cards, sidebars
- `--bg-tertiary` - Inputs, alternate backgrounds
- `--bg-hover` - Hover states

### Text
- `--text-primary` - Main text
- `--text-secondary` - Secondary text, hints
- `--text-tertiary` - Disabled text
- `--text-on-accent` - Text on accent color (usually white)

### Accent/Actions
- `--accent` - Primary action color
- `--accent-hover` - Accent hover state
- `--accent-light` - Transparent accent for backgrounds

### Borders
- `--border` - Default borders
- `--border-focus` - Focus state borders

### States
- `--state-success` - Success states
- `--state-warning` - Warning states
- `--state-error` - Error states

### Effects
- `--shadow` - Box shadows
- `--scrollbar-track` - Scrollbar track
- `--scrollbar-thumb` - Scrollbar thumb
- `--scrollbar-thumb-hover` - Scrollbar thumb hover

## Benefits

1. **Single Source of Truth**: Change one value to update the entire app
2. **Theme Support**: Easy light/dark mode switching
3. **Consistency**: Ensures consistent colors across all components
4. **Maintainability**: Easy to update and maintain color schemes
5. **Semantic Naming**: Clear purpose for each color variable
