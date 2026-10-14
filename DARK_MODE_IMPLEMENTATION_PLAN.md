# Dark Mode Implementation Plan
## CV Raman Health Dashboard Application

**Created:** 2026-03-13
**Status:** In Progress
**Estimated Effort:** 120-140 hours (3-4 weeks)
**Priority:** High

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Files Requiring Changes](#files-requiring-changes)
3. [Hardcoded Color Analysis](#hardcoded-color-analysis)
4. [UI Library Dark Mode Strategies](#ui-library-dark-mode-strategies)
5. [UI/UX Design Recommendations](#uiux-design-recommendations)
6. [Theme Configuration Expansion](#theme-configuration-expansion)
7. [Index.css Refactoring](#indexcss-refactoring)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Testing Checklist](#testing-checklist)
10. [Risks & Mitigation](#risks--mitigation)
11. [Success Metrics](#success-metrics)

---

## Executive Summary

The CV Raman Health dashboard currently has a ThemeContext in place but **ALL 91 component files** still use hardcoded Tailwind colors. The application uses multiple UI libraries that each require different dark mode strategies. This is a **large-scale refactoring effort** affecting approximately 160 source files with over 31,000 lines of code.

### Current Status
✅ ThemeContext created
✅ CSS variables defined in `index.css`
✅ Tailwind dark mode enabled (`darkMode: ["class"]`)
✅ shadcn/ui components use semantic tokens
❌ All pages use hardcoded colors (`bg-white`, `text-gray-900`, etc.)
❌ UI libraries not integrated with dark mode
❌ Limited theme customization options

### Goals
- Convert **1,300+ hardcoded color instances** to semantic tokens
- Integrate **4 UI libraries** with dark mode support
- Add **comprehensive theme customization** (font, border radius, density, accessibility)
- Achieve **WCAG AAA accessibility** compliance
- Maintain visual consistency across light/dark modes

---

## Files Requiring Changes

### Summary Statistics
- **Total Files:** 91+ component files
- **Total Color Instances:** ~1,300
- **Most Common:** `text-gray-600` (299×), `text-gray-900` (235×), `bg-white` (114×)

### Breakdown by Category

#### A. PAGES (15 files)

| File | Lines | Color Instances | Priority |
|------|-------|-----------------|----------|
| `src/pages/Dashboard.jsx` | 222 | 23 | Critical |
| `src/pages/Analytics.jsx` | 296 | 18 | High |
| `src/pages/Settings.jsx` | 76 | 5 | Medium |
| `src/pages/PublicFormView.jsx` | - | 12 | Medium |
| **IPD Module** | | | |
| `src/pages/ipd/IPDDashboard.jsx` | - | 15 | High |
| `src/pages/ipd/BedManagement.jsx` | - | 20 | High |
| `src/pages/ipd/AdmissionsList.jsx` | - | 18 | High |
| `src/pages/ipd/WaitingList.jsx` | - | 12 | Medium |
| **Services Module** | | | |
| `src/pages/services/ServiceLanding.jsx` | - | 16 | High |
| `src/pages/services/ServiceDashboard.jsx` | - | 19 | High |
| `src/pages/services/ServiceBookingWizard.jsx` | - | 22 | High |
| `src/pages/services/new-booking/NewServiceBookingWizard.jsx` | - | 25 | High |

#### B. LAYOUT COMPONENTS (1 file)

| File | Status | Notes |
|------|--------|-------|
| `src/components/layout/DashboardLayout.jsx` | ✅ Mostly Done | Already uses semantic tokens, minor adjustments needed |

#### C. UI COMPONENTS (24 files)

| Directory | Status | Notes |
|-----------|--------|-------|
| `src/components/ui/*` | ✅ Good | shadcn/ui components already use semantic tokens |

#### D. FORM COMPONENTS (20 files)

| Component Type | Files | Priority |
|----------------|-------|----------|
| Form Rendering | FormRenderer.jsx, FormShare.jsx, TemplateBrowser.jsx | Critical |
| Form Builder | FormCanvas.jsx, FieldPalette.jsx, FieldPropertyEditor.jsx | Critical |
| Theme System | **ThemeEditor.jsx** | Critical |
| Form Fields | PainScaleField, FileUploadField, etc. (7 files) | High |
| Logic & Validation | ConditionalLogicBuilder.jsx, etc. | Medium |

#### E. FEATURE-SPECIFIC COMPONENTS (27 files)

**Appointments (5 files)**
- `AppointmentCalendar.jsx` + `AppointmentCalendar.css` - **399 lines, custom CSS**
- AppointmentCard, AppointmentList, AppointmentDetailsModal, AppointmentBookingForm

**Patients (6 files)** - Uses Material-UI!
- PatientCard.jsx, PatientSearch.jsx, PatientSelector.jsx, etc.

**IPD (7 files)**
- AdmissionWizard, VitalsRecordingForm, BedAssignDialog, etc.

**Analytics (6 files)** - Uses Recharts
- StatCard, FormAnalysisView, PatientAnalysisView, etc.

**Others**
- Cohorts, AI, Bulk Import, Submissions components

#### F. UTILITY & CSS FILES

| File | Changes Needed |
|------|----------------|
| `src/index.css` | 35+ hardcoded color instances in utility classes |
| `src/components/appointments/AppointmentCalendar.css` | Complete CSS variable refactoring (288 lines) |
| `src/utils/serviceColors.js` | Service type color mappings for dark mode |

---

## Hardcoded Color Analysis

### Top 10 Hardcoded Colors by Frequency

| Hardcoded Class | Occurrences | Semantic Replacement | Use Case |
|-----------------|-------------|----------------------|----------|
| `text-gray-600` | 299 | `text-muted-foreground` | Secondary text, labels |
| `text-gray-900` | 235 | `text-foreground` | Primary text, headings |
| `text-gray-500` | 152 | `text-muted-foreground` (lighter variant) | Tertiary text, placeholders |
| `text-gray-700` | 128 | `text-foreground` (slightly muted) | Body text |
| `bg-white` | 114 | `bg-background` or `bg-card` | Backgrounds |
| `border-gray-300` | 96 | `border-border` | Standard borders |
| `border-gray-200` | 92 | `border-border` | Subtle borders |
| `text-gray-400` | 83 | `text-muted-foreground/70` | Very subtle text |
| `bg-gray-50` | 75 | `bg-secondary` | Subtle backgrounds |
| `bg-gray-100` | 54 | `bg-accent` | Hover states, active items |

### Complete Semantic Token Mapping

```css
/* Current CSS Variables (in index.css) */
:root {
  --background: 0 0% 100%;          /* #FFFFFF */
  --foreground: 0 0% 3.9%;          /* #0A0A0A */
  --card: 0 0% 100%;                /* #FFFFFF */
  --card-foreground: 0 0% 3.9%;     /* #0A0A0A */
  --primary: 0 0% 9%;               /* #171717 */
  --primary-foreground: 0 0% 98%;   /* #FAFAFA */
  --secondary: 0 0% 96.1%;          /* #F5F5F5 */
  --secondary-foreground: 0 0% 9%;  /* #171717 */
  --muted: 0 0% 96.1%;              /* #F5F5F5 */
  --muted-foreground: 0 0% 45.1%;   /* #737373 */
  --accent: 0 0% 96.1%;             /* #F5F5F5 */
  --accent-foreground: 0 0% 9%;     /* #171717 */
  --border: 0 0% 89.8%;             /* #E5E5E5 */
  --input: 0 0% 89.8%;              /* #E5E5E5 */
  --ring: 0 0% 3.9%;                /* #0A0A0A */
}

.dark {
  --background: 0 0% 3.9%;          /* #0A0A0A */
  --foreground: 0 0% 98%;           /* #FAFAFA */
  --card: 0 0% 3.9%;                /* #0A0A0A */
  --card-foreground: 0 0% 98%;      /* #FAFAFA */
  --primary: 0 0% 98%;              /* #FAFAFA */
  --primary-foreground: 0 0% 9%;    /* #171717 */
  --secondary: 0 0% 14.9%;          /* #262626 */
  --secondary-foreground: 0 0% 98%; /* #FAFAFA */
  --muted: 0 0% 14.9%;              /* #262626 */
  --muted-foreground: 0 0% 63.9%;   /* #A3A3A3 */
  --accent: 0 0% 14.9%;             /* #262626 */
  --accent-foreground: 0 0% 98%;    /* #FAFAFA */
  --border: 0 0% 14.9%;             /* #262626 */
  --input: 0 0% 14.9%;              /* #262626 */
  --ring: 0 0% 83.1%;               /* #D4D4D4 */
}
```

### Recommended Refinements

The current dark mode values are **too dark** (background is near-black). Recommend updating for better readability:

```css
.dark {
  --background: 0 0% 7%;            /* #121212 - Slightly lighter */
  --card: 0 0% 10%;                 /* #1A1A1A - Elevated from background */
  --secondary: 0 0% 15%;            /* #262626 */
  --accent: 0 0% 20%;               /* #333333 - More visible hover */
  --border: 0 0% 20%;               /* #333333 - Visible borders */
  --muted-foreground: 0 0% 70%;     /* #B3B3B3 - Better contrast */
}
```

---

## UI Library Dark Mode Strategies

### 1. Material-UI (@mui/material)
**Affected Files:** 13 files (patient components, bulk import)

**Current Issue:** MUI components don't respect Tailwind dark mode

**Solution:** Create MUI theme wrapper

```javascript
// src/theme/muiTheme.js
import { createTheme } from '@mui/material/styles';
import { useTheme } from '../context/ThemeContext';

export const useMuiTheme = () => {
  const { isDark } = useTheme();

  return createTheme({
    palette: {
      mode: isDark ? 'dark' : 'light',
      primary: {
        main: isDark ? '#60A5FA' : '#0EA5E9', // blue-400 / blue-500
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: isDark ? '#E879F9' : '#D946EF', // fuchsia-400 / fuchsia-500
      },
      background: {
        default: isDark ? '#0A0A0A' : '#FFFFFF',
        paper: isDark ? '#18181B' : '#FFFFFF',
      },
      text: {
        primary: isDark ? '#F9FAFB' : '#111827',
        secondary: isDark ? '#D4D4D8' : '#4B5563',
      },
      divider: isDark ? '#27272A' : '#E5E7EB',
    },
    typography: {
      fontFamily: 'Inter, sans-serif',
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none', // Remove MUI default gradient
          },
        },
      },
    },
  });
};
```

**Implementation:**
```jsx
// src/App.jsx
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useMuiTheme } from './theme/muiTheme';

function AppContent() {
  const muiTheme = useMuiTheme();

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      {/* Rest of app */}
    </MuiThemeProvider>
  );
}
```

**Files to Update:**
- PatientCard.jsx, PatientSearch.jsx, PatientSelector.jsx
- PatientQuickAdd.jsx, PatientFormFields.jsx
- All bulk import components (6 files)

---

### 2. AG Grid (ag-grid-react)
**Affected Files:** 4 files (bed management, admissions, appointments, submissions)

**Current Issue:** Uses `ag-theme-quartz` with hardcoded colors

**Solution:** Dynamic theme switching

```jsx
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { useTheme } from '../context/ThemeContext';

function BedManagement() {
  const { isDark } = useTheme();

  return (
    <div className={isDark ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'} style={{ height: 600 }}>
      <AgGridReact {...gridProps} />
    </div>
  );
}
```

**Advanced: CSS Variable Override** (AG Grid 32+)
```css
/* index.css */
.ag-theme-quartz {
  --ag-background-color: hsl(var(--background));
  --ag-foreground-color: hsl(var(--foreground));
  --ag-border-color: hsl(var(--border));
  --ag-header-background-color: hsl(var(--secondary));
  --ag-odd-row-background-color: hsl(var(--secondary) / 0.3);
  --ag-row-hover-color: hsl(var(--accent));
}
```

**Files to Update:**
- BedManagement.jsx
- AdmissionsList.jsx
- AppointmentPreviewGrid.jsx
- SubmissionDataGrid.jsx

---

### 3. Recharts (recharts)
**Affected Files:** 22 files (analytics, vitals, dashboard stats)

**Current Issue:** Hardcoded chart colors

**Solution:** Already partially implemented in `chart.jsx`!

```jsx
// src/components/ui/chart.jsx already has theme support
const THEMES = { light: "", dark: ".dark" }

// Usage in components:
const chartConfig = {
  submissions: {
    label: "Submissions",
    theme: {
      light: "#0EA5E9", // blue-500
      dark: "#60A5FA",  // blue-400 (lighter for dark mode)
    }
  },
  patients: {
    label: "Patients",
    theme: {
      light: "#D946EF", // fuchsia-500
      dark: "#E879F9",  // fuchsia-400
    }
  }
}
```

**Chart Color Palettes:**

**Light Mode:**
```javascript
const LIGHT_COLORS = [
  '#0EA5E9', // blue-500
  '#D946EF', // fuchsia-500
  '#22C55E', // green-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // purple-500
];
```

**Dark Mode (lighter variants):**
```javascript
const DARK_COLORS = [
  '#60A5FA', // blue-400
  '#E879F9', // fuchsia-400
  '#4ADE80', // green-400
  '#FBBF24', // amber-400
  '#F87171', // red-400
  '#A78BFA', // purple-400
];
```

**Components Needing Updates:**
- Analytics.jsx - Replace hardcoded COLORS array
- All stat cards (6 files)
- Vitals charts (3 files)
- Dashboard charts

**Additional Changes:**
```jsx
// CartesianGrid stroke
<CartesianGrid strokeDasharray="3 3" className="stroke-border" />

// Tooltip styling
<Tooltip
  contentStyle={{
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    color: 'hsl(var(--foreground))',
  }}
/>
```

---

### 4. React Big Calendar (react-big-calendar)
**Affected Files:** 1 file + CSS (AppointmentCalendar.jsx + .css)

**Current Issue:** 288 lines of custom CSS with hardcoded colors

**Solution:** CSS variable refactoring

```css
/* AppointmentCalendar.css - Add at top */
:root {
  /* Calendar Colors */
  --calendar-bg: #ffffff;
  --calendar-border: #e5e7eb;
  --calendar-text: #1f2937;
  --calendar-text-light: #6b7280;
  --calendar-header-bg: #f9fafb;
  --calendar-today-bg: #eff6ff;
  --calendar-selected-bg: #dbeafe;
  --calendar-off-range: #fafafa;
  --calendar-hover: #f3f4f6;
  --calendar-event-bg: #3b82f6;
  --calendar-event-border: #2563eb;
}

.dark {
  /* Dark Mode Calendar */
  --calendar-bg: #0a0a0a;
  --calendar-border: #262626;
  --calendar-text: #f9fafb;
  --calendar-text-light: #a3a3a3;
  --calendar-header-bg: #18181b;
  --calendar-today-bg: #1e293b;
  --calendar-selected-bg: #1e40af;
  --calendar-off-range: #050505;
  --calendar-hover: #27272a;
  --calendar-event-bg: #3b82f6;
  --calendar-event-border: #60a5fa;
}

/* Then replace all instances */
.rbc-calendar {
  background-color: var(--calendar-bg);
  color: var(--calendar-text);
}

.rbc-toolbar {
  background-color: var(--calendar-header-bg);
  border-bottom: 1px solid var(--calendar-border);
}

.rbc-header {
  border-bottom: 1px solid var(--calendar-border);
  color: var(--calendar-text-light);
  background-color: var(--calendar-header-bg);
}

.rbc-off-range-bg {
  background: var(--calendar-off-range);
}

.rbc-today {
  background-color: var(--calendar-today-bg);
}

.rbc-event {
  background-color: var(--calendar-event-bg);
  border: 1px solid var(--calendar-event-border);
}

/* ... and so on for all 288 lines */
```

**Estimated Effort:** 6-8 hours for complete CSS refactoring

---

### 5. Radix UI
**Status:** ✅ Already compatible!

All Radix UI components use semantic tokens correctly:
- Dialog, Dropdown, Popover, Select, etc.
- No changes needed

---

## UI/UX Design Recommendations

### Color Hierarchy Strategy

#### Light Mode
```
┌─────────────────────────────────────┐
│ bg-background (#FFFFFF)             │  ← Page background
│  ┌───────────────────────────────┐  │
│  │ bg-card (#FFFFFF)             │  │  ← Cards (same as bg)
│  │                               │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ bg-accent (#F3F4F6)     │  │  │  ← Hover states
│  │  └─────────────────────────┘  │  │
│  │                               │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

#### Dark Mode (Elevated Design)
```
┌─────────────────────────────────────┐
│ bg-background (#0A0A0A)             │  ← Dark page background
│  ┌───────────────────────────────┐  │
│  │ bg-card (#18181B)             │  │  ← Elevated cards
│  │                               │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ bg-accent (#3F3F46)     │  │  │  ← Visible hovers
│  │  └─────────────────────────┘  │  │
│  │                               │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Key Principle:** Dark mode uses elevation (lighter cards on dark background), while light mode is flat.

---

### Border Strategy

**Light Mode:** Subtle, minimal borders
```css
border-border: hsl(0 0% 89.8%)  /* #E5E5E5 - barely visible */
```

**Dark Mode:** More prominent borders for definition
```css
border-border: hsl(0 0% 20%)  /* #333333 - clearly visible */
```

**Usage:**
- Use `border-border` everywhere
- For very subtle dividers: `border-border/50`
- Never use `border-gray-*` directly

---

### Button Hover States

**Current Issue:** Buttons use hardcoded gradients

**Recommendation:**
```jsx
// Primary Button
<button className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">

// Secondary Button
<button className="bg-secondary text-secondary-foreground hover:bg-secondary/80">

// Ghost Button
<button className="hover:bg-accent hover:text-accent-foreground">

// Danger Button
<button className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
```

**Gradient Buttons (for special cases):**
```css
/* index.css - Add dark mode variants */
.btn-gradient {
  @apply bg-gradient-to-r from-primary-500 to-primary-600;
}

.dark .btn-gradient {
  @apply from-primary-400 to-primary-500; /* Lighter in dark mode */
}
```

---

### Input Field Styling

**Light Mode:**
```jsx
<input className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:ring-ring" />
```

**Dark Mode:** Slightly elevated
```jsx
<input className="bg-card border-border text-foreground ..." />
```

**Disabled State:**
```jsx
<input className="... disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed" />
```

---

### Table/Grid Styling

**Header:**
```jsx
<thead className="bg-secondary border-b border-border">
  <th className="text-muted-foreground font-medium">Column</th>
</thead>
```

**Body:**
```jsx
<tbody>
  <tr className="border-b border-border hover:bg-accent transition-colors">
    <td className="text-foreground">Cell</td>
  </tr>
</tbody>
```

**Zebra Striping:**
```jsx
<tr className="even:bg-secondary/50 hover:bg-accent">
```

---

### Chart Color Accessibility

**Ensure Distinctiveness:**
- Use different hues, not just shades
- Test with colorblind simulators
- Add patterns/textures for critical data

**Medical Data Charts (Vitals):**
- Heart Rate: Red (#EF4444 light, #F87171 dark)
- Blood Pressure: Blue (#0EA5E9 light, #60A5FA dark)
- Temperature: Orange (#F59E0B light, #FBBF24 dark)
- Oxygen: Green (#22C55E light, #4ADE80 dark)

---

## Theme Configuration Expansion

### Current Implementation
```jsx
// src/context/ThemeContext.jsx (current)
const [theme, setTheme] = useState('light'); // Only theme switching
```

### Expanded Configuration

```jsx
// src/context/ThemeContext.jsx (new)
const [themeConfig, setThemeConfig] = useState(() => {
  const stored = localStorage.getItem('themeConfig');
  if (stored) return JSON.parse(stored);

  return {
    // Theme
    theme: detectSystemTheme(), // 'light' | 'dark' | 'system'

    // Typography
    font: 'inter', // 'inter' | 'system' | 'open-sans'
    fontSize: 'medium', // 'small' | 'medium' | 'large'

    // Layout
    borderRadius: 'medium', // 'none' | 'small' | 'medium' | 'large'
    density: 'comfortable', // 'compact' | 'comfortable' | 'spacious'

    // Accessibility
    reducedMotion: false,
    highContrast: false,
    focusIndicators: 'enhanced', // 'default' | 'enhanced'
  };
});
```

---

### Font System

**Font Options:**

```javascript
// src/config/fonts.js
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
    import: null,
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
```

**Implementation:**

```jsx
// ThemeContext.jsx
useEffect(() => {
  const root = document.documentElement;
  const font = FONT_OPTIONS[themeConfig.font];

  // Load font if needed
  if (font.import && !document.getElementById(`font-${font.id}`)) {
    const link = document.createElement('link');
    link.id = `font-${font.id}`;
    link.rel = 'stylesheet';
    link.href = font.import;
    document.head.appendChild(link);
  }

  // Apply font class
  root.style.fontFamily = font.stack;
  root.className = `${themeConfig.theme === 'dark' ? 'dark' : ''} ${font.className}`;
}, [themeConfig.font, themeConfig.theme]);
```

**Tailwind Config:**

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        system: ['-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        'open-sans': ['"Open Sans"', 'sans-serif'],
      },
    },
  },
};
```

---

### Border Radius System

**CSS Variables Approach:**

```css
/* index.css */
:root {
  --radius-sm: 0.25rem;  /* 4px */
  --radius: 0.5rem;      /* 8px - default */
  --radius-md: 0.5rem;   /* 8px */
  --radius-lg: 0.75rem;  /* 12px */
  --radius-xl: 1rem;     /* 16px */
}

/* When borderRadius = 'none' */
[data-border-radius="none"] {
  --radius-sm: 0;
  --radius: 0;
  --radius-md: 0;
  --radius-lg: 0;
  --radius-xl: 0;
}

/* When borderRadius = 'small' */
[data-border-radius="small"] {
  --radius-sm: 0.125rem;  /* 2px */
  --radius: 0.25rem;      /* 4px */
  --radius-md: 0.375rem;  /* 6px */
  --radius-lg: 0.5rem;    /* 8px */
  --radius-xl: 0.75rem;   /* 12px */
}

/* When borderRadius = 'large' */
[data-border-radius="large"] {
  --radius-sm: 0.375rem;  /* 6px */
  --radius: 0.75rem;      /* 12px */
  --radius-md: 1rem;      /* 16px */
  --radius-lg: 1.25rem;   /* 20px */
  --radius-xl: 1.5rem;    /* 24px */
}
```

**Implementation:**

```jsx
// ThemeContext.jsx
useEffect(() => {
  document.documentElement.setAttribute('data-border-radius', themeConfig.borderRadius);
}, [themeConfig.borderRadius]);
```

---

### Density System

**Spacing Multipliers:**

```css
:root {
  --spacing-multiplier: 1;
}

[data-density="compact"] {
  --spacing-multiplier: 0.75;
}

[data-density="spacious"] {
  --spacing-multiplier: 1.25;
}
```

**Usage in Components:**

```jsx
// Instead of fixed padding
<div className="p-6">  /* Fixed - bad */

// Use calculated spacing
<div style={{ padding: `calc(1.5rem * var(--spacing-multiplier))` }}>  /* Dynamic */

// Or create utility classes
.density-padding {
  padding: calc(1.5rem * var(--spacing-multiplier));
}
```

---

### Accessibility Features

#### Reduced Motion

```jsx
// ThemeContext.jsx
useEffect(() => {
  if (themeConfig.reducedMotion) {
    document.documentElement.classList.add('reduce-motion');
  } else {
    document.documentElement.classList.remove('reduce-motion');
  }
}, [themeConfig.reducedMotion]);
```

```css
/* index.css */
.reduce-motion *,
.reduce-motion *::before,
.reduce-motion *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}
```

#### High Contrast Mode

```css
.dark.high-contrast {
  --background: 0 0% 0%;      /* Pure black */
  --foreground: 0 0% 100%;    /* Pure white */
  --border: 0 0% 40%;         /* Stronger borders */
  --muted-foreground: 0 0% 80%; /* Brighter muted text */
}

.high-contrast {
  --background: 0 0% 100%;    /* Pure white */
  --foreground: 0 0% 0%;      /* Pure black */
  --border: 0 0% 20%;         /* Darker borders */
}
```

#### Enhanced Focus Indicators

```css
.focus-enhanced *:focus-visible {
  outline: 3px solid hsl(var(--ring));
  outline-offset: 2px;
}
```

---

### Settings UI Components

**Create:** `src/components/ui/theme-config-panel.jsx`

```jsx
import { useTheme } from '../../context/ThemeContext';

export function ThemeConfigPanel() {
  const { themeConfig, updateThemeConfig } = useTheme();

  return (
    <div className="space-y-6">
      {/* Font Selection */}
      <div>
        <Label>Font Family</Label>
        <Select value={themeConfig.font} onValueChange={(font) => updateThemeConfig({ font })}>
          <SelectItem value="inter">Inter (Recommended)</SelectItem>
          <SelectItem value="system">System Default</SelectItem>
          <SelectItem value="open-sans">Open Sans</SelectItem>
        </Select>
      </div>

      {/* Border Radius */}
      <div>
        <Label>Border Radius</Label>
        <RadioGroup value={themeConfig.borderRadius} onValueChange={(borderRadius) => updateThemeConfig({ borderRadius })}>
          <RadioGroupItem value="none">None</RadioGroupItem>
          <RadioGroupItem value="small">Small</RadioGroupItem>
          <RadioGroupItem value="medium">Medium</RadioGroupItem>
          <RadioGroupItem value="large">Large</RadioGroupItem>
        </RadioGroup>
      </div>

      {/* Density */}
      <div>
        <Label>Spacing Density</Label>
        <RadioGroup value={themeConfig.density} onValueChange={(density) => updateThemeConfig({ density })}>
          <RadioGroupItem value="compact">Compact</RadioGroupItem>
          <RadioGroupItem value="comfortable">Comfortable</RadioGroupItem>
          <RadioGroupItem value="spacious">Spacious</RadioGroupItem>
        </RadioGroup>
      </div>

      {/* Accessibility */}
      <div>
        <Label>Accessibility</Label>
        <Switch checked={themeConfig.reducedMotion} onCheckedChange={(reducedMotion) => updateThemeConfig({ reducedMotion })}>
          Reduce Motion
        </Switch>
        <Switch checked={themeConfig.highContrast} onCheckedChange={(highContrast) => updateThemeConfig({ highContrast })}>
          High Contrast
        </Switch>
      </div>
    </div>
  );
}
```

---

## Index.css Refactoring

### Current Issues (35+ instances)

**Lines 82-86:** Scrollbar
```css
/* Before */
.custom-scrollbar::-webkit-scrollbar-track {
  @apply bg-gray-100 rounded;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  @apply bg-gray-300 rounded;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  @apply bg-gray-400;
}

/* After */
.custom-scrollbar::-webkit-scrollbar-track {
  @apply bg-secondary rounded;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  @apply bg-muted-foreground/30 rounded;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  @apply bg-muted-foreground/50;
}
```

**Lines 99-104:** Buttons
```css
/* Before */
.btn-secondary {
  @apply px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300;
}

/* After */
.btn-secondary {
  @apply px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80;
}
```

**Lines 115-118:** Ghost Button
```css
/* Before */
.btn-ghost {
  @apply px-4 py-2 text-gray-700 rounded-lg hover:bg-gray-100;
}

/* After */
.btn-ghost {
  @apply px-4 py-2 text-foreground rounded-lg hover:bg-accent hover:text-accent-foreground;
}
```

**Lines 120-127:** Input Fields
```css
/* Before */
.input {
  @apply w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900;
}
.input:disabled {
  @apply bg-gray-100 cursor-not-allowed;
}

/* After */
.input {
  @apply w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground;
}
.input:disabled {
  @apply bg-muted text-muted-foreground cursor-not-allowed;
}
```

**Lines 129-132:** Cards
```css
/* Before */
.card {
  @apply bg-white rounded-xl shadow-soft border border-gray-200 p-6;
}

/* After */
.card {
  @apply bg-card rounded-xl shadow-soft border border-border p-6;
}
```

**Lines 158-165:** Badges
```css
/* Before */
.badge-gray {
  @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800;
}

/* After */
.badge-gray {
  @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground;
}
```

**Lines 167-171:** Tables
```css
/* Before */
.table-header {
  @apply bg-gray-50 text-gray-500 text-xs font-medium uppercase tracking-wider;
}
.table-cell {
  @apply px-6 py-4 text-sm text-gray-900 border-b border-gray-200;
}

/* After */
.table-header {
  @apply bg-secondary text-muted-foreground text-xs font-medium uppercase tracking-wider;
}
.table-cell {
  @apply px-6 py-4 text-sm text-foreground border-b border-border;
}
```

**Lines 189-195:** Form Labels
```css
/* Before */
.form-label {
  @apply block text-sm font-medium text-gray-700 mb-1;
}
.form-help {
  @apply mt-1 text-sm text-gray-500;
}

/* After */
.form-label {
  @apply block text-sm font-medium text-foreground mb-1;
}
.form-help {
  @apply mt-1 text-sm text-muted-foreground;
}
```

**Lines 202-209:** Modals
```css
/* Before */
.modal-overlay {
  @apply fixed inset-0 bg-black bg-opacity-50 z-50;
}
.modal-content {
  @apply bg-white rounded-xl p-6 max-w-md w-full;
}

/* After */
.modal-overlay {
  @apply fixed inset-0 bg-black/50 z-50; /* bg-opacity-50 = /50 */
}
.modal-content {
  @apply bg-card rounded-xl p-6 max-w-md w-full border border-border;
}
```

**Lines 211-214:** Tooltips
```css
/* Before */
.tooltip {
  @apply absolute z-10 px-2 py-1 text-xs bg-gray-900 text-white rounded;
}

/* After */
.tooltip {
  @apply absolute z-10 px-2 py-1 text-xs bg-popover text-popover-foreground rounded border border-border;
}
```

### Complete Refactoring Checklist

- [ ] Lines 82-86: Scrollbar (3 instances)
- [ ] Lines 99-104: Secondary button (2 instances)
- [ ] Lines 105-109: Outline button (2 instances)
- [ ] Lines 115-118: Ghost button (2 instances)
- [ ] Lines 120-127: Input fields (4 instances)
- [ ] Lines 129-132: Card (2 instances)
- [ ] Lines 134-137: Alert (2 instances)
- [ ] Lines 139-142: Dropdown (3 instances)
- [ ] Lines 158-165: Badge variants (6 instances)
- [ ] Lines 167-171: Table header/cell (4 instances)
- [ ] Lines 189-195: Form labels/help (2 instances)
- [ ] Lines 202-209: Modal overlay/content (2 instances)
- [ ] Lines 211-214: Tooltip (1 instance)

**Total:** 35+ instances across 15 component classes

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1) - 15 hours

#### Day 1-2: CSS & Theme Core (8 hours)
- [ ] **Refine CSS variables in index.css** (2 hours)
  - Update dark mode values for better contrast
  - Test with WCAG AAA contrast checker
  - Document color decisions

- [ ] **Refactor index.css utility classes** (4 hours)
  - Update all 35 instances
  - Test each utility class in both modes
  - Create visual regression snapshots

- [ ] **Expand ThemeContext** (2 hours)
  - Add full config object (font, borderRadius, density, accessibility)
  - Implement localStorage persistence
  - Create helper functions (updateThemeConfig, resetToDefaults)

#### Day 3: UI Library Integration (7 hours)
- [ ] **Create MUI theme wrapper** (3 hours)
  - Build `src/theme/muiTheme.js`
  - Integrate with ThemeContext
  - Wrap App.jsx with MUI ThemeProvider
  - Test PatientCard component

- [ ] **AG Grid theme setup** (2 hours)
  - Add dynamic theme class switching
  - Test in BedManagement.jsx
  - Verify data visibility in dark mode

- [ ] **Font system implementation** (2 hours)
  - Create `src/config/fonts.js`
  - Add font loading logic to ThemeContext
  - Update Tailwind config
  - Test font switching

---

### Phase 2: Core Components (Week 1-2) - 20 hours

#### Day 4-5: Layout & Dashboard (8 hours)
- [ ] **Update Dashboard.jsx** (4 hours)
  - Replace 23 color instances
  - Test stat cards, quick actions
  - Verify chart visibility

- [ ] **Expand Settings.jsx** (4 hours)
  - Create ThemeConfigPanel component
  - Add font selector UI
  - Add border radius selector
  - Add density controls
  - Add accessibility toggles (reduced motion, high contrast)
  - Test all theme changes persist

#### Day 6-8: Form System (12 hours)
- [ ] **FormRenderer.jsx** (3 hours)
  - Large file with many color instances
  - Test all field types in both modes

- [ ] **FormBuilder components** (6 hours)
  - FormCanvas, FieldPalette, FieldPropertyEditor
  - **ThemeEditor.jsx** - Critical integration with app theme
  - Test drag-and-drop in dark mode

- [ ] **Form field components** (3 hours)
  - PainScaleField, FileUploadField, etc. (7 files)
  - Test validation states visibility

---

### Phase 3: Feature Modules (Week 2-3) - 32 hours

#### Day 9-10: IPD Module (8 hours)
- [ ] **IPD Pages** (4 hours)
  - IPDDashboard.jsx
  - BedManagement.jsx (complex gradients)
  - AdmissionsList.jsx
  - WaitingList.jsx

- [ ] **IPD Components** (4 hours)
  - AdmissionWizard (7 steps)
  - VitalsRecordingForm
  - BedAssignDialog
  - Test AG Grid integration in admissions list

#### Day 11-12: Services Module (8 hours)
- [ ] **Service Pages** (5 hours)
  - ServiceLanding, ServiceDashboard
  - ServiceBookingWizard, NewServiceBookingWizard
  - ServicesList, MyServiceBookings

- [ ] **Service Components** (3 hours)
  - ServiceTypeCard - Update color coding
  - ServiceBookingWizard steps (6 files)
  - Test service type differentiation in dark mode

#### Day 13-14: Appointments Module (8 hours)
- [ ] **AppointmentCalendar.css refactoring** (6 hours)
  - Convert 288 lines to CSS variables
  - Test month/week/day views
  - Test event creation/editing
  - Ensure hover states work

- [ ] **Appointment Components** (2 hours)
  - AppointmentCard, AppointmentList
  - AppointmentDetailsModal, AppointmentBookingForm
  - Test calendar integration

#### Day 15-16: Patient Components (8 hours)
- [ ] **MUI Component Integration** (6 hours)
  - PatientCard.jsx (heavy MUI usage)
  - PatientSearch.jsx
  - PatientSelector.jsx
  - PatientQuickAdd.jsx
  - PatientFormFields.jsx
  - Test all MUI components respect theme

- [ ] **Patient Pages** (2 hours)
  - PatientsList.jsx
  - PatientDetail.jsx
  - Test data visibility, search functionality

---

### Phase 4: Analytics & Charts (Week 3) - 14 hours

#### Day 17-18: Charts & Analytics (10 hours)
- [ ] **Update Analytics.jsx** (3 hours)
  - Replace hardcoded COLORS array
  - Implement dynamic color selection
  - Test all chart types

- [ ] **Analytics Components** (4 hours)
  - StatCard, FormAnalysisView, PatientAnalysisView
  - CohortAnalytics, ServiceAnalytics, EngagementMetrics
  - Update Recharts configurations

- [ ] **Chart Component Standardization** (3 hours)
  - Ensure all charts use `chartConfig` with theme
  - Update CartesianGrid, Tooltip styling
  - Test legend visibility

#### Day 19: Medical Charts (4 hours)
- [ ] **Vitals Charts** (4 hours)
  - VitalsHistoryChart
  - VitalsTrendAnalysis
  - Ensure medical data clearly visible
  - Test color distinctiveness for vitals (HR, BP, Temp, O2)

---

### Phase 5: Remaining Components (Week 4) - 18 hours

#### Day 20-21: Feature Modules (12 hours)
- [ ] **Cohorts Module** (4 hours)
  - CohortsList, CohortBuilder, CohortDetail
  - CohortCard, CohortMemberList
  - Test cohort criteria builder

- [ ] **Submissions Module** (3 hours)
  - SubmissionsList, SubmissionDetail, SubmissionEdit
  - SubmissionCard, SubmissionFilters
  - Test data grid in dark mode

- [ ] **Providers Module** (3 hours)
  - ProvidersList, ProviderDetail, ProviderForm
  - ProviderScheduleManager, ProviderCard
  - Test schedule calendar

- [ ] **Bulk Import Workflows** (2 hours)
  - All bulk import components (6 files)
  - Test file upload UI
  - Test data preview tables

#### Day 22: AI & Advanced Features (6 hours)
- [ ] **AI Components** (4 hours)
  - AI form builder components
  - Template generators
  - Prompt interfaces

- [ ] **Misc Components** (2 hours)
  - UsersList, UsersManagement
  - Any remaining components

---

### Phase 6: Testing & Polish (Week 4-5) - 22 hours

#### Day 23-24: Visual Testing (12 hours)
- [ ] **Component-by-component testing** (8 hours)
  - Manually test all 91 components
  - Check in both light and dark modes
  - Verify hover states, focus states
  - Test loading states, empty states
  - Document any issues

- [ ] **Color Contrast Testing** (4 hours)
  - Use WebAIM Contrast Checker
  - Ensure WCAG AAA compliance (7:1 ratio)
  - Fix any contrast issues
  - Test with colorblind simulators

#### Day 25: Accessibility Testing (6 hours)
- [ ] **Screen Reader Testing** (3 hours)
  - Test with NVDA/JAWS
  - Ensure theme changes are announced
  - Verify focus management

- [ ] **Keyboard Navigation** (2 hours)
  - Test all interactive elements
  - Ensure focus indicators visible
  - Test in high contrast mode

- [ ] **Automated Accessibility** (1 hour)
  - Run axe DevTools
  - Run WAVE
  - Fix automated findings

#### Day 26: Cross-Browser & Performance (4 hours)
- [ ] **Browser Testing** (2 hours)
  - Chrome, Firefox, Safari, Edge
  - Test on mobile (iOS Safari, Chrome Mobile)
  - Verify system theme detection

- [ ] **Performance Optimization** (2 hours)
  - Test theme switch speed (target < 100ms)
  - Minimize reflows
  - Optimize MUI theme creation
  - Test on low-end devices

---

## Testing Checklist

### A. Visual Testing (per component)
- [ ] Component renders correctly in light mode
- [ ] Component renders correctly in dark mode
- [ ] No "white flashes" when toggling theme
- [ ] Borders are visible and appropriate thickness
- [ ] Text has sufficient contrast (7:1 minimum)
- [ ] Hover states work and are visible
- [ ] Focus indicators clearly visible
- [ ] Active states distinguishable
- [ ] Disabled states appropriately grayed out
- [ ] Loading spinners visible on both backgrounds
- [ ] Icons maintain visibility

### B. Component-Specific Tests

**Forms:**
- [ ] All field types visible
- [ ] Validation errors visible (red text readable)
- [ ] Required field indicators visible
- [ ] Placeholder text readable
- [ ] Helper text readable

**Buttons:**
- [ ] Primary button stands out
- [ ] Secondary button distinguishable
- [ ] Ghost/text buttons visible
- [ ] Danger/destructive buttons clear
- [ ] Icon-only buttons visible

**Cards:**
- [ ] Card backgrounds elevated from page
- [ ] Headers distinguishable
- [ ] Borders define boundaries
- [ ] Shadow/elevation appropriate

**Tables/Grids:**
- [ ] Headers clearly differentiated
- [ ] Row separators visible
- [ ] Zebra striping (if used) effective
- [ ] Selected rows highlighted
- [ ] Hover states work

**Charts:**
- [ ] All data series distinguishable
- [ ] Axes labels readable
- [ ] Tooltips visible and readable
- [ ] Legends clear
- [ ] Grid lines subtle but visible

**AG Grid:**
- [ ] Column headers visible
- [ ] Cell text readable
- [ ] Filters and menus work
- [ ] Selected rows highlighted
- [ ] Sorting indicators visible

**Material-UI Components:**
- [ ] All MUI components respect theme
- [ ] No light-mode-only backgrounds
- [ ] Dialogs/modals visible
- [ ] Dropdowns/selects work

**React Big Calendar:**
- [ ] Month view readable
- [ ] Week view clear
- [ ] Day view visible
- [ ] Events stand out
- [ ] Today highlighted
- [ ] Off-range dates subtle

### C. Accessibility Tests

**Contrast Ratios (WCAG AAA):**
- [ ] Normal text: 7:1 minimum
- [ ] Large text (18pt+): 4.5:1 minimum
- [ ] UI components: 3:1 minimum
- [ ] Test with WebAIM Contrast Checker

**Keyboard Navigation:**
- [ ] All interactive elements reachable
- [ ] Focus order logical
- [ ] Focus indicators visible (3px outline)
- [ ] No keyboard traps
- [ ] Escape closes modals

**Screen Readers:**
- [ ] Theme changes announced
- [ ] All content accessible
- [ ] ARIA labels present
- [ ] Form errors announced
- [ ] Loading states announced

**Reduced Motion:**
- [ ] Animations disabled when enabled
- [ ] Transitions minimal
- [ ] No motion-induced nausea

**High Contrast:**
- [ ] All content visible
- [ ] Borders strengthened
- [ ] Colors more saturated

### D. Browser/Device Tests

**Desktop Browsers:**
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Mobile Browsers:**
- [ ] iOS Safari
- [ ] Chrome Mobile (Android)
- [ ] Firefox Mobile

**System Integration:**
- [ ] Light mode matches system light theme
- [ ] Dark mode matches system dark theme
- [ ] Auto-switches with system preference
- [ ] Manual override persists

**Persistence:**
- [ ] Theme choice persists on reload
- [ ] Font choice persists
- [ ] All settings persist in localStorage
- [ ] No CORS or storage issues

---

## Risks & Mitigation

### Risk 1: Breaking Visual Changes
**Impact:** High | **Probability:** Medium

**Description:** Refactoring 1,300+ color instances could introduce subtle visual bugs or inconsistencies.

**Mitigation:**
1. Create visual regression tests using Percy or Chromatic
2. Work in feature branch (`feature/dark-mode-complete`)
3. Test each module thoroughly before moving to next
4. Keep commented "before" versions during transition period
5. Create comprehensive screenshot library before starting

**Rollback Plan:** Maintain old codebase in separate branch, can revert specific modules if issues found.

---

### Risk 2: Material-UI Integration Complexity
**Impact:** Medium | **Probability:** Medium

**Description:** MUI theme system might conflict with Tailwind CSS classes, causing styling inconsistencies.

**Mitigation:**
1. Thoroughly test MUI ThemeProvider integration early (Phase 1)
2. Use MUI's `sx` prop consistently for MUI components
3. Keep MUI components isolated in patient module
4. Document MUI-specific styling patterns
5. Consider long-term migration path to shadcn/ui

**Contingency:** If MUI proves too problematic, prioritize migration to shadcn/ui equivalents (adds ~2 weeks).

---

### Risk 3: Chart Readability in Medical Context
**Impact:** High | **Probability:** Medium

**Description:** Medical staff rely on vitals charts for critical decisions. Poor dark mode visibility could impact patient care.

**Mitigation:**
1. User testing with actual medical staff
2. Maintain high contrast ratios for all medical data
3. Use distinct hues, not just shades
4. Add optional chart theme override (light chart in dark app)
5. Provide export/print in both themes
6. Test with colorblind simulation tools

**Validation:** Require sign-off from medical team lead before production deployment.

---

### Risk 4: Performance Degradation
**Impact:** Low | **Probability:** Low

**Description:** Dynamic theme switching could cause layout reflows, impacting perceived performance.

**Mitigation:**
1. Use CSS variables (already implemented) - no JS recalculation needed
2. Minimize DOM manipulation during theme switch
3. Test on low-end devices (old iPads, budget Android)
4. Profile with Chrome DevTools Performance tab
5. Lazy-load theme-specific resources

**Target:** < 100ms theme switch time, no visible flicker.

---

### Risk 5: Accessibility Non-Compliance
**Impact:** High (Legal/Regulatory) | **Probability:** Low

**Description:** Healthcare applications must meet WCAG 2.1 AA (or AAA) standards. Failure could result in compliance issues.

**Mitigation:**
1. Use automated tools (axe DevTools, WAVE) on every component
2. Manual testing with screen readers
3. Document all accessibility decisions
4. Include healthcare compliance expert in review
5. Create accessibility checklist for each component

**Validation:** Formal accessibility audit before production release.

---

### Risk 6: User Preference Conflicts
**Impact:** Low | **Probability:** Medium

**Description:** Users might expect different default behavior or have strong opinions on dark mode aesthetics.

**Mitigation:**
1. Provide granular controls (theme, font, contrast, etc.)
2. Respect system preferences by default
3. Make all settings easily discoverable
4. Add "Reset to Defaults" option
5. Collect user feedback early (beta program)

**Plan:** Implement feature flags to A/B test default settings.

---

## Success Metrics

### Quantitative Metrics

**Code Quality:**
- [ ] 100% of 91 component files migrated (target: 91/91)
- [ ] 0 hardcoded color classes in production code
- [ ] 0 console warnings related to theming
- [ ] < 5% increase in bundle size

**Accessibility:**
- [ ] WCAG AAA compliance (7:1 contrast) on 100% of text
- [ ] WCAG AA compliance (3:1 contrast) on 100% of UI components
- [ ] 0 axe DevTools violations
- [ ] 0 WAVE errors

**Performance:**
- [ ] < 100ms theme switch time (measured)
- [ ] No layout shift (CLS = 0) during theme switch
- [ ] < 50ms first paint after theme change

**Test Coverage:**
- [ ] 95%+ component test coverage for theme variants
- [ ] Visual regression tests for all 91 components
- [ ] Cross-browser tests passed (Chrome, Firefox, Safari, Edge)

---

### Qualitative Metrics

**User Experience:**
- [ ] Medical staff feedback: "Dark mode is comfortable for long shifts"
- [ ] Admin feedback: "Settings are easy to find and understand"
- [ ] Patient-facing users: "Interface is modern and professional"
- [ ] No complaints about readability or eye strain

**Design Consistency:**
- [ ] Design review approval from UX team
- [ ] Consistent visual language across all modules
- [ ] Dark mode feels intentional, not just inverted colors
- [ ] Theme options enhance usability (font, spacing choices)

**Code Quality:**
- [ ] Code review approval from 2+ senior developers
- [ ] No "magic numbers" or unexplained color values
- [ ] Clear documentation for future theme additions
- [ ] Pattern library updated with dark mode examples

---

### Key Performance Indicators (KPIs)

**Adoption:**
- Target: 40%+ users actively use dark mode within 1 month
- Target: 60%+ mobile users use dark mode (system preference)

**Satisfaction:**
- Target: > 4.5/5 rating for dark mode in user surveys
- Target: < 5% negative feedback related to dark mode

**Accessibility:**
- Target: 100% WCAG AAA compliance
- Target: 0 accessibility-related support tickets

**Development:**
- Target: Complete implementation in 3-4 weeks
- Target: No production bugs related to theming post-launch

---

## Appendix: Quick Reference

### Color Token Cheat Sheet

| Use Case | Light Mode Class | Dark Mode Result |
|----------|------------------|------------------|
| Page background | `bg-background` | Very dark (#0A0A0A) |
| Card background | `bg-card` | Dark elevated (#18181B) |
| Hover state | `bg-accent` | Medium gray (#3F3F46) |
| Subtle background | `bg-secondary` | Dark gray (#262626) |
| Primary text | `text-foreground` | White (#FAFAFA) |
| Secondary text | `text-muted-foreground` | Light gray (#A3A3A3) |
| Borders | `border-border` | Dark gray (#333333) |
| Input background | `bg-background` | Very dark |
| Button primary | `bg-primary` | White |
| Button hover | `hover:bg-primary/90` | 90% white |

---

### Common Replacements

```jsx
// ❌ Before
<div className="bg-white text-gray-900 border-gray-200">

// ✅ After
<div className="bg-card text-foreground border-border">

// ❌ Before
<p className="text-gray-600">

// ✅ After
<p className="text-muted-foreground">

// ❌ Before
<button className="bg-gray-100 hover:bg-gray-200">

// ✅ After
<button className="bg-secondary hover:bg-secondary/80">
```

---

### File Priority Legend

🔴 **Critical:** Must be done early (blocks other work)
🟠 **High:** Important for core functionality
🟡 **Medium:** Important but not blocking
🟢 **Low:** Nice to have, can be deferred

---

## Changelog

**2026-03-13:** Initial plan created
**Status:** Phase 1 starting

---

## Next Steps

1. **Immediate (Today):**
   - Start Phase 1: Refine CSS variables
   - Update index.css utility classes
   - Create MUI theme wrapper

2. **This Week:**
   - Complete Phase 1 & Phase 2
   - Test core components thoroughly
   - Begin Phase 3 (feature modules)

3. **Next Sprint:**
   - Complete Phases 3-5
   - Begin comprehensive testing
   - Prepare for user acceptance testing

4. **Before Production:**
   - Full accessibility audit
   - Medical staff review
   - Cross-browser final testing
   - Performance benchmarking

---

**For questions or clarification, contact development team.**
