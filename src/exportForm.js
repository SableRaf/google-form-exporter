// Based on script by Steven Schmatz, Humanitas Labs, 2016
// https://github.com/stevenschmatz/export-google-form

// MIT License

// Copyright (c) 2016 Humanitas

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

/**
 * Converts the Form with the given ID into a JSON object.
 * Supports optional pre-fetched data to optimize performance when exporting multiple formats.
 *
 * @param {string} formId - Google Form ID to export
 * @param {FormApp.Form} [optionalForm] - Pre-fetched form object (optional, for performance optimization)
 * @param {FormApp.Item[]} [optionalItems] - Pre-fetched items array (optional, for performance optimization)
 * @return {Object} JSON representation of the form with metadata, items array, and count
 */
function exportFormToJson(formId, optionalForm, optionalItems) {
  // Use pre-fetched data if provided, otherwise fetch (backward compatible)
  var form = optionalForm || FormApp.openById(formId);
  var items = optionalItems || form.getItems();

  var result = {
    metadata: getFormMetadata(form),
    items: items.map(itemToObject),
    count: items.length
  };

  return result;
}

/**
 * Extracts and returns metadata from a Google Form object.
 * Includes title, description, URLs, editors, and configuration settings.
 *
 * @param {FormApp.Form} form - The Google Form object to extract metadata from
 * @return {Object} Object containing form metadata including title, id, description, publishedUrl, editorEmails, count, confirmationMessage, and customClosedFormMessage
 */
function getFormMetadata(form) {
  return {
    title: form.getTitle(),
    id: form.getId(),
    description: form.getDescription(),
    publishedUrl: form.getPublishedUrl(),
    editorEmails: form.getEditors().map(function(user) {
      return user.getEmail();
    }),
    count: form.getItems().length,
    confirmationMessage: form.getConfirmationMessage(),
    customClosedFormMessage: form.getCustomClosedFormMessage()
  };
}

/**
 * Converts a Google Form item into a JSON object representation.
 * Uses type downcasting to access type-specific properties (e.g., choices, scale bounds).
 * Handles all form item types including TEXT, PARAGRAPH_TEXT, MULTIPLE_CHOICE, CHECKBOX,
 * LIST, SCALE, IMAGE, PAGE_BREAK, and VIDEO.
 *
 * @param {FormApp.Item} item - The form item to convert
 * @return {Object} Object representing the item with properties: type, title, helpText, id, index, isRequired, points, and type-specific fields
 */
function itemToObject(item) {
  var data = {};

  var itemType = item.getType();
  data.type = itemType.toString();
  data.title = item.getTitle();
  data.helpText = item.getHelpText();
  data.id = item.getId();
  data.index = item.getIndex();

  // Some item types do not implement isRequired()
  var isRequired = false;
  if (typeof item.isRequired === "function") {
    try {
      isRequired = item.isRequired();
    } catch (e) {
      isRequired = false;
    }
  }
  data.isRequired = isRequired;

  // Keep field for compatibility with previous JSON
  data.points = 0;

  // Downcast items to access type specific properties
  var itemTypeConstructorName = snakeCaseToCamelCase("AS_" + itemType.toString() + "_ITEM");
  var typedItem = item[itemTypeConstructorName]();

  switch (itemType) {
    case FormApp.ItemType.LIST:
    case FormApp.ItemType.CHECKBOX:
    case FormApp.ItemType.MULTIPLE_CHOICE:
      try {
        var choices = typedItem.getChoices();
        data.choices = choices.map(function(choice) {
          return choice.getValue();
        });
      } catch (e) {
        Logger.log("Error getting choices for item " + data.id + ": " + e.message);
        data.choices = [];
      }
      if (typeof typedItem.hasOtherOption === "function") {
        try {
          data.hasOtherOption = typedItem.hasOtherOption();
        } catch (e) {
          data.hasOtherOption = false;
        }
      } else {
        data.hasOtherOption = false;
      }
      break;

    case FormApp.ItemType.SCALE:
      data.lowerBound = typedItem.getLowerBound();
      data.upperBound = typedItem.getUpperBound();
      data.leftLabel = typedItem.getLeftLabel();
      data.rightLabel = typedItem.getRightLabel();
      break;

    case FormApp.ItemType.IMAGE:
      data.alignment = typedItem.getAlignment().toString();
      var imageBlob = typedItem.getImage();
      data.imageBlob = {
        dataAsString: imageBlob.getDataAsString(),
        name: imageBlob.getName(),
        isGoogleType: imageBlob.isGoogleType()
      };
      break;

    case FormApp.ItemType.PAGE_BREAK:
      data.pageNavigationType = typedItem.getPageNavigationType().toString();
      break;

    default:
      // TEXT, PARAGRAPH_TEXT, etc. need no extra fields
      break;
  }

  // Handle VIDEO type (Forms quirk)
  if (itemType.toString() === "VIDEO") {
    data.alignment = typedItem.getAlignment().toString();
  }

  return data;
}

/**
 * Converts a SNAKE_CASE string to camelCase format.
 * Used to convert FormApp item type names to method names (e.g., "AS_TEXT_ITEM" → "asTextItem").
 *
 * @param {string} s - The SNAKE_CASE string to convert
 * @return {string} The camelCase version of the input string
 */
function snakeCaseToCamelCase(s) {
  return s.toLowerCase().replace(/(\_\w)/g, function(m) {
    return m[1].toUpperCase();
  });
}




