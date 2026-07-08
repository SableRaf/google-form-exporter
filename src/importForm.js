/**
 * Rebuilds an existing Google Form from a previously exported JSON object.
 * Creates all items before applying properties so section navigation can target items that already exist.
 *
 * @param {string} targetFormId - Existing Google Form ID to replace
 * @param {Object} jsonObject - Parsed JSON export with metadata and items
 * @return {{created: number, skipped: string[], warnings: string[]}} Summary of the import run
 */
function importFormFromJson_(targetFormId, jsonObject) {
  var form = FormApp.openById(targetFormId);
  var summary = {
    created: 0,
    skipped: [],
    warnings: []
  };
  var pageBreakMaps = {
    byId: {},
    byIndex: {},
    byTitle: {},
    ambiguousTitles: {},
    warnedAmbiguousTitles: {},
    warnings: summary.warnings
  };
  var createdItems = [];
  var items = Array.isArray(jsonObject.items) ? jsonObject.items.slice() : [];
  var metadata = jsonObject.metadata || {};

  items.sort(function(a, b) {
    var aIndex = typeof a.index === "number" ? a.index : 9007199254740991;
    var bIndex = typeof b.index === "number" ? b.index : 9007199254740991;
    return aIndex - bIndex;
  });

  clearFormItems_(form);

  if (Object.prototype.hasOwnProperty.call(metadata, "title") && metadata.title !== null) {
    form.setTitle(String(metadata.title));
  }

  if (Object.prototype.hasOwnProperty.call(metadata, "description") && metadata.description !== null) {
    form.setDescription(String(metadata.description));
  }

  items.forEach(function(itemObject) {
    if (!itemObject || Object.prototype.toString.call(itemObject) !== "[object Object]") {
      summary.skipped.push("Unknown item");
      summary.warnings.push("Encountered a non-object item entry in the import JSON.");
      return;
    }

    var normalizedType = normalizeItemTypeString_(itemObject.type) || "UNKNOWN";
    if (normalizedType === "VIDEO") {
      summary.skipped.push(describeImportItem_(itemObject));
      summary.warnings.push(
        "Skipped " +
          describeImportItem_(itemObject) +
          " because FormApp exports do not expose the original video URL."
      );
      return;
    }

    var newItem = createItemOfType_(form, normalizedType);
    if (!newItem) {
      summary.skipped.push(describeImportItem_(itemObject));
      summary.warnings.push("Skipped unsupported item type " + normalizedType + " for " + describeImportItem_(itemObject) + ".");
      return;
    }

    if (Object.prototype.hasOwnProperty.call(itemObject, "title") && itemObject.title !== null && typeof newItem.setTitle === "function") {
      newItem.setTitle(String(itemObject.title));
    }

    createdItems.push({
      item: newItem,
      json: itemObject
    });

    summary.created += 1;

    if (Object.prototype.hasOwnProperty.call(itemObject, "id")) {
      pageBreakMaps.byId[String(itemObject.id)] = newItem;
    }

    if (Object.prototype.hasOwnProperty.call(itemObject, "index")) {
      pageBreakMaps.byIndex[String(itemObject.index)] = newItem;
    }

    if (normalizedType === "PAGE_BREAK" && itemObject.title) {
      if (Object.prototype.hasOwnProperty.call(pageBreakMaps.byTitle, itemObject.title)) {
        pageBreakMaps.ambiguousTitles[itemObject.title] = true;
        pageBreakMaps.byTitle[itemObject.title] = null;
      } else {
        pageBreakMaps.byTitle[itemObject.title] = newItem;
      }
    }
  });

  createdItems.forEach(function(created) {
    try {
      applyItemProperties_(created.item, created.json, pageBreakMaps);
    } catch (e) {
      summary.warnings.push("Could not finish " + describeImportItem_(created.json) + ": " + e.message);
    }
  });

  return summary;
}

/**
 * Removes all items from a form before rebuilding it from JSON.
 * Deletes in reverse order so item indices remain valid while the list shrinks.
 *
 * @param {FormApp.Form} form - Form to clear
 * @return {void}
 */
function clearFormItems_(form) {
  var items = form.getItems();
  for (var i = items.length - 1; i >= 0; i -= 1) {
    form.deleteItem(items[i]);
  }
}

/**
 * Creates an empty form item that matches the exported type string.
 * Centralizing the switch keeps unknown item types easy to skip with a warning.
 *
 * @param {FormApp.Form} form - Form receiving the new item
 * @param {string} typeString - Exported item type string
 * @return {FormApp.Item|null} Newly created item or null when unsupported
 */
function createItemOfType_(form, typeString) {
  switch (normalizeItemTypeString_(typeString)) {
    case "CHECKBOX":
      return form.addCheckboxItem();
    case "CHECKBOX_GRID":
      return form.addCheckboxGridItem();
    case "DATE":
      return form.addDateItem();
    case "DATE_TIME":
      return form.addDateTimeItem();
    case "DURATION":
      return form.addDurationItem();
    case "FILE_UPLOAD":
      return form.addFileUploadItem();
    case "GRID":
      return form.addGridItem();
    case "IMAGE":
      return form.addImageItem();
    case "LIST":
      return form.addListItem();
    case "MULTIPLE_CHOICE":
      return form.addMultipleChoiceItem();
    case "PAGE_BREAK":
      return form.addPageBreakItem();
    case "PARAGRAPH_TEXT":
      return form.addParagraphTextItem();
    case "SCALE":
      return form.addScaleItem();
    case "SECTION_HEADER":
      return form.addSectionHeaderItem();
    case "TEXT":
      return form.addTextItem();
    case "TIME":
      return form.addTimeItem();
    default:
      return null;
  }
}

/**
 * Applies exported properties after all items exist.
 * This second pass lets navigation resolve against newly created page breaks.
 *
 * @param {FormApp.Item} newItem - Newly created form item
 * @param {Object} jsonObj - Exported JSON representation of the item
 * @param {Object} pageBreakMaps - Navigation lookup maps and warning collector
 * @return {void}
 */
function applyItemProperties_(newItem, jsonObj, pageBreakMaps) {
  var typedItem = getTypedItem_(newItem);
  var itemType = normalizeItemTypeString_(jsonObj.type || newItem.getType().toString());

  if (typeof newItem.setHelpText === "function" && Object.prototype.hasOwnProperty.call(jsonObj, "helpText") && jsonObj.helpText !== null) {
    newItem.setHelpText(String(jsonObj.helpText));
  }

  if (typedItem && typeof typedItem.setRequired === "function") {
    typedItem.setRequired(Boolean(jsonObj.isRequired));
  }

  switch (itemType) {
    case "MULTIPLE_CHOICE":
    case "CHECKBOX":
    case "LIST":
      var choices = buildChoices_(typedItem, jsonObj, pageBreakMaps);
      if (!choices.length) {
        pageBreakMaps.warnings.push("No choices were available for " + describeImportItem_(jsonObj) + ".");
        return;
      }

      typedItem.setChoices(choices);

      if (jsonObj.hasOtherOption && typeof typedItem.showOtherOption === "function") {
        try {
          typedItem.showOtherOption(true);
        } catch (e) {
          pageBreakMaps.warnings.push("Could not enable Other option for " + describeImportItem_(jsonObj) + ": " + e.message);
        }
      }
      break;

    case "SCALE":
      if (
        Object.prototype.hasOwnProperty.call(jsonObj, "lowerBound") &&
        Object.prototype.hasOwnProperty.call(jsonObj, "upperBound") &&
        Object.prototype.hasOwnProperty.call(jsonObj, "leftLabel") &&
        Object.prototype.hasOwnProperty.call(jsonObj, "rightLabel")
      ) {
        typedItem.setBounds(jsonObj.lowerBound, jsonObj.upperBound);
        typedItem.setLabels(jsonObj.leftLabel, jsonObj.rightLabel);
      } else {
        pageBreakMaps.warnings.push("Scale settings were incomplete for " + describeImportItem_(jsonObj) + ".");
      }
      break;

    case "PAGE_BREAK":
      var pageNavType = navigationTypeFromString_(jsonObj.pageNavigationType);
      if (pageNavType === FormApp.PageNavigationType.GO_TO_PAGE) {
        if (
          !Object.prototype.hasOwnProperty.call(jsonObj, "goToPageId") &&
          !Object.prototype.hasOwnProperty.call(jsonObj, "goToPageIndex") &&
          !Object.prototype.hasOwnProperty.call(jsonObj, "goToPageTitle")
        ) {
          pageBreakMaps.warnings.push("Page break target is missing for " + describeImportItem_(jsonObj) + ".");
          return;
        }

        var targetPageBreak = resolvePageBreakTarget_(jsonObj, pageBreakMaps);
        if (targetPageBreak) {
          typedItem.setGoToPage(targetPageBreak);
        } else {
          pageBreakMaps.warnings.push("Could not resolve page break target for " + describeImportItem_(jsonObj) + ".");
        }
      } else if (
        pageNavType === FormApp.PageNavigationType.SUBMIT ||
        pageNavType === FormApp.PageNavigationType.RESTART
      ) {
        try {
          typedItem.setGoToPage(pageNavType);
        } catch (e) {
          pageBreakMaps.warnings.push(
            "Could not apply " + jsonObj.pageNavigationType + " navigation for " + describeImportItem_(jsonObj) + ": " + e.message
          );
        }
      }
      break;

    case "IMAGE":
      if (
        jsonObj.imageBlob &&
        jsonObj.imageBlob.dataBase64 &&
        jsonObj.imageBlob.contentType
      ) {
        var imageBlob = Utilities.newBlob(
          Utilities.base64Decode(jsonObj.imageBlob.dataBase64),
          jsonObj.imageBlob.contentType,
          jsonObj.imageBlob.name || "image"
        );
        typedItem.setImage(imageBlob);

        if (jsonObj.alignment && FormApp.Alignment[jsonObj.alignment]) {
          typedItem.setAlignment(FormApp.Alignment[jsonObj.alignment]);
        }
      } else {
        pageBreakMaps.warnings.push("Image content is unavailable for " + describeImportItem_(jsonObj) + ".");
      }
      break;

    case "GRID":
    case "CHECKBOX_GRID":
      pageBreakMaps.warnings.push(
        describeImportItem_(jsonObj) + " was created without rows or columns because grid export data is not available."
      );
      break;

    default:
      break;
  }
}

/**
 * Recreates question choices, including navigation metadata when present.
 * Uses explicit CONTINUE choices when navigation is mixed so Forms accepts the full set.
 *
 * @param {FormApp.Item} typedItem - Created choice-bearing item
 * @param {Object} jsonObj - Exported JSON item data
 * @param {Object} pageBreakMaps - Navigation lookup maps and warning collector
 * @return {FormApp.Choice[]} Choices ready for setChoices
 */
function buildChoices_(typedItem, jsonObj, pageBreakMaps) {
  var choiceValues = Array.isArray(jsonObj.choices) ? jsonObj.choices : [];
  var itemType = normalizeItemTypeString_(typedItem.getType().toString());
  var hasChoiceNavigation = Array.isArray(jsonObj.choiceNavigation);

  return choiceValues.map(function(choiceValue, index) {
    var value = choiceValue === null || typeof choiceValue === "undefined" ? "" : String(choiceValue);

    if (itemType === "CHECKBOX" || !hasChoiceNavigation) {
      return typedItem.createChoice(value);
    }

    var navigation = jsonObj.choiceNavigation[index];
    if (!navigation) {
      return typedItem.createChoice(value, FormApp.PageNavigationType.CONTINUE);
    }

    var navigationType = navigationTypeFromString_(navigation.pageNavigationType);
    if (navigationType === FormApp.PageNavigationType.GO_TO_PAGE) {
      var targetPageBreak = resolvePageBreakTarget_(navigation, pageBreakMaps);
      if (targetPageBreak) {
        return typedItem.createChoice(value, targetPageBreak);
      }

      pageBreakMaps.warnings.push(
        "Could not resolve choice navigation target for " + describeImportItem_(jsonObj) + ' choice "' + value + '".'
      );
      return typedItem.createChoice(value, FormApp.PageNavigationType.GO_TO_PAGE);
    }

    return typedItem.createChoice(value, navigationType);
  });
}

/**
 * Resolves an exported page-break reference against newly created items.
 * Falls back from exported ID to index and then title so old IDs can differ between forms.
 *
 * @param {Object} nav - Exported navigation object
 * @param {Object} pageBreakMaps - Navigation lookup maps and warning collector
 * @return {FormApp.PageBreakItem|null} Matching page break item or null when unresolved
 */
function resolvePageBreakTarget_(nav, pageBreakMaps) {
  if (!nav) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(nav, "goToPageId")) {
    var byId = pageBreakMaps.byId[String(nav.goToPageId)];
    if (byId) {
      return byId;
    }
  }

  if (Object.prototype.hasOwnProperty.call(nav, "goToPageIndex")) {
    var byIndex = pageBreakMaps.byIndex[String(nav.goToPageIndex)];
    if (byIndex) {
      return byIndex;
    }
  }

  if (nav.goToPageTitle) {
    if (pageBreakMaps.ambiguousTitles[nav.goToPageTitle]) {
      if (!pageBreakMaps.warnedAmbiguousTitles[nav.goToPageTitle]) {
        pageBreakMaps.warnings.push(
          'Navigation title fallback "' + nav.goToPageTitle + '" is ambiguous and was ignored.'
        );
        pageBreakMaps.warnedAmbiguousTitles[nav.goToPageTitle] = true;
      }
      return null;
    }

    if (pageBreakMaps.byTitle[nav.goToPageTitle]) {
      return pageBreakMaps.byTitle[nav.goToPageTitle];
    }
  }

  return null;
}

/**
 * Maps exported strings back to FormApp page navigation enums.
 * Defaults to CONTINUE so missing navigation fields degrade safely.
 *
 * @param {string} str - Exported page navigation string
 * @return {FormApp.PageNavigationType} Matching navigation enum
 */
function navigationTypeFromString_(str) {
  switch (String(str || "").toUpperCase()) {
    case "GO_TO_PAGE":
      return FormApp.PageNavigationType.GO_TO_PAGE;
    case "SUBMIT":
      return FormApp.PageNavigationType.SUBMIT;
    case "RESTART":
      return FormApp.PageNavigationType.RESTART;
    default:
      return FormApp.PageNavigationType.CONTINUE;
  }
}

/**
 * Returns a typed item helper regardless of whether the input is generic or already downcast.
 * This keeps the importer compatible with items returned by both getItems() and addXxxItem().
 *
 * @param {FormApp.Item} item - Generic or typed item
 * @return {FormApp.Item} Typed item wrapper for type-specific methods
 */
function getTypedItem_(item) {
  var itemType = normalizeItemTypeString_(item.getType().toString());
  var itemTypeConstructorName = snakeCaseToCamelCase("AS_" + itemType + "_ITEM");

  if (typeof item[itemTypeConstructorName] === "function") {
    return item[itemTypeConstructorName]();
  }

  return item;
}

/**
 * Normalizes exported item type names before matching them to FormApp APIs.
 * DATETIME is accepted as an alias for DATE_TIME to preserve compatibility with legacy JSON.
 *
 * @param {string} typeString - Exported item type string
 * @return {string} Normalized item type string
 */
function normalizeItemTypeString_(typeString) {
  var normalized = String(typeString || "").toUpperCase();
  if (normalized === "DATETIME") {
    return "DATE_TIME";
  }
  return normalized;
}

/**
 * Formats an item label for logs and warnings.
 * Keeps summaries readable when an import skips multiple items.
 *
 * @param {Object} jsonObj - Exported item data
 * @return {string} Human-readable item label
 */
function describeImportItem_(jsonObj) {
  var itemType = normalizeItemTypeString_(jsonObj && jsonObj.type) || "UNKNOWN";
  var itemTitle = jsonObj && jsonObj.title ? String(jsonObj.title) : "(untitled)";
  return itemType + ' "' + itemTitle + '"';
}
