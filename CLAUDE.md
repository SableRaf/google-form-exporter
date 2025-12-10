# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Google Apps Script project that exports Google Forms to JSON and Markdown formats. The exported files are saved to Google Drive.

## Technology Stack

- **Runtime**: Google Apps Script (V8 runtime)
- **Language**: JavaScript (ES5/ES6 compatible with Apps Script)
- **APIs Used**:
  - FormApp (Google Forms API)
  - DriveApp (Google Drive API)
  - Utilities (Apps Script built-ins)

## Deployment

This project uses `clasp` (Command Line Apps Script Projects) for deployment.

### Setup

1. Copy [.env.example](.env.example) to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your configuration:
   ```
   SCRIPT_ID=your_script_id_here
   FORM_ID=your_form_id_here
   EXPORT_FOLDER_ID=your_folder_id_here
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

### Commands

- **Push to Google Apps Script**: `npm run push`
  - Injects environment variables from `.env` into [.clasp.json](.clasp.json) and [src/Code.js](src/Code.js)
  - Pushes code to Google Apps Script via `clasp push`
- **Pull from Google Apps Script**: `npm run pull`
- **Open in Apps Script editor**: `npm run open`

Configuration values (script ID, form ID, folder ID) are injected from `.env` during deployment. Source files are in the [src/](src/) directory.

## Architecture

### Entry Points ([src/Code.js](src/Code.js))

Three main functions can be run from the Apps Script editor:

1. **runExportAll()** - Exports both JSON and Markdown formats
2. **runExportToJSON()** - Exports only JSON format
3. **runExportToMarkdown()** - Exports only Markdown format

Global configuration at the top of [src/Code.js](src/Code.js):
- `FORM_ID` - The Google Form to export (injected from `.env` during deployment)
- `EXPORT_FOLDER_ID` - Google Drive folder for exported files (injected from `.env` during deployment)

### Core Export Modules

**[src/exportForm.js](src/exportForm.js)** - JSON Export
- `exportFormToJson(formId)` - Main entry point for JSON export
- `getFormMetadata(form)` - Extracts form-level metadata (title, description, editors, etc.)
- `itemToObject(item)` - Converts form items to JSON objects
- Handles all form item types: TEXT, PARAGRAPH_TEXT, MULTIPLE_CHOICE, CHECKBOX, LIST, SCALE, IMAGE, PAGE_BREAK, VIDEO
- Uses type downcasting pattern via `AS_*_ITEM` methods to access type-specific properties

**[src/toMarkdown.js](src/toMarkdown.js)** - Markdown Export
- `exportFormToMarkdown(formId)` - Main entry point for Markdown export
- `convertToMarkdown(text)` - Converts Google Forms rich text (HTML-like) to Markdown
- `renderItemBodyMarkdown(item, type, sectionMap)` - Renders different question types as Markdown
- `buildSectionMap(items)` - Maps page break indices to section numbers for navigation
- `getNavigationText()` / `getDefaultSectionNavigation()` - Handles section navigation logic for multi-page forms

### Shared Utilities

**Helper in [src/Code.js](src/Code.js)**:
- `saveToDrive_(fileName, content)` - Saves content to Google Drive with timestamp

**Helper in both [src/exportForm.js](src/exportForm.js) and [src/toMarkdown.js](src/toMarkdown.js)**:
- `snakeCaseToCamelCase(s)` - Converts SNAKE_CASE to camelCase for Apps Script method names

## Key Design Patterns

### Type Handling
Google Apps Script uses a downcasting pattern to access type-specific properties:
```javascript
var itemTypeConstructorName = snakeCaseToCamelCase("AS_" + itemType.toString() + "_ITEM");
var typedItem = item[itemTypeConstructorName]();
```
This converts `FormApp.ItemType.MULTIPLE_CHOICE` → `asMultipleChoiceItem()` method.

### Section Navigation
Multi-page forms use PAGE_BREAK items that can have navigation logic:
- CONTINUE - Go to next section
- SUBMIT - Submit the form
- GO_TO_PAGE - Jump to a specific section

The Markdown exporter tracks section numbers and resolves navigation references to show where each choice leads.

### Error Handling
The code uses defensive programming for optional methods:
```javascript
if (typeof item.isRequired === "function") {
  try {
    isRequired = item.isRequired();
  } catch (e) {
    isRequired = false;
  }
}
```
This is necessary because not all item types implement all methods.

## Configuration

Duplicate the [.env.example](.env.example) file to `.env` and fill in your values.

Configuration is managed via environment variables in the `.env` file:
- `FORM_ID` - Your target Google Form ID (injected into [src/Code.js](src/Code.js))
- `EXPORT_FOLDER_ID` - Your Google Drive folder ID for exports (injected into [src/Code.js](src/Code.js))

These values are automatically injected when you run `npm run push`.

Also duplicate the [.clasp.json.example](.clasp.json.example) to `.clasp.json` and configure the script ID:

```json
{
  "scriptId": "your_script_id_here",
  ...
}
```

## File Naming

Exported files use timestamps in format: `yyyy-MM-dd_HH-mm-ss`
- JSON: `form_export_<timestamp>.json`
- Markdown: `form_export_<timestamp>.md`

## Limitations & Quirks

- IMAGE items include base64 encoded blob data in JSON exports
- VIDEO items are handled separately despite being a form item type
- Some item types may not implement all methods (e.g., `isRequired()`) - code handles this defensively
- The "points" field in JSON is kept for compatibility but always set to 0
- Markdown export cannot perfectly represent all form features (e.g., underline formatting is kept as HTML)
