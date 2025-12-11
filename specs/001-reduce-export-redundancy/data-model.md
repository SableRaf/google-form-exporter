# Data Model

**Feature**: Reduce Export Redundancy
**Date**: 2025-12-11

## Overview

This feature does not introduce new persistent data entities. It optimizes the in-memory data flow between Google Apps Script API calls and export functions. The data model describes the runtime data structures passed between functions during export operations.

## Runtime Data Structures

### Form Object (FormApp.Form)

**Source**: `FormApp.openById(formId)` API call
**Lifecycle**: Fetched once per `runExportAll()` execution, passed to both exporters
**Ownership**: Created by Google Apps Script runtime, read-only access

**Key Properties** (from Google Apps Script FormApp API):
- `title` (string): Form title
- `id` (string): Unique form identifier
- `description` (string): Form description text
- `publishedUrl` (string): Public form URL
- `confirmationMessage` (string): Message shown after submission
- `customClosedFormMessage` (string): Message when form is closed

**Key Methods**:
- `getItems()`: Returns array of all form items
- `getTitle()`: Returns form title
- `getEditors()`: Returns array of User objects with edit access

**Relationships**: Container for Form Items array

---

### Form Items Array (FormApp.Item[])

**Source**: `form.getItems()` API call
**Lifecycle**: Fetched once per `runExportAll()` execution, passed to both exporters
**Ownership**: Created by Google Apps Script runtime, read-only access

**Structure**: Ordered array where index represents item position in form

**Item Properties** (common to all types):
- `type` (FormApp.ItemType enum): Question or section type
- `title` (string): Item heading/question text
- `helpText` (string): Optional helper text
- `id` (number): Unique item identifier
- `index` (number): Position in form (0-based)

**Item Type Enumeration**:
- TEXT: Short text response
- PARAGRAPH_TEXT: Long text response
- MULTIPLE_CHOICE: Single selection from choices
- CHECKBOX: Multiple selection from choices
- LIST: Dropdown selection
- SCALE: Linear scale rating
- IMAGE: Embedded image
- PAGE_BREAK: Section divider (multi-page forms)
- VIDEO: Embedded video

**Type-Specific Properties** (accessed via downcasting):
- **MULTIPLE_CHOICE, CHECKBOX, LIST**: `choices[]`, `hasOtherOption`
- **SCALE**: `lowerBound`, `upperBound`, `leftLabel`, `rightLabel`
- **IMAGE**: `alignment`, `imageBlob`
- **PAGE_BREAK**: `pageNavigationType`, `goToPage`

**Access Pattern**: Apps Script uses runtime downcasting via `item.asFooItem()` methods
- Example: `item.asMultipleChoiceItem().getChoices()`
- Helper function: `snakeCaseToCamelCase()` converts type enum to method name

**Validation Rules**:
- Array order MUST be preserved (represents form sequence)
- Item type determines which properties are accessible
- `isRequired()` method availability varies by type (defensive check required)

**Relationships**: Belongs to Form Object

---

### Shared Fetch Result (Runtime Structure)

**Purpose**: Temporary container for fetched data during `runExportAll()` execution
**Lifecycle**: Created at start of `runExportAll()`, destroyed when function exits
**Implementation**: Local variables in `Code.js` (not persisted)

**Structure**:
```javascript
{
  form: FormApp.Form,        // Result of FormApp.openById()
  items: FormApp.Item[]      // Result of form.getItems()
}
```

**Usage Pattern**:
```javascript
function runExportAll() {
  // Fetch phase
  var form = FormApp.openById(FORM_ID);
  var items = form.getItems();

  // Reuse phase
  var json = exportFormToJson(FORM_ID, form, items);
  var md = exportFormToMarkdown(FORM_ID, form, items);

  // Cleanup: automatic (local variables)
}
```

**State Transitions**:
1. **Uninitialized**: Before `runExportAll()` starts
2. **Fetching**: During `FormApp.openById()` and `form.getItems()` calls
3. **Active**: Data available, passed to export functions
4. **Complete**: After both exports finish, variables go out of scope

**Invariants**:
- Both `form` and `items` MUST be fetched successfully or both exports fail
- Data MUST NOT be modified by export functions (read-only contract)
- Data MUST be identical for both JSON and Markdown exports

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  runExportAll() - Code.js                                   │
│                                                              │
│  1. Fetch Phase (NEW OPTIMIZATION)                          │
│     form ← FormApp.openById(FORM_ID)  [1 call]             │
│     items ← form.getItems()            [1 call]             │
│                                                              │
│  2. Export Phase                                            │
│     ┌────────────────────────┐  ┌────────────────────────┐ │
│     │ exportFormToJson()     │  │ exportFormToMarkdown() │ │
│     │ (exportForm.js)        │  │ (toMarkdown.js)        │ │
│     │                        │  │                        │ │
│     │ Receives:              │  │ Receives:              │ │
│     │ - formId (string)      │  │ - formId (string)      │ │
│     │ - form (object)        │  │ - form (object)        │ │
│     │ - items (array)        │  │ - items (array)        │ │
│     │                        │  │                        │ │
│     │ Returns: JSON object   │  │ Returns: MD string     │ │
│     └────────────────────────┘  └────────────────────────┘ │
│              │                            │                 │
│  3. Save Phase                                              │
│     ├─→ saveToDrive_(filename, json)                       │
│     └─→ saveToDrive_(filename, md)                         │
└─────────────────────────────────────────────────────────────┘

BEFORE OPTIMIZATION:
  FormApp.openById() called 2 times
  form.getItems() called 2 times

AFTER OPTIMIZATION:
  FormApp.openById() called 1 time
  form.getItems() called 1 time
```

---

## Backward Compatibility

### Individual Export Functions

When `runExportToJSON()` or `runExportToMarkdown()` are called independently:

```javascript
function runExportToJSON() {
  // Calls exportFormToJson with only formId (no optional params)
  var json = exportFormToJson(FORM_ID);
  // Export function fetches data internally (fallback behavior)
}
```

**Data Flow (Individual Export)**:
```
exportFormToJson(formId, null, null)
  ↓
form ← FormApp.openById(formId)  [fallback when optional params null]
items ← form.getItems()          [fallback when optional params null]
  ↓
return JSON object
```

**Invariant**: Individual exports MUST work identically before and after optimization.

---

## Error States

### Form Fetch Failure

**Trigger**: Invalid form ID, permission denied, network error
**Behavior**:
- `runExportAll()` logs error and exits early
- Neither JSON nor Markdown export proceeds
- No files created

**Data State**: `form` and `items` remain undefined/null

### Items Fetch Failure

**Trigger**: Form exists but `getItems()` throws (rare, but defensive)
**Behavior**: Same as form fetch failure
**Data State**: `form` populated, `items` undefined/null

### Partial Export Failure

**Trigger**: One export function throws during processing (e.g., malformed item)
**Behavior**:
- Successful export still saves to Drive
- Failed export logs error
- Other export proceeds independently

**Data State**: `form` and `items` remain valid; failure is in export logic, not data

---

## Performance Characteristics

### Memory Usage

**Before**: Peak memory = max(JSON export, Markdown export)
**After**: Peak memory = size(form + items) + max(JSON export, Markdown export)

**Impact**: Negligible. Form objects are small (KB range for typical forms with 50 items). Items array is shared reference, not copied.

### Execution Time

**Savings**: 2 API calls eliminated (FormApp.openById, form.getItems)
**Typical API call latency**: 50-200ms each
**Expected improvement**: 100-400ms reduction for `runExportAll()`

**Individual exports**: No change (still fetch data independently)

---

## Validation Rules

### Pre-Conditions (runExportAll)

1. `FORM_ID` must be non-empty string
2. Calling user must have read access to the form
3. Form must exist and be accessible via FormApp API

### Post-Conditions (runExportAll)

1. If successful: Two files created in Drive folder
2. Both files contain identical form data (same title, count, item titles)
3. Both files have matching timestamp prefix
4. Logs show single "Total items exported" count

### Invariants

1. `form.getItems().length` MUST equal `json.count` MUST equal markdown item count
2. Export functions MUST NOT modify passed `form` or `items` objects
3. Individual export functions MUST still work without optional parameters
4. All existing defensive programming checks (`typeof`, try-catch) MUST be preserved

---

## Glossary

- **Form Object**: Google Apps Script `FormApp.Form` instance representing a Google Form
- **Form Items**: Array of `FormApp.Item` objects representing questions and sections
- **Downcasting**: Apps Script pattern using `asFooItem()` methods to access type-specific properties
- **Shared Fetch Result**: Local variables containing form data reused by both exporters
- **Fallback Fetching**: When export functions receive null optional parameters, they fetch data independently (backward compatibility)
