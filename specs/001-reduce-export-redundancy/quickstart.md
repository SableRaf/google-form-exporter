# Quickstart Guide: Export Redundancy Optimization

**Feature**: Reduce Export Redundancy
**Audience**: Developers implementing this feature
**Date**: 2025-12-11

## Overview

This guide provides step-by-step instructions for implementing the export redundancy optimization. The feature reduces duplicate Google Apps Script API calls when exporting forms to both JSON and Markdown formats.

**Goal**: Fetch form data once and reuse it for both exporters, reducing API calls by 50%.

---

## Prerequisites

Before starting implementation:

1. **Read the design documents**:
   - [spec.md](spec.md) - Feature requirements
   - [research.md](research.md) - Design decisions
   - [data-model.md](data-model.md) - Data structures
   - [contracts/api.md](contracts/api.md) - API contracts

2. **Understand the current codebase**:
   - Review [src/Code.js](../../../src/Code.js) - Entry points
   - Review [src/exportForm.js](../../../src/exportForm.js) - JSON export
   - Review [src/toMarkdown.js](../../../src/toMarkdown.js) - Markdown export

3. **Set up development environment**:
   ```bash
   # Clone repo (if not already done)
   git clone <repo-url>
   cd google-form-exporter

   # Install dependencies
   npm install

   # Copy environment configuration
   cp .env.example .env
   # Edit .env and fill in your FORM_ID, EXPORT_FOLDER_ID, SCRIPT_ID

   # Verify clasp authentication
   npx clasp login
   ```

---

## Implementation Steps

### Step 1: Modify exportFormToJson() Signature

**File**: `src/exportForm.js`

**Current signature**:
```javascript
function exportFormToJson(formId) {
  var form = FormApp.openById(formId);
  var items = form.getItems();
  // ... rest of logic
}
```

**New signature** (add optional parameters):
```javascript
function exportFormToJson(formId, optionalForm, optionalItems) {
  // Fallback to fetching if optional params not provided
  var form = optionalForm || FormApp.openById(formId);
  var items = optionalItems || form.getItems();

  // Rest of logic unchanged
  var result = {
    metadata: getFormMetadata(form),
    items: items.map(itemToObject),
    count: items.length
  };

  return result;
}
```

**Changes**:
- Add two new parameters: `optionalForm`, `optionalItems`
- Use `||` operator for fallback: if optional params are null/undefined, fetch data
- Rest of function logic remains identical

**Test**:
```javascript
// Old usage still works (fallback path):
var json1 = exportFormToJson("form_id_here");

// New usage (optimization path):
var form = FormApp.openById("form_id_here");
var items = form.getItems();
var json2 = exportFormToJson("form_id_here", form, items);

// Verify both produce identical output:
Logger.log(JSON.stringify(json1) === JSON.stringify(json2)); // true
```

---

### Step 2: Modify exportFormToMarkdown() Signature

**File**: `src/toMarkdown.js`

**Current signature**:
```javascript
function exportFormToMarkdown(formId) {
  var form = FormApp.openById(formId);
  var items = form.getItems();
  // ... rest of logic
}
```

**New signature** (add optional parameters):
```javascript
function exportFormToMarkdown(formId, optionalForm, optionalItems) {
  // Fallback to fetching if optional params not provided
  var form = optionalForm || FormApp.openById(formId);
  var items = optionalItems || form.getItems();

  // Rest of logic unchanged
  var lines = [];

  // Title and description
  lines.push("# " + form.getTitle());
  var description = form.getDescription();
  if (description) {
    lines.push("");
    lines.push(convertToMarkdown(description));
  }

  // ... rest of rendering logic unchanged

  return lines.join("\n");
}
```

**Changes**:
- Add two new parameters: `optionalForm`, `optionalItems`
- Use `||` operator for fallback
- Rest of function logic remains identical

**Test**:
```javascript
// Old usage still works:
var md1 = exportFormToMarkdown("form_id_here");

// New usage (optimization path):
var form = FormApp.openById("form_id_here");
var items = form.getItems();
var md2 = exportFormToMarkdown("form_id_here", form, items);

// Verify both produce identical output:
Logger.log(md1 === md2); // true
```

---

### Step 3: Update runExportAll() Orchestration

**File**: `src/Code.js`

**Current implementation**:
```javascript
function runExportAll() {
  runExportToJSON();
  runExportToMarkdown();
}
```

**New implementation** (fetch once, reuse):
```javascript
function runExportAll() {
  // Fetch form data once
  var form, items;

  try {
    form = FormApp.openById(FORM_ID);
    items = form.getItems();
  } catch (e) {
    Logger.log("Error fetching form data: " + e.message);
    return; // Exit early, neither export proceeds
  }

  // Export to JSON (reusing fetched data)
  try {
    var json = exportFormToJson(FORM_ID, form, items);
    var stringified = JSON.stringify(json, null, 2);

    Logger.log("Total items exported: " + json.count);
    Logger.log(stringified);

    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm-ss");
    var fileName = "form_export_" + timestamp + ".json";

    saveToDrive_(fileName, stringified);
  } catch (e) {
    Logger.log("Error exporting JSON: " + e.message);
  }

  // Export to Markdown (reusing fetched data)
  try {
    var md = exportFormToMarkdown(FORM_ID, form, items);
    Logger.log(md);

    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm-ss");
    var fileName = "form_export_" + timestamp + ".md";

    saveToDrive_(fileName, md);
  } catch (e) {
    Logger.log("Error exporting Markdown: " + e.message);
  }
}
```

**Changes**:
- Add shared fetch phase at the start
- Wrap fetch in try-catch (fail fast if data unavailable)
- Pass fetched `form` and `items` to both export functions
- Wrap each export independently (one failure doesn't block the other)
- Inline the logic from `runExportToJSON()` and `runExportToMarkdown()` (avoid duplicate fetches)

**Why not call runExportToJSON() / runExportToMarkdown()?**
- Those functions call `exportFormToJson(FORM_ID)` without passing optional params
- Would trigger fallback fetching (defeating the optimization)
- Better to inline the orchestration logic in `runExportAll()`

**Test**:
```javascript
runExportAll();
// Verify two files created
// Verify logs show "Total items exported: X" once (not twice)
```

---

### Step 4: Verify Individual Exports Still Work

**File**: `src/Code.js`

**These functions should remain unchanged**:
```javascript
function runExportToJSON() {
  var json = exportFormToJson(FORM_ID);
  var stringified = JSON.stringify(json, null, 2);

  Logger.log("Total items exported: " + json.count);
  Logger.log(stringified);

  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm-ss");
  var fileName = "form_export_" + timestamp + ".json";

  saveToDrive_(fileName, stringified);
}

function runExportToMarkdown() {
  var md = exportFormToMarkdown(FORM_ID);
  Logger.log(md);

  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm-ss");
  var fileName = "form_export_" + timestamp + ".md";

  saveToDrive_(fileName, md);
}
```

**Verification**:
- These still call export functions with only `formId` (no optional params)
- Export functions use fallback fetching (`|| FormApp.openById(formId)`)
- Backward compatibility maintained

**Test**:
```javascript
runExportToJSON();   // Should work identically to before
runExportToMarkdown(); // Should work identically to before
```

---

## Testing Checklist

After implementing all changes, manually test these scenarios in the Apps Script editor:

### Test 1: Optimized Dual Export

1. Open Apps Script editor
2. Select `runExportAll` function
3. Click "Run"
4. **Verify logs**:
   - Look for "Total items exported: X" (should appear once, not twice)
   - Check that both JSON and Markdown content are logged
   - Check for "Saved to Drive" messages for both files
5. **Verify Drive folder**:
   - Two files with matching timestamps
   - JSON file contains valid JSON
   - Markdown file contains valid Markdown
6. **Verify content matches**:
   - Compare form title in both files (should be identical)
   - Compare item count (should be identical)

### Test 2: Individual JSON Export

1. Select `runExportToJSON` function
2. Click "Run"
3. **Verify**:
   - JSON file created
   - Output identical to pre-optimization version
   - No errors logged

### Test 3: Individual Markdown Export

1. Select `runExportToMarkdown` function
2. Click "Run"
3. **Verify**:
   - Markdown file created
   - Output identical to pre-optimization version
   - No errors logged

### Test 4: Error Handling (Invalid Form ID)

1. Edit `Code.js` temporarily: Change `FORM_ID` to `"invalid_id_12345"`
2. Run `runExportAll`
3. **Verify**:
   - Error logged: "Error fetching form data: ..."
   - No files created in Drive
   - Function exits early (no "Total items exported" log)
4. **Restore**: Change `FORM_ID` back to original value

### Test 5: Large Form (Performance)

1. Use a form with 50+ items
2. Run `runExportAll`
3. **Verify**:
   - Both exports complete successfully
   - No timeout errors
   - Both files contain all items

---

## Deployment

Once all tests pass:

1. **Commit changes**:
   ```bash
   git add src/Code.js src/exportForm.js src/toMarkdown.js
   git commit -m "Optimize runExportAll to reduce redundant API calls"
   ```

2. **Push to Apps Script**:
   ```bash
   npm run push
   ```

3. **Verify deployment**:
   - Open Apps Script editor
   - Verify all three files updated
   - Run `runExportAll` one final time

4. **Update documentation**:
   - If CLAUDE.md needs updates, add performance notes
   - Update version number if applicable

---

## Troubleshooting

### Issue: "TypeError: Cannot read property 'getItems' of undefined"

**Cause**: `form` is null/undefined (fetch failed)
**Solution**: Check that `FORM_ID` is correct and user has access

### Issue: "Exports produce different output"

**Cause**: Data changed between fetches (should not happen with optimization)
**Solution**: Verify both exports use the same `form` and `items` objects

### Issue: "Individual exports broken"

**Cause**: Fallback logic (`||` operator) not working
**Solution**: Verify optional parameters default to null/undefined when not passed

### Issue: "Performance not improved"

**Cause**: Export functions still fetching data internally
**Solution**: Verify `runExportAll()` passes optional parameters to both export functions

---

## Success Criteria

✅ Implementation complete when:

1. `runExportAll()` calls `FormApp.openById()` exactly once
2. `runExportAll()` calls `form.getItems()` exactly once
3. Both export files created with identical form data
4. `runExportToJSON()` still works independently (backward compatible)
5. `runExportToMarkdown()` still works independently (backward compatible)
6. All defensive programming patterns preserved (typeof checks, try-catch)
7. No new external dependencies introduced
8. All manual tests pass

---

## Next Steps

After completing implementation and testing:

1. **Create pull request** (if using feature branch workflow)
2. **Update CLAUDE.md** with performance notes
3. **Close feature branch**: Run `/speckit.tasks` to generate implementation tasks (if desired)
4. **Monitor production**: Verify optimization works for real-world forms

---

## References

- [Feature Specification](spec.md)
- [Research & Design Decisions](research.md)
- [Data Model](data-model.md)
- [API Contracts](contracts/api.md)
- [Project Constitution](../../../.specify/memory/constitution.md)
- [Google Apps Script FormApp Reference](https://developers.google.com/apps-script/reference/forms)

---

## Questions?

If you encounter issues during implementation:

1. Review the research.md design decisions
2. Check the contracts/api.md for expected behavior
3. Verify compliance with project constitution principles
4. Test with a simple form first (5-10 items) before large forms
