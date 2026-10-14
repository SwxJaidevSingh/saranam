# Sprint 1: Purchase Order UI - Testing Checklist

## Overview
This document provides a comprehensive testing checklist for the Purchase Order UI implementation completed in Sprint 1.

## Build Verification
- ✅ Frontend builds successfully without errors
- ✅ No TypeScript/ESLint errors
- ✅ All components properly imported and exported
- ✅ Routes correctly configured in App.jsx

## Component Tests

### 1. SupplierSelector Component
**Location**: `frontend/src/components/inventory/SupplierSelector.jsx`

**Test Cases**:
- [ ] Component loads and fetches suppliers from API
- [ ] Search functionality filters suppliers correctly
- [ ] Preferred suppliers show badge and sort to top
- [ ] Supplier rating displays correctly
- [ ] Contact info (phone/email) visible in dropdown
- [ ] Selection triggers onChange callback with supplier_id and full supplier object
- [ ] Error message displays when error prop is provided
- [ ] Component handles API failures gracefully

**API Endpoint**: `GET /api/inventory/suppliers`

### 2. LocationSelector Component
**Location**: `frontend/src/components/inventory/LocationSelector.jsx`

**Test Cases**:
- [ ] Component loads and fetches locations from API
- [ ] filterType prop correctly filters locations by type
- [ ] Location type badges display with correct colors
- [ ] Cold storage indicator shows when applicable
- [ ] Controlled storage indicator shows when applicable
- [ ] Selection triggers onChange callback with location_id and full location object
- [ ] Error message displays when error prop is provided
- [ ] Custom label prop is respected

**API Endpoint**: `GET /api/inventory/locations`

### 3. POItemsTable Component
**Location**: `frontend/src/components/inventory/POItemsTable.jsx`

**Test Cases**:
- [ ] "Add Medicine" button opens search interface
- [ ] Medicine search queries API after 3+ characters
- [ ] Search results display medicine name, generic name, dosage form, strength
- [ ] Clicking medicine adds it to items table
- [ ] Duplicate medicine shows alert and prevents addition
- [ ] Table displays all item fields (quantity, unit price, discount %, tax %)
- [ ] Real-time calculation: subtotal = quantity × unit_price
- [ ] Real-time calculation: discount applied to subtotal
- [ ] Real-time calculation: tax applied to (subtotal - discount)
- [ ] Real-time calculation: total = subtotal - discount + tax
- [ ] Grand total sums all item totals correctly
- [ ] Remove button deletes item from table
- [ ] Empty state message shown when no items
- [ ] Error message displays when error prop is provided

**API Endpoint**: `GET /api/inventory/medicines/search?q={query}`

### 4. PurchaseOrderWizard Component
**Location**: `frontend/src/pages/inventory/PurchaseOrderWizard.jsx`

#### Step 1: Basic Information
**Test Cases**:
- [ ] SupplierSelector renders and works
- [ ] Expected delivery date calendar picker works
- [ ] Past dates are disabled in calendar
- [ ] LocationSelector renders and works
- [ ] Internal notes field accepts input
- [ ] Supplier notes field accepts input
- [ ] Validation prevents proceeding without required fields
- [ ] Error messages display for missing required fields
- [ ] "Next" button moves to Step 2 when valid

#### Step 2: Add Items
**Test Cases**:
- [ ] POItemsTable renders and works
- [ ] Can add multiple medicines
- [ ] Can edit quantities, prices, discounts, taxes
- [ ] Totals recalculate on changes
- [ ] Can remove items
- [ ] Validation prevents proceeding with empty items
- [ ] Error message shown when trying to proceed without items
- [ ] "Back" button returns to Step 1
- [ ] "Next" button moves to Step 3 when items added

#### Step 3: Review & Submit
**Test Cases**:
- [ ] Order summary displays supplier name correctly
- [ ] Expected delivery date formatted correctly
- [ ] Delivery location name shown
- [ ] Total items count correct
- [ ] Internal notes displayed (if provided)
- [ ] Items table shows all added medicines
- [ ] Items table shows quantities, prices, discounts, taxes, totals
- [ ] Financial summary shows subtotal
- [ ] Financial summary shows total discount (in red)
- [ ] Financial summary shows total tax
- [ ] Financial summary shows grand total
- [ ] "Back" button returns to Step 2
- [ ] "Cancel" button confirms and navigates back
- [ ] "Create Purchase Order" submits to API
- [ ] Loading state shown during submission
- [ ] Success redirects to PO detail page
- [ ] Error message shown on submission failure

**API Endpoint**: `POST /api/inventory/purchase-orders`

**Request Payload**:
```json
{
  "supplier_id": "uuid",
  "po_date": "YYYY-MM-DD",
  "expected_delivery_date": "YYYY-MM-DD",
  "delivery_location_id": "uuid",
  "internal_notes": "string",
  "supplier_notes": "string",
  "subtotal": 0.00,
  "discount_amount": 0.00,
  "tax_amount": 0.00,
  "total_amount": 0.00,
  "status": "draft",
  "items": [
    {
      "medicine_id": "uuid",
      "ordered_quantity": 0,
      "unit_price": 0.00,
      "discount_percentage": 0.00,
      "tax_percentage": 0.00,
      "total_amount": 0.00
    }
  ]
}
```

### 5. PurchaseOrdersList Component
**Location**: `frontend/src/pages/inventory/PurchaseOrdersList.jsx`

**Test Cases**:
- [ ] Page title and description display
- [ ] "Create Purchase Order" button navigates to wizard
- [ ] List fetches and displays purchase orders
- [ ] Search filters by PO number
- [ ] Search filters by supplier name
- [ ] Status filter dropdown works
- [ ] Status filter applies correctly (all statuses)
- [ ] PO number displayed
- [ ] PO date formatted correctly (dd MMM yyyy)
- [ ] Supplier name and company displayed
- [ ] Expected delivery date formatted correctly
- [ ] Total amount formatted with currency (₹) and decimals
- [ ] Status badge shows correct color per status:
  - Draft: Gray
  - Pending Approval: Yellow
  - Approved: Blue
  - Sent: Purple
  - Partially Received: Orange
  - Received: Green
  - Cancelled: Red
- [ ] Status badge shows correct label
- [ ] Eye icon navigates to PO detail page
- [ ] Pagination shows when multiple pages
- [ ] Previous/Next buttons work correctly
- [ ] Page numbers display correctly
- [ ] Empty state shown when no POs
- [ ] "Create Your First PO" button in empty state
- [ ] Refresh button refetches data
- [ ] Loading skeletons shown during fetch

**API Endpoint**: `GET /api/inventory/purchase-orders?page={page}&per_page=20&status={status}`

### 6. PurchaseOrderDetail Component
**Location**: `frontend/src/pages/inventory/PurchaseOrderDetail.jsx`

#### General Display
**Test Cases**:
- [ ] "Back to Purchase Orders" button navigates correctly
- [ ] PO number displayed in title
- [ ] Status badge shows correct color and label
- [ ] Created date formatted correctly
- [ ] Supplier information card shows name
- [ ] Supplier company name shown (if exists)
- [ ] Supplier contact phone shown (if exists)
- [ ] Expected delivery date formatted correctly
- [ ] Delivery location name shown
- [ ] Financial summary shows subtotal
- [ ] Financial summary shows tax amount
- [ ] Financial summary shows total amount (bold)
- [ ] Items table shows all items
- [ ] Items table shows ordered, received, pending quantities
- [ ] Items table shows unit price and total
- [ ] Internal notes shown (if exists)
- [ ] Supplier notes shown (if exists)
- [ ] Loading skeleton shown while fetching
- [ ] Not found message if PO doesn't exist

#### Status-Based Actions
**Test Cases**:
- [ ] Draft status: Shows "Submit for Approval" button
- [ ] Pending Approval status: Shows "Approve PO" button
- [ ] Approved/Sent/Partial Received: Shows "Receive Goods" button
- [ ] All statuses: Shows "Print" button

#### Approval Dialog
**Test Cases**:
- [ ] Clicking approve button opens dialog
- [ ] Dialog title "Approve Purchase Order"
- [ ] Approval notes textarea works (optional)
- [ ] "Cancel" button closes dialog
- [ ] "Approve PO" button submits approval
- [ ] Loading state shown during approval
- [ ] Dialog closes on success
- [ ] PO refetched after approval
- [ ] Error message shown on failure

**API Endpoint**: `POST /api/inventory/purchase-orders/{id}/approve`

#### Goods Receipt Dialog
**Test Cases**:
- [ ] Clicking receive goods button opens dialog
- [ ] Dialog title "Receive Goods"
- [ ] One card per item with medicine name
- [ ] Received quantity pre-filled with pending quantity
- [ ] Received quantity is editable
- [ ] Batch number field works (required)
- [ ] Manufacture date picker works (required)
- [ ] Expiry date picker works (required)
- [ ] Expiry date min value is manufacture date
- [ ] Validation prevents submission without batch details
- [ ] Alert shown if any field missing
- [ ] "Cancel" button closes dialog
- [ ] "Confirm Receipt" button submits receipt
- [ ] Loading state shown during receipt
- [ ] Dialog closes on success
- [ ] PO refetched after receipt
- [ ] Error message shown on failure

**API Endpoint**: `POST /api/inventory/purchase-orders/{id}/receive`

**Request Payload**:
```json
{
  "items": [
    {
      "item_id": "uuid",
      "received_quantity": 0,
      "batch_number": "string",
      "manufacture_date": "YYYY-MM-DD",
      "expiry_date": "YYYY-MM-DD"
    }
  ]
}
```

## Navigation Tests
- [ ] Inventory menu item shows PO submenu
- [ ] "/inventory/purchase-orders" route loads PurchaseOrdersList
- [ ] "/inventory/purchase-orders/new" route loads PurchaseOrderWizard
- [ ] "/inventory/purchase-orders/:id" route loads PurchaseOrderDetail
- [ ] Back buttons navigate correctly
- [ ] Cancel buttons navigate correctly
- [ ] Success submissions navigate correctly

## Integration Tests

### Complete PO Workflow
**End-to-End Test Scenario**:
1. [ ] Navigate to Purchase Orders list
2. [ ] Click "Create Purchase Order"
3. [ ] **Step 1**: Select supplier, set delivery date, select location
4. [ ] Click "Next"
5. [ ] **Step 2**: Add 3 medicines with different quantities/prices
6. [ ] Edit discount and tax percentages
7. [ ] Verify totals calculate correctly
8. [ ] Click "Next"
9. [ ] **Step 3**: Review all information
10. [ ] Verify financial summary is correct
11. [ ] Click "Create Purchase Order"
12. [ ] Redirected to PO detail page
13. [ ] Verify all information displays correctly
14. [ ] PO status is "Draft"
15. [ ] Click "Approve PO"
16. [ ] Confirm approval
17. [ ] Status changes to "Approved" or "Pending Approval"
18. [ ] Click "Receive Goods"
19. [ ] Enter batch details for all items
20. [ ] Confirm receipt
21. [ ] Status changes to "Received" or "Partially Received"
22. [ ] Navigate back to list
23. [ ] Verify PO appears in list with correct status

### Error Handling
- [ ] Network error shows user-friendly message
- [ ] 401 Unauthorized redirects to login
- [ ] 403 Forbidden shows permission error
- [ ] 404 Not Found shows not found message
- [ ] 500 Server Error shows server error message
- [ ] Validation errors display inline

## Performance Tests
- [ ] List page loads within 2 seconds
- [ ] Detail page loads within 2 seconds
- [ ] Wizard steps transition smoothly
- [ ] Calculations happen instantly (<100ms)
- [ ] Search results appear within 500ms

## Accessibility Tests
- [ ] All form inputs have labels
- [ ] Tab navigation works throughout
- [ ] Error messages are announced
- [ ] Buttons have clear text
- [ ] Color contrast meets WCAG standards
- [ ] Focus indicators visible

## Browser Compatibility
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

## Mobile Responsiveness
- [ ] List view responsive on mobile
- [ ] Detail view responsive on mobile
- [ ] Wizard works on mobile
- [ ] Tables scroll horizontally on mobile
- [ ] Dialogs adapt to mobile screen

## Status
- **Build**: ✅ Passed
- **Component Tests**: Pending manual testing
- **Integration Tests**: Pending manual testing
- **Performance**: To be measured
- **Accessibility**: To be verified
- **Browser Compatibility**: To be tested
- **Mobile**: To be tested

## Notes
- All components built and integrated successfully
- Backend APIs already exist and are tested
- Frontend compilation successful with no errors
- Ready for manual testing with authenticated user session
- Test with various user roles (admin, inventory_manager, data_entry)

## Next Steps After Testing
1. Fix any bugs found during testing
2. Add unit tests for calculation functions
3. Add integration tests for critical workflows
4. Document any API issues found
5. Move to Sprint 2: Dispensing UI
