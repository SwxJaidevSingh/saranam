/**
 * Material-UI Theme Integration
 * Synchronizes MUI theme with the app's dark mode
 */

import { createTheme } from '@mui/material/styles';

/**
 * Creates a MUI theme that respects the app's dark mode setting
 * @param {boolean} isDark - Whether dark mode is active
 * @returns {import('@mui/material/styles').Theme} MUI theme object
 */
export const createMuiTheme = (isDark) => {
  return createTheme({
    palette: {
      mode: isDark ? 'dark' : 'light',
      primary: {
        main: isDark ? '#60A5FA' : '#0EA5E9', // blue-400 / blue-500
        light: isDark ? '#93C5FD' : '#38BDF8', // blue-300 / blue-400
        dark: isDark ? '#3B82F6' : '#0284C7',  // blue-500 / blue-600
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: isDark ? '#E879F9' : '#D946EF', // fuchsia-400 / fuchsia-500
        light: isDark ? '#F0ABFC' : '#F0ABFC', // fuchsia-300
        dark: isDark ? '#C026D3' : '#C026D3',  // fuchsia-600
        contrastText: '#FFFFFF',
      },
      success: {
        main: isDark ? '#4ADE80' : '#22C55E', // green-400 / green-500
        contrastText: '#FFFFFF',
      },
      warning: {
        main: isDark ? '#FBBF24' : '#F59E0B', // amber-400 / amber-500
        contrastText: '#000000',
      },
      error: {
        main: isDark ? '#F87171' : '#EF4444', // red-400 / red-500
        contrastText: '#FFFFFF',
      },
      background: {
        default: isDark ? '#121212' : '#FFFFFF',  // Slightly lighter than 7% for MUI
        paper: isDark ? '#1A1A1A' : '#FFFFFF',    // Card backgrounds
      },
      text: {
        primary: isDark ? '#F9FAFB' : '#111827',     // gray-50 / gray-900
        secondary: isDark ? '#D4D4D8' : '#4B5563',   // gray-300 / gray-600
        disabled: isDark ? '#71717A' : '#9CA3AF',    // gray-500 / gray-400
      },
      divider: isDark ? '#27272A' : '#E5E7EB',       // gray-800 / gray-200
      action: {
        active: isDark ? '#F9FAFB' : '#111827',
        hover: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
        selected: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.08)',
        disabled: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.26)',
        disabledBackground: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
      },
    },
    typography: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontSize: 14,
      fontWeightLight: 300,
      fontWeightRegular: 400,
      fontWeightMedium: 500,
      fontWeightBold: 700,
      h1: {
        fontWeight: 700,
        fontSize: '2.5rem',
        lineHeight: 1.2,
      },
      h2: {
        fontWeight: 700,
        fontSize: '2rem',
        lineHeight: 1.3,
      },
      h3: {
        fontWeight: 600,
        fontSize: '1.75rem',
        lineHeight: 1.4,
      },
      h4: {
        fontWeight: 600,
        fontSize: '1.5rem',
        lineHeight: 1.4,
      },
      h5: {
        fontWeight: 600,
        fontSize: '1.25rem',
        lineHeight: 1.5,
      },
      h6: {
        fontWeight: 600,
        fontSize: '1rem',
        lineHeight: 1.5,
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.5,
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.43,
      },
      button: {
        textTransform: 'none', // Don't uppercase buttons
        fontWeight: 500,
      },
    },
    shape: {
      borderRadius: 8, // Matches our default border radius
    },
    shadows: [
      'none',
      isDark
        ? '0px 2px 4px rgba(0, 0, 0, 0.4)'
        : '0px 2px 4px rgba(0, 0, 0, 0.1)',
      isDark
        ? '0px 4px 8px rgba(0, 0, 0, 0.4)'
        : '0px 4px 8px rgba(0, 0, 0, 0.1)',
      isDark
        ? '0px 8px 16px rgba(0, 0, 0, 0.4)'
        : '0px 8px 16px rgba(0, 0, 0, 0.1)',
      // ... MUI expects 25 shadow values, simplified for brevity
      ...Array(21).fill(isDark
        ? '0px 8px 16px rgba(0, 0, 0, 0.4)'
        : '0px 8px 16px rgba(0, 0, 0, 0.1)'
      ),
    ],
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none', // Remove MUI's default gradient in dark mode
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
            fontWeight: 500,
            padding: '8px 16px',
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: `1px solid ${isDark ? '#27272A' : '#E5E7EB'}`,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            border: `1px solid ${isDark ? '#27272A' : '#E5E7EB'}`,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 16,
          },
        },
      },
    },
  });
};
