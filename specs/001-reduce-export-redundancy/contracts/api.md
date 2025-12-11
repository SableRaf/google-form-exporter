# API Contracts

**Feature**: Reduce Export Redundancy
**Date**: 2025-12-11

## Overview

This document defines the function signatures and contracts for the export optimization feature. All functions maintain backward compatibility while adding optional parameters to support data sharing.

---

## Entry Point Functions (Code.js)

### runExportAll()

**Purpose**: Export form to both JSON and Markdown formats with shared data fetching (optimized)

**Signature**:
```javascript
function runExportAll()
```

**Parameters**: None (uses global `FORM_ID` and `EXPORT_FOLDER_ID`)

**Returns**: `void`

**Side Effects**:
- Creates two files in Google Drive folder:
  - `form_export_YYYY-MM-DD_HH-mm-ss.json`
  - `form_export_YYYY-MM-DD_HH-mm-ss.md`
- Logs export progress and errors to Apps Script Logger

**Behavior**:
1. Fetch form data once: `form = FormApp.openById(FORM_ID)`
2. Fetch items once: `items = form.getItems()`
3. Generate JSON export: `exportFormToJson(FORM_ID, form, items)`
4. Generate Markdown export: `exportFormToMarkdown(FORM_ID, form, items)`
5. Save both files to Drive with timestamps

**Error Handling**:
- If form fetch fails: Log error, exit early (neither export proceeds)
- If JSON export fails: Log error, continue to Markdown export
- If Markdown export fails: Log error, continue (JSON already saved)
- If Drive save fails: Log error per file

**Pre-Conditions**:
- `FORM_ID` must be set and valid
- User must have read access to the form
- `EXPORT_FOLDER_ID` must be set and valid (or empty to skip save)

**Post-Conditions**:
- If successful: Both files created with identical form data
- API calls reduced: `FormApp.openById()` called once (not twice)
- API calls reduced: `form.getItems()` called once (not twice)

**Logging**:
```
Total items exported: {count}
{JSON content}
{Markdown content}
Saved to Drive: form_export_{timestamp}.json
Saved to Drive: form_export_{timestamp}.md
```

---

### runExportToJSON()

**Purpose**: Export form to JSON format only (unchanged from original)

**Signature**:
```javascript
function runExportToJSON()
```

**Parameters**: None (uses global `FORM_ID` and `EXPORT_FOLDER_ID`)

**Returns**: `void`

**Side Effects**:
- Creates one file in Google Drive: `form_export_YYYY-MM-DD_HH-mm-ss.json`
- Logs JSON content and save confirmation

**Behavior**: Unchanged from original implementation

**Backward Compatibility**: ✅ No changes required

---

### runExportToMarkdown()

**Purpose**: Export form to Markdown format only (unchanged from original)

**Signature**:
```javascript
function runExportToMarkdown()
```

**Parameters**: None (uses global `FORM_ID` and `EXPORT_FOLDER_ID`)

**Returns**: `void`

**Side Effects**:
- Creates one file in Google Drive: `form_export_YYYY-MM-DD_HH-mm-ss.md`
- Logs Markdown content and save confirmation

**Behavior**: Unchanged from original implementation

**Backward Compatibility**: ✅ No changes required

---

## Export Functions (Module APIs)

### exportFormToJson()

**Purpose**: Convert Google Form to JSON object representation

**Signature** (MODIFIED):
```javascript
function exportFormToJson(formId, optionalForm, optionalItems)
```

**Parameters**:
- `formId` (string, required): Google Form ID (used for validation and fallback)
- `optionalForm` (FormApp.Form, optional): Pre-fetched form object (optimization)
- `optionalItems` (FormApp.Item[], optional): Pre-fetched items array (optimization)

**Returns**: `Object` - JSON representation of the form

```javascript
{
  metadata: {
    title: string,
    id: string,
    description: string,
    publishedUrl: string,
    editorEmails: string[],
    count: number,
    confirmationMessage: string,
    customClosedFormMessage: string
  },
  items: [
    {
      type: string,           // FormApp.ItemType enum as string
      title: string,
      helpText: string,
      id: number,
      index: number,
      isRequired: boolean,
      points: number,         // Always 0 (compatibility field)
      // Type-specific fields:
      choices?: string[],     // MULTIPLE_CHOICE, CHECKBOX, LIST
      hasOtherOption?: boolean,
      lowerBound?: number,    // SCALE
      upperBound?: number,
      leftLabel?: string,
      rightLabel?: string,
      alignment?: string,     // IMAGE, VIDEO
      imageBlob?: {           // IMAGE
        dataAsString: string,
        name: string,
        isGoogleType: boolean
      },
      pageNavigationType?: string  // PAGE_BREAK
    }
  ],
  count: number  // Total items (redundant with items.length)
}
```

**Behavior**:
- If `optionalForm` and `optionalItems` provided: Use them (optimization path)
- If `optionalForm` or `optionalItems` is null/undefined: Fetch data via `FormApp.openById(formId)` (fallback path)
- Process form metadata via `getFormMetadata(form)`
- Process each item via `itemToObject(item)`

**Error Handling**:
- Throws if `formId` is empty or invalid (when fallback fetching)
- Defensive: Missing methods handled with typeof checks and try-catch
- Choice extraction errors logged, returns empty array

**Pre-Conditions**:
- `formId` must be non-empty string
- If `optionalForm` provided, it must be a valid FormApp.Form object
- If `optionalItems` provided, it must be an array

**Post-Conditions**:
- Returns valid JSON object matching schema above
- Does not modify input parameters (read-only)
- `metadata.count` equals `items.length` equals `count` (consistency)

**Backward Compatibility**: ✅ Signature extended with optional parameters; original usage still works

**Example Calls**:
```javascript
// Old usage (still works)
var json = exportFormToJson("abc123");

// New usage (optimization)
var form = FormApp.openById("abc123");
var items = form.getItems();
var json = exportFormToJson("abc123", form, items);
```

---

### exportFormToMarkdown()

**Purpose**: Convert Google Form to Markdown string representation

**Signature** (MODIFIED):
```javascript
function exportFormToMarkdown(formId, optionalForm, optionalItems)
```

**Parameters**:
- `formId` (string, required): Google Form ID (used for validation and fallback)
- `optionalForm` (FormApp.Form, optional): Pre-fetched form object (optimization)
- `optionalItems` (FormApp.Item[], optional): Pre-fetched items array (optimization)

**Returns**: `string` - Markdown-formatted representation of the form

**Format**:
```markdown
# {Form Title}

{Form Description}

## Section 1: {Section Title}

{Section Help Text}

### Q1. {Question Title}

_{Question Help Text}_

_{Question Type Description}_

- Choice 1
- Choice 2

_Default: Continue to next section_

...
```

**Behavior**:
- If `optionalForm` and `optionalItems` provided: Use them (optimization path)
- If `optionalForm` or `optionalItems` is null/undefined: Fetch data via `FormApp.openById(formId)` (fallback path)
- Build section map for page navigation references
- Convert HTML-like formatting to Markdown via `convertToMarkdown()`
- Render type-specific content via `renderItemBodyMarkdown()`

**Error Handling**:
- Throws if `formId` is empty or invalid (when fallback fetching)
- Defensive: Missing methods handled with typeof checks and try-catch
- Skips items with no title (rare edge case)

**Pre-Conditions**:
- `formId` must be non-empty string
- If `optionalForm` provided, it must be a valid FormApp.Form object
- If `optionalItems` provided, it must be an array

**Post-Conditions**:
- Returns valid Markdown string
- Does not modify input parameters (read-only)
- Question counter increases for each non-PAGE_BREAK item

**Backward Compatibility**: ✅ Signature extended with optional parameters; original usage still works

**Example Calls**:
```javascript
// Old usage (still works)
var md = exportFormToMarkdown("abc123");

// New usage (optimization)
var form = FormApp.openById("abc123");
var items = form.getItems();
var md = exportFormToMarkdown("abc123", form, items);
```

---

## Helper Functions (Unchanged)

### getFormMetadata()

**Signature**: `function getFormMetadata(form)`
**Status**: Unchanged
**Location**: exportForm.js

### itemToObject()

**Signature**: `function itemToObject(item)`
**Status**: Unchanged
**Location**: exportForm.js

### convertToMarkdown()

**Signature**: `function convertToMarkdown(text)`
**Status**: Unchanged
**Location**: toMarkdown.js

### renderItemBodyMarkdown()

**Signature**: `function renderItemBodyMarkdown(item, type, sectionMap)`
**Status**: Unchanged
**Location**: toMarkdown.js

### buildSectionMap()

**Signature**: `function buildSectionMap(items)`
**Status**: Unchanged
**Location**: toMarkdown.js

### getNavigationText()

**Signature**: `function getNavigationText(navType, navItem, allItems, sectionMap)`
**Status**: Unchanged
**Location**: toMarkdown.js

### getDefaultSectionNavigation()

**Signature**: `function getDefaultSectionNavigation(pageBreakItem, allItems, sectionMap)`
**Status**: Unchanged
**Location**: toMarkdown.js

### snakeCaseToCamelCase()

**Signature**: `function snakeCaseToCamelCase(s)`
**Status**: Unchanged (duplicated in both modules per Constitution Principle V)
**Location**: exportForm.js, toMarkdown.js

### saveToDrive_()

**Signature**: `function saveToDrive_(fileName, content)`
**Status**: Unchanged
**Location**: Code.js

---

## Contract Testing Scenarios

### Scenario 1: Optimized Path (runExportAll)

**Setup**:
```javascript
FORM_ID = "valid_form_id";
EXPORT_FOLDER_ID = "valid_folder_id";
```

**Execution**:
```javascript
runExportAll();
```

**Expected**:
1. `FormApp.openById()` called exactly once
2. `form.getItems()` called exactly once
3. Two files created with matching timestamps
4. JSON and Markdown contain identical form data (same title, count, item titles)

**Verification**:
```javascript
// Add call counters in test environment
var openByIdCallCount = 0;
var getItemsCallCount = 0;

// After execution:
assert(openByIdCallCount === 1, "openById called once");
assert(getItemsCallCount === 1, "getItems called once");
```

---

### Scenario 2: Backward Compatibility (Individual Exports)

**Setup**:
```javascript
FORM_ID = "valid_form_id";
```

**Execution**:
```javascript
runExportToJSON();
runExportToMarkdown();
```

**Expected**:
1. Each export fetches data independently (no optimization)
2. Output format identical to pre-optimization version
3. Both exports succeed without errors

**Verification**:
- Compare output files byte-for-byte with pre-optimization version
- No changes to entry point signatures

---

### Scenario 3: Error Handling (Invalid Form ID)

**Setup**:
```javascript
FORM_ID = "invalid_or_missing_form";
```

**Execution**:
```javascript
runExportAll();
```

**Expected**:
1. Error logged: "Error fetching form data: ..."
2. No files created
3. Function exits early (neither export proceeds)

**Verification**:
```javascript
// Check logs
assert(logs.includes("Error fetching form data"));

// Check Drive folder
assert(folder.getFilesByName("form_export_*").hasNext() === false);
```

---

### Scenario 4: Partial Failure (JSON Export Error)

**Setup**: Form data valid, but JSON processing throws (simulated via modified itemToObject)

**Execution**:
```javascript
runExportAll();
```

**Expected**:
1. Form data fetched once
2. JSON export error logged
3. Markdown export proceeds successfully
4. One file created (Markdown only)

**Verification**:
- JSON error logged
- Markdown file exists in Drive
- JSON file does not exist

---

## Version Compatibility

**Pre-Optimization Version**:
- Entry points: 3 functions (runExportAll, runExportToJSON, runExportToMarkdown)
- Export functions: 2 functions with single parameter each

**Post-Optimization Version**:
- Entry points: 3 functions (unchanged signatures)
- Export functions: 2 functions with 3 parameters each (2 optional)

**Breaking Changes**: None
**Deprecations**: None
**Migration Required**: None (fully backward compatible)

---

## Performance Contracts

### runExportAll() Performance

**API Call Reduction**:
- Before: 4 calls (2× openById, 2× getItems)
- After: 2 calls (1× openById, 1× getItems)
- Reduction: 50%

**Execution Time** (typical form with 20 items):
- Before: ~300-600ms
- After: ~200-400ms
- Savings: ~100-200ms

### Individual Exports Performance

**API Calls**: Unchanged (2 calls: openById + getItems)
**Execution Time**: Unchanged (no optimization when called individually)

---

## Security Contracts

### Data Access

**Principle**: Export functions must not modify form data or expose it beyond intended scope

**Contracts**:
1. Export functions receive read-only access to form objects
2. No data persisted beyond function execution (no caching)
3. No data sent to external services (only Google Drive save)
4. User permissions unchanged (existing FormApp.openById checks apply)

### Secret Management

**Principle**: No changes to secrets management or build process

**Contracts**:
1. `FORM_ID` remains template placeholder in source files
2. Injection workflow unchanged
3. No new secrets introduced
4. No logging of sensitive IDs (only counts and titles)

---

## Deprecation Policy

**Current Deprecations**: None

**Future Considerations**:
- If Google Apps Script introduces native caching: Consider deprecating manual optimization
- If FormApp API adds batch operations: Consider alternative optimization patterns

**Commitment**: Maintain backward compatibility for all entry point functions (public API)
