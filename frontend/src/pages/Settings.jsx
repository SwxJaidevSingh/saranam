import { Moon, Sun, Monitor, Type, Square, Layers, Accessibility, Eye } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { FONT_OPTIONS } from '../config/fonts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';

const Settings = () => {
  const {
    theme,
    isDark,
    toggleTheme,
    themeConfig,
    updateThemeConfig,
    font,
    borderRadius,
    density,
    reducedMotion,
    highContrast,
  } = useTheme();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your application preferences and appearance
        </p>
      </div>

      <div className="space-y-6">
        {/* Appearance Section */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Customize how the dashboard looks on your device
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Theme Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={`p-2 rounded-lg ${isDark ? 'bg-primary/10' : 'bg-secondary'}`}>
                  {isDark ? (
                    <Moon className="h-5 w-5 text-primary" />
                  ) : (
                    <Sun className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="dark-mode" className="text-base font-medium cursor-pointer">
                    Dark Mode
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {isDark ? 'Dark theme is enabled' : 'Light theme is enabled'}
                  </p>
                </div>
              </div>
              <Switch
                id="dark-mode"
                checked={isDark}
                onCheckedChange={toggleTheme}
              />
            </div>

            {/* Current Theme Info */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center space-x-2 text-sm">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Current theme: <span className="font-medium text-foreground">{theme === 'dark' ? 'Dark' : 'Light'}</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Your theme preference is saved and will persist across sessions.
                {!localStorage.getItem('theme') && ' Initially set based on your system preference.'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Typography Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5" />
              Typography
            </CardTitle>
            <CardDescription>
              Choose the font family for the application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.values(FONT_OPTIONS).map((fontOption) => (
                <button
                  key={fontOption.id}
                  onClick={() => updateThemeConfig({ font: fontOption.id })}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    font === fontOption.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-accent'
                  }`}
                >
                  <div className={`font-semibold text-foreground mb-1 ${fontOption.className}`}>
                    {fontOption.name}
                  </div>
                  <div className={`text-sm text-muted-foreground ${fontOption.className}`}>
                    The quick brown fox jumps
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Border Radius Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Square className="h-5 w-5" />
              Border Radius
            </CardTitle>
            <CardDescription>
              Adjust the roundness of UI elements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['none', 'small', 'medium', 'large'].map((radius) => (
                <button
                  key={radius}
                  onClick={() => updateThemeConfig({ borderRadius: radius })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    borderRadius === radius
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-accent'
                  }`}
                >
                  <div
                    className="w-12 h-12 bg-primary mx-auto mb-2"
                    style={{
                      borderRadius:
                        radius === 'none'
                          ? '0px'
                          : radius === 'small'
                          ? '0.25rem'
                          : radius === 'medium'
                          ? '0.5rem'
                          : '0.75rem',
                    }}
                  />
                  <div className="text-sm font-medium text-foreground capitalize">
                    {radius}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Density Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Density
            </CardTitle>
            <CardDescription>
              Control the spacing and padding of UI elements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {['compact', 'comfortable', 'spacious'].map((densityOption) => (
                <button
                  key={densityOption}
                  onClick={() => updateThemeConfig({ density: densityOption })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    density === densityOption
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-accent'
                  }`}
                >
                  <div className="text-sm font-medium text-foreground capitalize mb-2">
                    {densityOption}
                  </div>
                  <div className="space-y-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="bg-muted rounded"
                        style={{
                          height:
                            densityOption === 'compact'
                              ? '6px'
                              : densityOption === 'comfortable'
                              ? '8px'
                              : '10px',
                        }}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Accessibility Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Accessibility className="h-5 w-5" />
              Accessibility
            </CardTitle>
            <CardDescription>
              Customize accessibility features for better usability
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Reduced Motion */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-2 rounded-lg bg-secondary">
                  <Eye className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="reduced-motion" className="text-base font-medium cursor-pointer">
                    Reduce Motion
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Minimize animations and transitions
                  </p>
                </div>
              </div>
              <Switch
                id="reduced-motion"
                checked={reducedMotion}
                onCheckedChange={(checked) =>
                  updateThemeConfig({ reducedMotion: checked })
                }
              />
            </div>

            {/* High Contrast */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-2 rounded-lg bg-secondary">
                  <Sun className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="high-contrast" className="text-base font-medium cursor-pointer">
                    High Contrast
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Increase contrast for better visibility
                  </p>
                </div>
              </div>
              <Switch
                id="high-contrast"
                checked={highContrast}
                onCheckedChange={(checked) =>
                  updateThemeConfig({ highContrast: checked })
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
