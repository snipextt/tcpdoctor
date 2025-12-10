# Frontend Structure

This directory contains the React/TypeScript frontend for the TCP Statistics Monitor application.

## Directory Structure

```
src/
├── components/          # React components
│   ├── ConnectionTable.tsx
│   ├── StatsPanel.tsx
│   ├── FilterControls.tsx
│   └── index.ts
├── hooks/              # Custom React hooks
│   ├── useDebounce.ts
│   └── index.ts
├── styles/             # Global styles and CSS
│   └── global.css
├── theme/              # Theme configuration
│   └── index.ts
├── types/              # TypeScript type definitions
│   └── index.ts
├── utils/              # Utility functions
│   └── formatters.ts
├── assets/             # Static assets (images, fonts)
├── App.tsx             # Root application component
├── main.tsx            # Application entry point
└── README.md           # This file
```

## Key Files

### Components
- **ConnectionTable.tsx**: Virtualized table displaying all TCP connections
- **StatsPanel.tsx**: Detailed statistics panel for selected connection
- **FilterControls.tsx**: Filter UI for connection list

### Theme (`theme/index.ts`)
Centralized theme configuration including:
- Color palette (primary, status, health indicators)
- Typography settings
- Spacing scale
- Border radius values
- Shadows and transitions
- Helper functions for colors

### Types (`types/index.ts`)
TypeScript type definitions including:
- Re-exported backend types
- TCP state enums and names
- Application state types
- Component prop types

### Utils (`utils/formatters.ts`)
Formatting utilities for:
- Bytes (B, KB, MB, GB)
- Milliseconds (ms, s, m)
- Bandwidth (B/s, KB/s, MB/s)
- Counts with separators
- Percentages
- IP endpoints
- RTT values

### Hooks (`hooks/`)
Custom React hooks:
- **useDebounce**: Debounce values for filter inputs

## Styling Approach

The application uses a combination of:
1. **CSS Variables**: Defined in `styles/global.css` for consistent theming
2. **Theme Object**: JavaScript/TypeScript theme configuration in `theme/index.ts`
3. **CSS Modules**: Support configured for component-specific styles (`.module.css`)

## Path Aliases

The following path aliases are configured in `tsconfig.json` and `vite.config.ts`:
- `@/*` → `src/*`
- `@components/*` → `src/components/*`
- `@utils/*` → `src/utils/*`
- `@types/*` → `src/types/*`
- `@theme/*` → `src/theme/*`
- `@styles/*` → `src/styles/*`

## Dependencies

### Production
- **react**: UI library
- **react-dom**: React DOM rendering
- **react-window**: Virtualized scrolling for large lists
- **recharts**: Charting library for time-series visualization

### Development
- **typescript**: Type checking
- **vite**: Build tool and dev server
- **@vitejs/plugin-react**: React support for Vite

## Next Steps

The following components are placeholders and will be implemented in future tasks:
1. ConnectionTable - Full implementation with virtualization
2. StatsPanel - Categorized metrics display
3. FilterControls - Complete filter UI
4. App component - State management and layout
5. Time-series charts for selected connection

## Requirements Addressed

This structure addresses the following requirements:
- **5.1**: Responsive layout foundation
- **5.2**: Virtualized scrolling setup (react-window)
- **5.3**: Smooth transitions configured in theme
- **5.5**: Professional design system with theme configuration
