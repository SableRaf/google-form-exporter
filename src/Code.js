// Global config
var SOURCE_FORM_ID = "{{SOURCE_FORM_ID}}";
var TARGET_FORM_ID = "{{TARGET_FORM_ID}}";
var EXPORT_FOLDER_ID = "{{EXPORT_FOLDER_ID}}";
var IMPORT_FILE_ID = "{{IMPORT_FILE_ID}}";

/**
 * Exports form as both JSON and Markdown formats.
 * Fetches the source form once and passes the shared data to both exporters.
 *
 * @return {void}
 */
function runExportAll() {
  var form, items;

  try {
    Logger.log("Fetching form data...");
    form = FormApp.openById(SOURCE_FORM_ID);
    Logger.log("Form title: \"" + form.getTitle() + "\"");
    Logger.log("Fetching form items...");
    items = form.getItems();
  } catch (e) {
    Logger.log("Error fetching form data: " + e.message);
    return; // Exit early, neither export proceeds
  }

  // Export to JSON (reusing fetched data)
  try {
    var json = exportFormToJson(SOURCE_FORM_ID, form, items);
    var stringified = JSON.stringify(json, null, 2);

    Logger.log("Total items exported: " + json.count);
    Logger.log(stringified.split('\n').slice(0, 5).join('\n') + '\n\n[' + (stringified.split('\n').length - 5) + ' more lines...]');

    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm-ss");
    var fileName = "form_export_" + timestamp + ".json";

    saveToDrive_(fileName, stringified);
  } catch (e) {
    Logger.log("Error exporting JSON: " + e.message);
  }

  // Export to Markdown (reusing fetched data)
  try {
    var md = exportFormToMarkdown(SOURCE_FORM_ID, form, items);
    Logger.log(md.split('\n').slice(0, 5).join('\n') + '\n\n[' + (md.split('\n').length - 5) + ' more lines...]');

    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm-ss");
    var fileName = "form_export_" + timestamp + ".md";

    saveToDrive_(fileName, md);
  } catch (e) {
    Logger.log("Error exporting Markdown: " + e.message);
  }
}

/**
 * Exports form as JSON format and saves to Google Drive.
 * Uses the global SOURCE_FORM_ID configuration to fetch the form data.
 *
 * @return {void}
 */
function runExportToJSON() {
  var json = exportFormToJson(SOURCE_FORM_ID);
  var stringified = JSON.stringify(json, null, 2);

  Logger.log("Total items exported: " + json.count);
  Logger.log(stringified);

  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm-ss");
  var fileName = "form_export_" + timestamp + ".json";

  saveToDrive_(fileName, stringified);
}

/**
 * Exports form as Markdown format and saves to Google Drive.
 * Uses the global SOURCE_FORM_ID configuration to fetch the form data.
 *
 * @return {void}
 */
function runExportToMarkdown() {
  var md = exportFormToMarkdown(SOURCE_FORM_ID);
  Logger.log(md);

  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm-ss");
  var fileName = "form_export_" + timestamp + ".md";

  saveToDrive_(fileName, md);
}

/**
 * Imports a previously exported JSON file into the configured target form.
 * Validates configuration and JSON shape before handing off to the importer.
 *
 * @return {void}
 */
function runImportFromJson() {
  if (isMissingConfigValue_(TARGET_FORM_ID)) {
    Logger.log("TARGET_FORM_ID is not configured. Set TARGET_FORM_ID in .env, run npm run push, and try again.");
    return;
  }

  if (isMissingConfigValue_(IMPORT_FILE_ID)) {
    Logger.log("IMPORT_FILE_ID is not configured. Set IMPORT_FILE_ID in .env, run npm run push, and try again.");
    return;
  }

  var jsonObject;
  try {
    var jsonString = DriveApp.getFileById(IMPORT_FILE_ID).getBlob().getDataAsString();
    jsonObject = JSON.parse(jsonString);
  } catch (e) {
    Logger.log("Error reading import JSON: " + e.message);
    return;
  }

  if (
    !jsonObject ||
    Object.prototype.toString.call(jsonObject.metadata) !== "[object Object]" ||
    !Array.isArray(jsonObject.items)
  ) {
    Logger.log("Import JSON must contain a metadata object and an items array.");
    return;
  }

  if (jsonObject.metadata.id === TARGET_FORM_ID) {
    Logger.log("Import notice: TARGET_FORM_ID matches metadata.id. The source form itself will be overwritten.");
  }

  try {
    var summary = importFormFromJson_(TARGET_FORM_ID, jsonObject);
    Logger.log(
      "Import complete. Created " +
        summary.created +
        " items, skipped " +
        summary.skipped.length +
        ", warnings " +
        summary.warnings.length +
        "."
    );

    if (summary.skipped.length) {
      Logger.log("Skipped items: " + summary.skipped.join("; "));
    }

    if (summary.warnings.length) {
      Logger.log("Warnings:");
      summary.warnings.forEach(function(warning) {
        Logger.log("- " + warning);
      });
    }
  } catch (e) {
    Logger.log("Error importing form: " + e.message);
  }
}

/**
 * Saves content to the configured Google Drive folder.
 * Uses the global EXPORT_FOLDER_ID to determine the target folder.
 * Logs success or error messages to the Apps Script Logger.
 *
 * @param {string} fileName - Name of the file to create
 * @param {string} content - Content to write to the file
 * @return {void}
 * @private
 */
function saveToDrive_(fileName, content) {
  if (!EXPORT_FOLDER_ID) return;

  try {
    var folder = DriveApp.getFolderById(EXPORT_FOLDER_ID);
    folder.createFile(fileName, content, "text/plain");
    Logger.log("Saved to Drive: " + fileName + " at: \nhttps://drive.google.com/drive/folders/" + EXPORT_FOLDER_ID);
  } catch (e) {
    Logger.log("Error saving to Drive: " + e.message);
  }
}

/**
 * Detects unset config values after template injection.
 * Treats placeholder strings as missing so the Apps Script UI can guide setup errors.
 *
 * @param {string} value - Configuration value to inspect
 * @return {boolean} True when the value is empty or still a template placeholder
 * @private
 */
function isMissingConfigValue_(value) {
  return !value || /^\s*$/.test(value) || /{{[^}]+}}/.test(value);
}
