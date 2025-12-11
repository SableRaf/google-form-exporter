// Global config
var FORM_ID = "{{FORM_ID}}";
var EXPORT_FOLDER_ID = "{{EXPORT_FOLDER_ID}}";

/**
 * Exports form as both JSON and Markdown formats.
 * This function optimizes performance by fetching the form and items once,
 * then passing them to both exporters to avoid redundant API calls.
 *
 * @return {void}
 */
function runExportAll() {
  // Shared data-fetching phase - fetch once and reuse for both exports
  var form, items;

  try {
    Logger.log("Fetching form data...");
    form = FormApp.openById(FORM_ID);
    Logger.log("Form title: \"" + form.getTitle() + "\"");
    Logger.log("Fetching form items...");
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
    Logger.log(stringified.split('\n').slice(0, 5).join('\n') + '\n\n[' + (stringified.split('\n').length - 5) + ' more lines...]');

    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm-ss");
    var fileName = "form_export_" + timestamp + ".json";

    saveToDrive_(fileName, stringified);
  } catch (e) {
    Logger.log("Error exporting JSON: " + e.message);
  }

  // Export to Markdown (reusing fetched data)
  try {
    var md = exportFormToMarkdown(FORM_ID, form, items);
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
 * Uses the global FORM_ID configuration to fetch the form data.
 *
 * @return {void}
 */
function runExportToJSON() {
  var json = exportFormToJson(FORM_ID);
  var stringified = JSON.stringify(json, null, 2);

  Logger.log("Total items exported: " + json.count);
  Logger.log(stringified);

  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm-ss");
  var fileName = "form_export_" + timestamp + ".json";

  saveToDrive_(fileName, stringified);
}

/**
 * Exports form as Markdown format and saves to Google Drive.
 * Uses the global FORM_ID configuration to fetch the form data.
 *
 * @return {void}
 */
function runExportToMarkdown() {
  var md = exportFormToMarkdown(FORM_ID);
  Logger.log(md);

  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm-ss");
  var fileName = "form_export_" + timestamp + ".md";

  saveToDrive_(fileName, md);
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
    Logger.log("Saved to Drive: " + fileName + " at:");
    Logger.log("https://drive.google.com/drive/folders/" + EXPORT_FOLDER_ID);
  } catch (e) {
    Logger.log("Error saving to Drive: " + e.message);
  }
}