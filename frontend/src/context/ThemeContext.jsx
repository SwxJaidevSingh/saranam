import { createContext, useContext, useEffect, useState } from 'react';
import { FONT_OPTIONS } from '../config/fonts';

const ThemeContext = createContext();

const detectSystemTheme = () => {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

const DEFAULT_CONFIG = {
  // Theme
  theme: detectSystemTheme(),

  // Typography
  font: 'inter',

  // Layout
  borderRadius: 'medium',
  density: 'comfortable',

  // Accessibility
  reducedMotion: false,
  highContrast: false,
};

export const ThemeProvider = ({ children }) => {
  const [themeConfig, setThemeConfig] = useState(() => {
    const stored = localStorage.getItem('themeConfig');
    if (stored) {
      try {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      } catch (e) {
        console.error('Failed to parse theme config:', e);
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  });

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;

    if (themeConfig.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [themeConfig.theme]);

  // Apply font configuration
  useEffect(() => {
    const root = document.documentElement;
    const font = FONT_OPTIONS[themeConfig.font];

    if (!font) return;

    // Load font if needed
    if (font.import && !document.getElementById(`font-${font.id}`)) {
      const link = document.createElement('link');
      link.id = `font-${font.id}`;
      link.rel = 'stylesheet';
      link.href = font.import;
      document.head.appendChild(link);
    }

    // Apply font family
    root.style.fontFamily = font.stack;
  }, [themeConfig.font]);

  // Apply border radius configuration
  useEffect(() => {
    document.documentElement.setAttribute('data-border-radius', themeConfig.borderRadius);
  }, [themeConfig.borderRadius]);

  // Apply density configuration
  useEffect(() => {
    document.documentElement.setAttribute('data-density', themeConfig.density);
  }, [themeConfig.density]);

  // Apply reduced motion
  useEffect(() => {
    if (themeConfig.reducedMotion) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }
  }, [themeConfig.reducedMotion]);

  // Apply high contrast
  useEffect(() => {
    if (themeConfig.highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }, [themeConfig.highContrast]);

  // Persist configuration to localStorage
  useEffect(() => {
    localStorage.setItem('themeConfig', JSON.stringify(themeConfig));
  }, [themeConfig]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e) => {
      // Only auto-switch if user hasn't manually set a preference
      const stored = localStorage.getItem('themeConfig');
      if (!stored) {
        setThemeConfig(prev => ({
          ...prev,
          theme: e.matches ? 'dark' : 'light',
        }));
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Update functions
  const updateThemeConfig = (updates) => {
    setThemeConfig(prev => ({ ...prev, ...updates }));
  };

  const toggleTheme = () => {
    setThemeConfig(prev => ({
      ...prev,
      theme: prev.theme === 'light' ? 'dark' : 'light',
    }));
  };

  const setLightTheme = () => updateThemeConfig({ theme: 'light' });
  const setDarkTheme = () => updateThemeConfig({ theme: 'dark' });

  const resetToDefaults = () => {
    setThemeConfig(DEFAULT_CONFIG);
  };

  const value = {
    // Current configuration
    themeConfig,
    theme: themeConfig.theme,
    font: themeConfig.font,
    borderRadius: themeConfig.borderRadius,
    density: themeConfig.density,
    reducedMotion: themeConfig.reducedMotion,
    highContrast: themeConfig.highContrast,

    // Computed values
    isDark: themeConfig.theme === 'dark',

    // Update functions
    updateThemeConfig,
    toggleTheme,
    setLightTheme,
    setDarkTheme,
    resetToDefaults,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
