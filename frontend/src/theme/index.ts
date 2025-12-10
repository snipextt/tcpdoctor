// Theme configuration for consistent styling across the application

export const theme = {
  // Color palette
  colors: {
    // Primary colors
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    primaryLight: '#dbeafe',
    
    // Background colors
    background: '#ffffff',
    backgroundSecondary: '#f9fafb',
    backgroundTertiary: '#f3f4f6',
    
    // Text colors
    text: '#111827',
    textSecondary: '#6b7280',
    textMuted: '#9ca3af',
    
    // Border colors
    border: '#e5e7eb',
    borderHover: '#d1d5db',
    
    // Status colors
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    
    // Health indicator colors (accessible)
    healthGood: '#10b981',
    healthWarning: '#f59e0b',
    healthCritical: '#ef4444',
    
    // TCP State colors
    stateEstablished: '#10b981',
    stateListen: '#3b82f6',
    stateClosing: '#f59e0b',
    stateClosed: '#6b7280',
    
    // Chart colors
    chartPrimary: '#2563eb',
    chartSecondary: '#10b981',
    chartTertiary: '#f59e0b',
    chartQuaternary: '#8b5cf6',
  },
  
  // Dark theme colors (for future implementation)
  darkColors: {
    background: '#111827',
    backgroundSecondary: '#1f2937',
    backgroundTertiary: '#374151',
    text: '#f9fafb',
    textSecondary: '#d1d5db',
    textMuted: '#9ca3af',
    border: '#374151',
    borderHover: '#4b5563',
  },
  
  // Typography
  typography: {
    fontFamily: 'Nunito, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  
  // Spacing scale (in rem)
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
    '3xl': '4rem',   // 64px
  },
  
  // Border radius
  borderRadius: {
    none: '0',
    sm: '0.25rem',   // 4px
    md: '0.375rem',  // 6px
    lg: '0.5rem',    // 8px
    xl: '0.75rem',   // 12px
    full: '9999px',
  },
  
  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  
  // Transitions
  transitions: {
    fast: '150ms ease-in-out',
    normal: '250ms ease-in-out',
    slow: '350ms ease-in-out',
  },
  
  // Breakpoints for responsive design
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
  
  // Z-index scale
  zIndex: {
    dropdown: 1000,
    modal: 1100,
    tooltip: 1200,
    notification: 1300,
  },
};

export type Theme = typeof theme;

// Helper function to get TCP state color
export function getTCPStateColor(state: number): string {
  switch (state) {
    case 5: // Established
      return theme.colors.stateEstablished;
    case 2: // Listen
      return theme.colors.stateListen;
    case 8: // CloseWait
    case 9: // Closing
      return theme.colors.stateClosing;
    case 1: // Closed
    case 12: // DeleteTCB
      return theme.colors.stateClosed;
    default:
      return theme.colors.textSecondary;
  }
}

// Helper function to get health indicator color
export function getHealthColor(hasWarning: boolean, hasCritical: boolean): string {
  if (hasCritical) return theme.colors.healthCritical;
  if (hasWarning) return theme.colors.healthWarning;
  return theme.colors.healthGood;
}
