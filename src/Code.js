// Global config
var FORM_ID = "{{FORM_ID}}";
var EXPORT_FOLDER_ID = "{{EXPORT_FOLDER_ID}}";

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
 * Export form as JSON and Markdown
 */
function runExportAll() {
  runExportToJSON();
  runExportToMarkdown();
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
  } catch (e) {
    Logger.log("Error saving to Drive: " + e.message);
  }
}