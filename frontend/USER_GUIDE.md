# CV Raman Health - Form Builder User Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [Form Builder Features](#form-builder-features)
3. [Field Types](#field-types)
4. [Advanced Features](#advanced-features)
5. [Managing Submissions](#managing-submissions)
6. [Analytics & Reporting](#analytics--reporting)
7. [Sharing Forms](#sharing-forms)
8. [Troubleshooting](#troubleshooting)

## Getting Started

### Accessing the Application

1. Navigate to `http://localhost:5173`
2. Login with your credentials
3. You'll see the main dashboard with:
   - **Forms**: Create and manage forms
   - **Submissions**: View all submitted responses
   - **Analytics**: Analyze form data and trends

### Creating Your First Form

1. Click **"Forms"** in the navigation menu
2. Click **"Create New Form"** button
3. Fill in basic details:
   - **Form Name**: Give your form a descriptive name
   - **Description**: Optional brief description
4. Choose form type:
   - ☐ **Single Page**: All fields on one page
   - ☑ **Multi-page**: Split form into multiple sections

## Form Builder Features

### The Form Builder Interface

The form builder has three main panels:

#### Left Panel: Field Palette
Drag field types from here onto your form:
- Text fields (text, email, phone, url)
- Number and date fields
- Selection fields (select, radio, checkbox)
- Advanced fields (linear scale, file upload)
- Layout elements (section headers)

#### Center Panel: Form Canvas
Your form preview where you:
- Drag and drop fields
- Reorder fields by dragging
- Click fields to edit
- See real-time preview

#### Right Panel: Field Properties
Configure the selected field:
- **Label**: Field display name
- **Placeholder**: Helper text inside input
- **Help Text**: Additional guidance below field
- **Required**: Make field mandatory
- **Default Value**: Pre-filled value
- **Validation**: Pattern matching, min/max values
- **Conditional Logic**: Show/hide based on other fields

### Creating a Single-Page Form

**Step 1: Add Fields**
1. Drag field types from the left palette onto the canvas
2. Fields will appear in the order you add them
3. Reorder by dragging fields up or down

**Step 2: Configure Each Field**
1. Click on a field to select it
2. The right panel shows field properties
3. Set:
   - **Label** (required)
   - **Placeholder** text
   - **Help text** for guidance
   - **Required** checkbox
   - **Default value** if applicable

**Step 3: Add Validation**
For text fields:
- **Pattern**: Regular expression (e.g., `^[A-Za-z ]{2,50}$` for names)
- **Max Length**: Character limit
- **Error Message**: Custom error text

For number fields:
- **Min**: Minimum value
- **Max**: Maximum value

**Step 4: Save**
- Click **"Create Form"** or **"Update Form"**
- Form is now ready to receive submissions

### Creating a Multi-Page Form

**Step 1: Enable Multi-Page**
1. Check the **"Multi-page form"** checkbox
2. You'll see page navigation tabs appear
3. First page is created automatically

**Step 2: Manage Pages**
- **Add Page**: Click "+ Add Page" button
- **Switch Pages**: Click page tabs to navigate
- **Rename Page**: Click page title to edit
- **Delete Page**: Click page options (minimum 1 page required)

**Step 3: Add Fields to Each Page**
- Select a page by clicking its tab
- Drag fields onto that page
- Each page works like a mini-form

**Step 4: Page Descriptions**
- Each page can have a title and description
- Helps guide users through the form

**Benefits of Multi-Page Forms:**
- Better organization for long forms
- Progress indicator for users
- One logical section per page
- Improved completion rates

## Field Types

### 1. Text Field
**Use for:** Names, addresses, short answers
```json
{
  "type": "text",
  "label": "Full Name",
  "placeholder": "John Doe",
  "required": true
}
```

### 2. Email Field
**Use for:** Email addresses (built-in validation)
```json
{
  "type": "email",
  "label": "Email Address",
  "placeholder": "user@example.com",
  "required": true
}
```

### 3. Phone Field
**Use for:** Phone numbers
```json
{
  "type": "phone",
  "label": "Phone Number",
  "placeholder": "+1 (555) 123-4567"
}
```

### 4. URL Field
**Use for:** Website URLs (built-in validation)
```json
{
  "type": "url",
  "label": "Website",
  "placeholder": "https://example.com"
}
```

### 5. Number Field
**Use for:** Ages, quantities, ratings
**Features:**
- Min/Max validation
- Numeric-only input
```json
{
  "type": "number",
  "label": "Age",
  "validation": {
    "min": 18,
    "max": 120
  }
}
```

### 6. Date Field
**Use for:** Birth dates, appointment dates
```json
{
  "type": "date",
  "label": "Date of Birth",
  "required": true
}
```

### 7. Time Field
**Use for:** Appointment times, preferred contact times
```json
{
  "type": "time",
  "label": "Preferred Time"
}
```

### 8. Select (Dropdown)
**Use for:** Country, state, category selection
**Features:**
- Dropdown menu
- Single selection
```json
{
  "type": "select",
  "label": "Country",
  "options": ["USA", "Canada", "UK", "Other"],
  "required": true
}
```

### 9. Radio Buttons
**Use for:** Gender, yes/no questions
**Features:**
- Mutually exclusive options
- All options visible
```json
{
  "type": "radio",
  "label": "Gender",
  "options": ["Male", "Female", "Other"],
  "required": true
}
```

### 10. Checkbox
**Use for:** Agreements, multiple selections
**Features:**
- Can be single or multi-select
```json
{
  "type": "checkbox",
  "label": "I agree to terms and conditions",
  "required": true
}
```

### 11. Textarea
**Use for:** Comments, descriptions, long answers
**Features:**
- Multi-line input
- Character limit option
```json
{
  "type": "textarea",
  "label": "Additional Comments",
  "placeholder": "Enter your comments here...",
  "validation": {
    "maxLength": 500
  }
}
```

### 12. Linear Scale
**Use for:** Ratings, satisfaction scores
**Features:**
- Number scale (e.g., 1-10)
- Custom labels for min/max
```json
{
  "type": "linearScale",
  "label": "Satisfaction Rating",
  "config": {
    "min": 1,
    "max": 10,
    "minLabel": "Not Satisfied",
    "maxLabel": "Very Satisfied"
  }
}
```

### 13. File Upload
**Use for:** Documents, images, attachments
**Features:**
- File type restrictions
- Size limits
```json
{
  "type": "file",
  "label": "Upload Document",
  "config": {
    "maxSize": 5242880,
    "acceptedTypes": ["image/jpeg", "image/png", "application/pdf"]
  }
}
```

### 14. Section Header
**Use for:** Organizing form sections
**Features:**
- Not an input field
- Visual separator
- Can have description
```json
{
  "type": "section",
  "label": "Personal Information",
  "helpText": "Please provide your basic details"
}
```

## Advanced Features

### Conditional Logic (Show/Hide Fields)

**Purpose:** Show fields only when certain conditions are met

**Example Use Case:**
"Show allergy details field only if user answers 'Yes' to 'Do you have allergies?'"

**How to Set Up:**
1. Create the trigger field (e.g., radio button with "Yes/No")
2. Create the conditional field (e.g., textarea for allergy details)
3. Click the conditional field to select it
4. In the right panel, under **"Visibility Rules"**:
   - Click "+ Add Rule"
   - **Field**: Select trigger field
   - **Operator**: Choose condition type
   - **Value**: Set the value to match

**Supported Operators:**
- **equals**: Field value equals specified value
- **notEquals**: Field value does not equal
- **contains**: Field value contains text (case-insensitive)
- **notContains**: Field value doesn't contain text
- **greaterThan**: Numeric value is greater
- **lessThan**: Numeric value is less
- **greaterThanOrEqual**: Numeric value >=
- **lessThanOrEqual**: Numeric value <=

**Example Configuration:**
```
Field: has_allergies
Operator: equals
Value: "Yes"
```

**Multiple Rules:**
- Add multiple rules for complex logic
- ALL rules must be true (AND logic)

### Default Values

Pre-fill fields with common values:

**Use Cases:**
- Today's date in a date field
- Default country selection
- Pre-checked checkboxes

**How to Set:**
1. Select the field
2. In Field Properties, find "Default Value"
3. Enter the default value
4. Users can still change it

### Custom Validation

**Pattern Matching (Text Fields):**
- Use regular expressions
- Example: Names only (letters and spaces): `^[A-Za-z ]{2,50}$`
- Example: Postal code: `^\d{5}(-\d{4})?$`

**Custom Error Messages:**
- Set friendly error messages
- Shows when validation fails
- Example: "Please enter a valid postal code (e.g., 12345 or 12345-6789)"

### Field Duplication

**Quick way to create similar fields:**
1. Hover over a field
2. Click the **duplicate icon**
3. A copy appears below
4. Modify the copy as needed

## Managing Submissions

### Viewing Submissions

**All Submissions Page:**
1. Click **"Submissions"** in navigation
2. See all submissions across all forms
3. Filter by:
   - Form name
   - Date range
   - Submitter

**Form-Specific Submissions:**
1. Go to **Forms** page
2. Click **"View Submissions"** on a form
3. See only that form's responses

### Submission Data Grid

**Features:**
- **Sortable Columns**: Click column headers
- **Search/Filter**: Find specific submissions
- **Pagination**: Navigate large datasets
- **Column Visibility**: Show/hide columns
- **Bulk Actions**: Select multiple submissions

**Actions:**
- **View Details**: Click on a submission
- **Export**: Download as CSV or Excel
- **Delete**: Remove submissions

### Exporting Data

**CSV Export:**
1. Go to form's submissions page
2. Click **"Export"** button
3. Choose **"CSV"** format
4. File downloads automatically

**Excel Export:**
1. Same as CSV
2. Choose **"Excel"** format
3. Get styled XLSX file with:
   - Header row (colored, bold)
   - Auto-sized columns
   - Properly formatted data

**Export Includes:**
- All form fields as columns
- Submission ID
- Submitter email
- Submission timestamp
- All submitted data

## Analytics & Reporting

### Dashboard Overview

**Access:** Click **"Analytics"** in navigation

**Key Metrics:**
- **Total Forms**: Number of forms created
- **Total Submissions**: All-time submissions
- **Total Users**: Registered users
- **Submission Trends**: Graph showing submissions over time

**Recent Activity:**
- Latest form submissions
- Quick access to recent data

### Form Analytics

**To View:**
1. Go to Analytics page
2. Select a specific form
3. Choose date range (optional)

**Metrics Provided:**

**Field Distribution (for select/radio/checkbox):**
- Shows how many times each option was selected
- Displayed as bar charts
- Example: Gender distribution, Country breakdown

**Numeric Aggregations (for number/linear scale):**
- **Average**: Mean value
- **Median**: Middle value
- **Min**: Lowest value
- **Max**: Highest value
- Example: Average age, satisfaction ratings

**Submission Timeline:**
- Submissions per day/week
- Identify peak submission times

### Form Comparison

**Compare multiple forms:**
- Total submissions per form
- Creation dates
- Last submission time
- Activity levels

**Use Cases:**
- Identify most popular forms
- Track form performance
- Plan form improvements

## Sharing Forms

### Public Form Access

**Enable Sharing:**
1. Go to Forms page
2. Click **"Share"** on a form
3. Click **"Enable Public Access"**
4. A unique share link is generated

**Share Link Example:**
```
http://localhost:5173/public/forms/O4ElLi-4DrTEnxkCZ_1fx6fEa9bUd9cZRF7IVn74DY0
```

**Share Link Features:**
- **No login required**: Anyone with link can submit
- **Secure token**: Random, unpredictable URL
- **One-click copy**: Copy link to clipboard
- **QR Code**: Optional (future feature)

**Submissions from Public Links:**
- Recorded as anonymous
- No user authentication needed
- Tracked separately in analytics

**Disable Sharing:**
1. Click **"Share"** on form
2. Click **"Disable Public Access"**
3. Existing link stops working
4. Can re-enable later (new link generated)

### Embedding Forms

**Coming Soon:**
- Embed forms on websites
- iFrame integration
- Custom styling options

## Application Flow

### User Workflow: Creating and Managing Forms

```
Login → Dashboard → Forms Page → Create New Form
  ↓
Form Builder:
  1. Set form name & description
  2. Choose single/multi-page
  3. Drag fields from palette
  4. Configure field properties
  5. Add validation & conditional logic
  6. Preview form
  7. Save
  ↓
Form List → Share Form (optional)
  ↓
Public users submit responses
  ↓
View Submissions → Analyze Data → Export
```

### User Workflow: Filling a Form (Public User)

```
Receive share link → Open form
  ↓
See form title & description
  ↓
Multi-page form:
  - See progress bar
  - Fill fields on current page
  - Click "Next" to continue
  - Click "Previous" to go back
  - Click "Submit" on last page
  ↓
Single-page form:
  - Fill all fields
  - Click "Submit"
  ↓
Validation:
  - Required fields checked
  - Pattern validation
  - Error messages shown
  ↓
Success:
  - Confirmation message
  - Optional redirect
  - Submission saved
```

### Developer Workflow: Understanding the Code

**Key Components:**

**Form Builder (`/src/pages/forms/FormBuilder.jsx`):**
- Main form creation interface
- Manages form state (fields, pages, metadata)
- Handles drag-and-drop
- Integrates field editor

**Form Renderer (`/src/components/forms/FormRenderer.jsx`):**
- Renders forms for submission
- Handles validation with react-hook-form
- Implements conditional logic
- Multi-page navigation

**Field Components (`/src/components/forms/fields/`):**
- `LinearScaleField.jsx` - Rating scales
- `FileUploadField.jsx` - File uploads
- `SectionHeader.jsx` - Section dividers

**Analytics (`/src/pages/Analytics.jsx`):**
- Dashboard statistics
- Form comparison charts
- Field-level analytics
- Uses Recharts for visualization

**API Client (`/src/api/`):**
- `forms.js` - Forms API calls
- `submissions.js` - Submissions API
- `analytics.js` - Analytics API
- `auth.js` - Authentication

## Troubleshooting

### Common Issues

**Issue: Fields not appearing in form builder**
- **Solution**: Check browser console for errors
- Verify field type is supported
- Try refreshing the page

**Issue: Conditional logic not working**
- **Solution**: Check that:
  - Trigger field has a value
  - Operator matches the data type
  - Value exactly matches (case-sensitive for equals)

**Issue: Form not saving**
- **Solution**: Check for:
  - Empty field labels
  - Missing required schema properties
  - Browser console errors
  - Network connectivity

**Issue: Export not downloading**
- **Solution**:
  - Check pop-up blocker settings
  - Ensure submissions exist for the form
  - Try different browser

**Issue: Public form link not working**
- **Solution**:
  - Verify form sharing is enabled
  - Check that link is complete
  - Confirm backend server is running

### Browser Compatibility

**Recommended Browsers:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Features Requiring Modern Browser:**
- Drag and drop
- File upload
- Date/time pickers

### Performance Tips

**For Large Forms:**
- Use multi-page format
- Group related fields
- Limit to 20-30 fields per page

**For Many Submissions:**
- Use date filters in analytics
- Export in batches
- Regular data archival

### Getting Help

**Documentation:**
- API Documentation: `/backend/API_DOCUMENTATION.md`
- This User Guide: `/frontend/USER_GUIDE.md`

**Support:**
- Email: support@cvraman.health
- GitHub Issues: [Report Bug]

## Best Practices

### Form Design

1. **Keep it Simple**
   - Only ask necessary questions
   - Use clear, concise labels
   - Provide helpful placeholders

2. **Logical Grouping**
   - Group related fields together
   - Use section headers for clarity
   - Multi-page for long forms

3. **Validation**
   - Set appropriate field types
   - Use pattern validation sparingly
   - Provide clear error messages

4. **User Experience**
   - Mark required fields clearly
   - Use help text for complex fields
   - Test form before sharing

### Data Management

1. **Regular Exports**
   - Export data regularly
   - Store backups securely
   - Archive old submissions

2. **Analytics Review**
   - Check form completion rates
   - Identify drop-off points
   - Optimize based on data

3. **Security**
   - Only share with intended audience
   - Disable sharing when not needed
   - Review submissions regularly

## Appendix: Keyboard Shortcuts

- **Ctrl/Cmd + S**: Save form (in builder)
- **Ctrl/Cmd + Z**: Undo (field deletion)
- **Delete**: Remove selected field
- **Escape**: Deselect field

## Version History

- **v1.0** - Initial release
  - All 14 field types
  - Multi-page forms
  - Conditional logic
  - Export functionality
  - Public sharing
  - Analytics dashboard
