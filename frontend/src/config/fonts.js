/**
 * Font Configuration
 * Defines available font options for the application theme
 */

export const FONT_OPTIONS = {
  inter: {
    id: 'inter',
    name: 'Inter',
    className: 'font-inter',
    import: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    stack: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  system: {
    id: 'system',
    name: 'System Default',
    className: 'font-system',
    import: null, // No import needed for system fonts
    stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  openSans: {
    id: 'open-sans',
    name: 'Open Sans',
    className: 'font-open-sans',
    import: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700&display=swap',
    stack: '"Open Sans", -apple-system, sans-serif',
  },
};

export const BORDER_RADIUS_OPTIONS = {
  none: { id: 'none', label: 'None' },
  small: { id: 'small', label: 'Small' },
  medium: { id: 'medium', label: 'Medium' },
  large: { id: 'large', label: 'Large' },
};

export const DENSITY_OPTIONS = {
  compact: { id: 'compact', label: 'Compact' },
  comfortable: { id: 'comfortable', label: 'Comfortable' },
  spacious: { id: 'spacious', label: 'Spacious' },
};
