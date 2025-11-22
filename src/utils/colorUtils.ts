// Convert hex color to RGB
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Lighten a color by a percentage
export function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const r = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * (percent / 100)));
  const g = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * (percent / 100)));
  const b = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * (percent / 100)));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Darken a color by a percentage
export function darkenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const r = Math.max(0, Math.floor(rgb.r * (1 - percent / 100)));
  const g = Math.max(0, Math.floor(rgb.g * (1 - percent / 100)));
  const b = Math.max(0, Math.floor(rgb.b * (1 - percent / 100)));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Apply accent color to the document
export function applyAccentColor(color: string): void {
  const rgb = hexToRgb(color);
  if (!rgb) return;

  const root = document.documentElement;
  
  // Calculate lighter and darker variants
  const hoverColor = lightenColor(color, 10);
  const darkGradient1 = darkenColor(color, 30);
  const darkGradient2 = darkenColor(color, 45);
  
  // Set CSS variables for accent color
  root.style.setProperty('--color-accent-primary', color);
  root.style.setProperty('--color-accent-hover', hoverColor);
  root.style.setProperty('--color-accent-light', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`);
  root.style.setProperty('--color-border-focus', color);
  
  // Set logo colors
  root.style.setProperty('--logo-primary', color);
  root.style.setProperty('--logo-gradient-stop1', darkGradient1);
  root.style.setProperty('--logo-gradient-stop2', darkGradient2);
  
  // Store RGB values for other uses
  root.style.setProperty('--accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
}

// Preset accent colors
export const PRESET_COLORS = [
  { name: 'Teal (Default)', value: '#4DB8B8' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Orange', value: '#F59E0B' },
  { name: 'Green', value: '#10B981' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Emerald', value: '#059669' },
];
