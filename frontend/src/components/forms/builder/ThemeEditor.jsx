import { useState, useEffect } from 'react';
import { Palette, Type, Layout } from 'lucide-react';

/**
 * Theme Editor Component
 * Allows customization of form appearance
 */
export default function ThemeEditor({ theme = {}, onChange }) {
  const [formData, setFormData] = useState({
    primaryColor: theme.primaryColor || '#0ea5e9',
    backgroundColor: theme.backgroundColor || '#ffffff',
    textColor: theme.textColor || '#1f2937',
    fontFamily: theme.fontFamily || 'system',
    fontSize: theme.fontSize || 'medium',
    borderRadius: theme.borderRadius || 'medium',
    spacing: theme.spacing || 'comfortable',
    labelPosition: theme.labelPosition || 'top',
    ...theme
  });

  useEffect(() => {
    onChange(formData);
  }, [formData]);

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const colorPresets = [
    { name: 'Sky Blue', value: '#0ea5e9' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Orange', value: '#f59e0b' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Indigo', value: '#6366f1' },
  ];

  const fontFamilies = [
    { label: 'System Default', value: 'system' },
    { label: 'Sans Serif', value: 'sans-serif' },
    { label: 'Serif', value: 'serif' },
    { label: 'Monospace', value: 'monospace' },
  ];

  const fontSizes = [
    { label: 'Small', value: 'small' },
    { label: 'Medium', value: 'medium' },
    { label: 'Large', value: 'large' },
  ];

  const borderRadiusOptions = [
    { label: 'Sharp', value: 'none' },
    { label: 'Subtle', value: 'small' },
    { label: 'Medium', value: 'medium' },
    { label: 'Rounded', value: 'large' },
  ];

  const spacingOptions = [
    { label: 'Compact', value: 'compact' },
    { label: 'Comfortable', value: 'comfortable' },
    { label: 'Spacious', value: 'spacious' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Form Theme</h3>
        <p className="text-sm text-muted-foreground">Customize the appearance of your form</p>
      </div>

      {/* Colors Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-muted-foreground" />
          <h4 className="font-medium text-foreground">Colors</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Primary Color */}
          <div className="form-group">
            <label className="form-label">Primary Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.primaryColor}
                onChange={(e) => handleChange('primaryColor', e.target.value)}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={formData.primaryColor}
                onChange={(e) => handleChange('primaryColor', e.target.value)}
                className="input flex-1 font-mono text-sm"
                placeholder="#0ea5e9"
              />
            </div>
            <div className="flex gap-2 mt-2">
              {colorPresets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handleChange('primaryColor', preset.value)}
                  className="w-8 h-8 rounded border-2 border-border hover:border-muted-foreground"
                  style={{ backgroundColor: preset.value }}
                  title={preset.name}
                />
              ))}
            </div>
          </div>

          {/* Background Color */}
          <div className="form-group">
            <label className="form-label">Background Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.backgroundColor}
                onChange={(e) => handleChange('backgroundColor', e.target.value)}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={formData.backgroundColor}
                onChange={(e) => handleChange('backgroundColor', e.target.value)}
                className="input flex-1 font-mono text-sm"
                placeholder="#ffffff"
              />
            </div>
          </div>

          {/* Text Color */}
          <div className="form-group">
            <label className="form-label">Text Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.textColor}
                onChange={(e) => handleChange('textColor', e.target.value)}
                className="w-12 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={formData.textColor}
                onChange={(e) => handleChange('textColor', e.target.value)}
                className="input flex-1 font-mono text-sm"
                placeholder="#1f2937"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Typography Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Type className="w-5 h-5 text-muted-foreground" />
          <h4 className="font-medium text-foreground">Typography</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Font Family */}
          <div className="form-group">
            <label className="form-label">Font Family</label>
            <select
              value={formData.fontFamily}
              onChange={(e) => handleChange('fontFamily', e.target.value)}
              className="input"
            >
              {fontFamilies.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>

          {/* Font Size */}
          <div className="form-group">
            <label className="form-label">Font Size</label>
            <select
              value={formData.fontSize}
              onChange={(e) => handleChange('fontSize', e.target.value)}
              className="input"
            >
              {fontSizes.map((size) => (
                <option key={size.value} value={size.value}>
                  {size.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Layout Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Layout className="w-5 h-5 text-muted-foreground" />
          <h4 className="font-medium text-foreground">Layout</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Border Radius */}
          <div className="form-group">
            <label className="form-label">Border Radius</label>
            <select
              value={formData.borderRadius}
              onChange={(e) => handleChange('borderRadius', e.target.value)}
              className="input"
            >
              {borderRadiusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Spacing */}
          <div className="form-group">
            <label className="form-label">Spacing</label>
            <select
              value={formData.spacing}
              onChange={(e) => handleChange('spacing', e.target.value)}
              className="input"
            >
              {spacingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Label Position */}
          <div className="form-group">
            <label className="form-label">Label Position</label>
            <select
              value={formData.labelPosition}
              onChange={(e) => handleChange('labelPosition', e.target.value)}
              className="input"
            >
              <option value="top">Top</option>
              <option value="left">Left</option>
              <option value="inline">Inline</option>
            </select>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="border-t border-border pt-4">
        <h4 className="font-medium text-foreground mb-3">Preview</h4>
        <div
          className="p-6 rounded-lg border-2"
          style={{
            backgroundColor: formData.backgroundColor,
            color: formData.textColor,
            fontFamily: formData.fontFamily === 'system' ? undefined : formData.fontFamily,
            fontSize: formData.fontSize === 'small' ? '14px' : formData.fontSize === 'large' ? '18px' : '16px',
          }}
        >
          <div className="space-y-4">
            <div>
              <label
                className="block font-medium mb-2"
                style={{ color: formData.textColor }}
              >
                Sample Input Field
              </label>
              <input
                type="text"
                placeholder="Enter text..."
                className="w-full px-4 py-2 border-2"
                style={{
                  borderColor: formData.primaryColor,
                  borderRadius:
                    formData.borderRadius === 'none'
                      ? '0'
                      : formData.borderRadius === 'small'
                      ? '4px'
                      : formData.borderRadius === 'large'
                      ? '12px'
                      : '8px',
                }}
              />
            </div>
            <button
              className="px-6 py-2 text-white font-medium"
              style={{
                backgroundColor: formData.primaryColor,
                borderRadius:
                  formData.borderRadius === 'none'
                    ? '0'
                    : formData.borderRadius === 'small'
                    ? '4px'
                    : formData.borderRadius === 'large'
                    ? '12px'
                    : '8px',
              }}
            >
              Sample Button
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
