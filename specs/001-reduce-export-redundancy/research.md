# Phase 0: Research & Design Decisions

**Feature**: Reduce Export Redundancy
**Date**: 2025-12-11
**Status**: Complete

## Research Questions

### Q1: Refactoring Approach for Module Independence (Constitution Principle V)

**Context**: Both `exportFormToJson()` and `exportFormToMarkdown()` currently call `FormApp.openById(formId)` and `form.getItems()` independently. To eliminate redundancy in `runExportAll()`, we need to fetch this data once and share it between both export functions while maintaining module independence.

**Options Evaluated**:

#### Option A: Parameter-Based Refactoring (Function Overloading)
Refactor both export functions to accept optional parameters (form object, items array) while maintaining backward compatibility:

```javascript
// Modified signatures (backward compatible):
function exportFormToJson(formId, optionalForm, optionalItems) {
  var form = optionalForm || FormApp.openById(formId);
  var items = optionalItems || form.getItems();
  // ... rest of logic unchanged
}

function exportFormToMarkdown(formId, optionalForm, optionalItems) {
  var form = optionalForm || FormApp.openById(formId);
  var items = optionalItems || form.getItems();
  // ... rest of logic unchanged
}

// Code.js orchestration:
function runExportAll() {
  var form = FormApp.openById(FORM_ID);
  var items = form.getItems();

  var json = exportFormToJson(FORM_ID, form, items);
  var md = exportFormToMarkdown(FORM_ID, form, items);

  // ... save to drive
}
```

**Pros**:
- Minimal changes to existing export logic
- Backward compatible (individual exports work unchanged)
- No new abstractions or files needed
- Clear data flow (explicit parameter passing)

**Cons**:
- Function signatures become slightly more complex
- Requires changes to both export module files

#### Option B: Shared Data-Fetching Utility
Create a new utility function in `Code.js` that both modules call:

```javascript
// Code.js
function fetchFormData_(formId) {
  var form = FormApp.openById(formId);
  return {
    form: form,
    items: form.getItems()
  };
}

// No changes to exportFormToJson or exportFormToMarkdown
// runExportAll calls fetchFormData_ once, then passes data
```

**Pros**:
- Export functions remain unchanged
- Centralized data-fetching logic

**Cons**:
- Creates new coupling (both modules depend on Code.js helper)
- Still requires export functions to accept parameters
- Adds abstraction layer without clear benefit

#### Option C: Global Variable Pattern
Use a temporary global variable to pass data:

```javascript
// Code.js
var _cachedFormData = null;

function runExportAll() {
  _cachedFormData = {
    form: FormApp.openById(FORM_ID),
    items: null // set after form fetched
  };
  _cachedFormData.items = _cachedFormData.form.getItems();

  var json = exportFormToJson(FORM_ID);
  var md = exportFormToMarkdown(FORM_ID);

  _cachedFormData = null; // cleanup
}

// Export modules check global variable first
```

**Pros**:
- No signature changes needed

**Cons**:
- Anti-pattern (hidden global state)
- Makes testing and debugging harder
- Violates principle of explicit dependencies
- Risk of stale data if cleanup fails

### Decision: Option A (Parameter-Based Refactoring)

**Rationale**:
1. **Simplicity**: Minimal changes, no new abstractions
2. **Explicitness**: Data flow is clear and traceable
3. **Backward Compatibility**: Optional parameters preserve existing API
4. **Module Independence**: Export modules remain self-contained; no cross-file dependencies created
5. **Platform Alignment**: Google Apps Script's global namespace makes parameter passing the most natural pattern

**Alternatives Considered**:
- Option B rejected because it adds unnecessary abstraction without measurable benefit
- Option C rejected because global state violates defensive programming principles and makes code harder to reason about

**Implementation Impact**:
- Files modified: `src/Code.js`, `src/exportForm.js`, `src/toMarkdown.js`
- No new files needed
- No changes to build/deployment process
- Testing approach: Verify individual exports still work, verify runExportAll calls APIs once

---

### Q2: Best Practices for Apps Script Function Refactoring

**Context**: Google Apps Script uses a global namespace without module system. What patterns ensure safe refactoring?

**Research Findings**:

#### Pattern 1: Optional Parameters with Default Values
Apps Script supports ES6 default parameters with fallback:
```javascript
function myFunction(required, optional) {
  optional = optional || defaultValue;
}
```

**Best Practice**: Use `||` operator for backward-compatible optional parameters since Apps Script V8 supports it reliably.

#### Pattern 2: Defensive Parameter Validation
Given Apps Script's limited debugging tools, validate parameters explicitly:
```javascript
function exportFormToJson(formId, optionalForm, optionalItems) {
  if (!formId) {
    throw new Error("formId is required");
  }
  var form = optionalForm || FormApp.openById(formId);
  var items = optionalItems || form.getItems();
  // ...
}
```

**Best Practice**: Add validation for required parameters; use fallback fetching for optional parameters to maintain dual-mode operation.

#### Pattern 3: Preserve Defensive Programming
Existing code uses `typeof` checks and try-catch for API quirks:
```javascript
if (typeof item.isRequired === "function") {
  try {
    isRequired = item.isRequired();
  } catch (e) {
    isRequired = false;
  }
}
```

**Best Practice**: Maintain all existing defensive patterns unchanged during refactoring. These handle documented Apps Script API inconsistencies.

---

### Q3: Error Handling Strategy for Shared Data Fetching

**Context**: If `FormApp.openById()` fails in `runExportAll()`, both exports should fail with the same error. How should errors be propagated?

**Research Findings**:

#### Current Error Handling
Individual export functions handle their own errors:
```javascript
function runExportToJSON() {
  try {
    var json = exportFormToJson(FORM_ID);
    // ... save
  } catch (e) {
    Logger.log("Error: " + e.message);
  }
}
```

#### Recommended Approach for runExportAll()
Fail fast if data fetching fails, before attempting either export:

```javascript
function runExportAll() {
  var form, items;

  try {
    form = FormApp.openById(FORM_ID);
    items = form.getItems();
  } catch (e) {
    Logger.log("Error fetching form data: " + e.message);
    return; // Exit early, neither export proceeds
  }

  // Both exports use validated data
  try {
    var json = exportFormToJson(FORM_ID, form, items);
    var stringified = JSON.stringify(json, null, 2);
    saveToDrive_("form_export_" + timestamp() + ".json", stringified);
  } catch (e) {
    Logger.log("Error exporting JSON: " + e.message);
  }

  try {
    var md = exportFormToMarkdown(FORM_ID, form, items);
    saveToDrive_("form_export_" + timestamp() + ".md", md);
  } catch (e) {
    Logger.log("Error exporting Markdown: " + e.message);
  }
}
```

**Best Practice**:
- Fetch data once with single try-catch
- If fetching fails, log error and exit (neither export proceeds)
- Wrap each export independently so one failure doesn't block the other
- Mirrors existing error handling pattern but optimizes data fetching

---

## Summary of Decisions

### Technical Decisions

| Decision | Chosen Approach | Rationale |
|----------|----------------|-----------|
| Refactoring Pattern | Parameter-based with optional parameters (Option A) | Simplest, most explicit, maintains module independence |
| Parameter Style | Optional parameters with `\|\|` fallback | Backward compatible, idiomatic Apps Script |
| Error Handling | Fail-fast on data fetch; independent export error handling | Prevents inconsistent state, allows partial success |
| Defensive Patterns | Preserve all existing typeof checks and try-catch | Required for Apps Script API quirks (Constitution Principle II) |

### Implementation Approach

1. Modify `exportFormToJson(formId, optionalForm, optionalItems)` to accept optional parameters
2. Modify `exportFormToMarkdown(formId, optionalForm, optionalItems)` to accept optional parameters
3. Update `runExportAll()` to fetch data once and pass to both functions
4. Preserve individual export entry points (`runExportToJSON()`, `runExportToMarkdown()`) unchanged
5. Add defensive validation for form data (fail fast if null/undefined)

### Files to Modify

- `src/Code.js` - Update `runExportAll()` orchestration
- `src/exportForm.js` - Add optional parameters to `exportFormToJson()`
- `src/toMarkdown.js` - Add optional parameters to `exportFormToMarkdown()`

### Testing Strategy

Manual testing scenarios (executed via Apps Script editor):

1. **Test runExportAll()**: Verify both files created, verify logs show single fetch
2. **Test runExportToJSON()**: Verify still works independently
3. **Test runExportToMarkdown()**: Verify still works independently
4. **Test invalid form ID**: Verify error logged, no files created
5. **Test large form (50+ items)**: Verify both exports complete successfully

---

## Research Complete

All clarifications resolved. Ready for Phase 1 (Design & Contracts).
