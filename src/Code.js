// Global config
var FORM_ID = "{{FORM_ID}}";
var EXPORT_FOLDER_ID = "{{EXPORT_FOLDER_ID}}";

/**
 * Export form as JSON and Markdown (optimized to fetch form data once)
 *
 * This function fetches the form and items once, then passes them to both
 * export functions to avoid redundant API calls (50% reduction: 4 calls → 2 calls)
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
    Logger.log(stringified.split('\n').slice(0, 5).join('\n'));
    Logger.log('[' + (stringified.split('\n').length - 5) + ' more lines...]');

    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm-ss");
    var fileName = "form_export_" + timestamp + ".json";

    saveToDrive_(fileName, stringified);
  } catch (e) {
    Logger.log("Error exporting JSON: " + e.message);
  }

  // Export to Markdown (reusing fetched data)
  try {
    var md = exportFormToMarkdown(FORM_ID, form, items);
    Logger.log(md.split('\n').slice(0, 5).join('\n'));
    Logger.log('[' + (md.split('\n').length - 5) + ' more lines...]');

    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm-ss");
    var fileName = "form_export_" + timestamp + ".md";

    saveToDrive_(fileName, md);
  } catch (e) {
    Logger.log("Error exporting Markdown: " + e.message);
  }
}


/**
 * Export form as JSON
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
 * Export form as Markdown
 */
function runExportToMarkdown() {
  var md = exportFormToMarkdown(FORM_ID);
  Logger.log(md);

  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm-ss");
  var fileName = "form_export_" + timestamp + ".md";

  saveToDrive_(fileName, md);
}

/**
 * Save content to Google Drive folder
 */
function saveToDrive_(fileName, content) {
  if (!EXPORT_FOLDER_ID) return;

  try {
    var folder = DriveApp.getFolderById(EXPORT_FOLDER_ID);
    folder.createFile(fileName, content, "text/plain");
    Logger.log("Saved to Drive: " + fileName);
    Logger.log("Link: https://drive.google.com/drive/folders/" + EXPORT_FOLDER_ID + "/" + fileName);
  } catch (e) {
    Logger.log("Error saving to Drive: " + e.message);
  }
}