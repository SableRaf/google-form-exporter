/**
 * Exports a Google Form to a Markdown formatted string.
 * Supports optional pre-fetched data to optimize performance when exporting multiple formats.
 * Handles multi-page forms with section navigation and converts rich text formatting to Markdown.
 *
 * @param {string} formId - Google Form ID to export
 * @param {FormApp.Form} [optionalForm] - Pre-fetched form object (optional, for performance optimization)
 * @param {FormApp.Item[]} [optionalItems] - Pre-fetched items array (optional, for performance optimization)
 * @return {string} Markdown representation of the form with formatted questions and navigation
 */
function exportFormToMarkdown(formId, optionalForm, optionalItems) {
  // Use pre-fetched data if provided, otherwise fetch (backward compatible)
  var form = optionalForm || FormApp.openById(formId);
  var items = optionalItems || form.getItems();

  var lines = [];

  // Title and description
  lines.push("# " + form.getTitle());
  var description = form.getDescription();
  if (description) {
    lines.push("");
    lines.push(convertToMarkdown(description));
  }

  lines.push("");

  var questionCounter = 1;
  var sectionCounter = 0;
  var currentSection = "";
  var currentPageBreakItem = null;
  
  // Build a map of page break indices to section numbers for navigation references
  var sectionMap = buildSectionMap(items);

  items.forEach(function(item, index) {
    var type = item.getType();

    // Sections as markdown headings
    if (type === FormApp.ItemType.PAGE_BREAK) {
      // Before starting a new section, add default navigation for the previous section
      if (currentPageBreakItem) {
        var defaultNav = getDefaultSectionNavigation(currentPageBreakItem, items, sectionMap);
        if (defaultNav) {
          lines.push("");
          lines.push("_Default: " + defaultNav + "_");
          lines.push("");
        }
      }
      
      sectionCounter += 1;
      currentSection = item.getTitle() || "";
      currentPageBreakItem = item;
      
      if (currentSection) {
        lines.push("");
        lines.push("## Section " + sectionCounter + ": " + convertToMarkdown(currentSection));
        var help = item.getHelpText();
        if (help) {
          lines.push("");
          lines.push(convertToMarkdown(help));
        }
        lines.push("");
      }
      return;
    }

    // Skip items with no title (should not happen but just in case)
    var title = item.getTitle();
    if (!title) {
      return;
    }

    questionCounter += 1;

    // Question heading
    lines.push("### Q" + questionCounter + ". " + convertToMarkdown(title));

    var helpText = item.getHelpText();
    if (helpText) {
      lines.push("");
      lines.push("_" + convertToMarkdown(helpText) + "_");
    }

    // Type specific rendering
    lines.push("");
    lines = lines.concat(renderItemBodyMarkdown(item, type, sectionMap));
    lines.push("");
  });

  // Add default navigation for the last section
  if (currentPageBreakItem) {
    var defaultNav = getDefaultSectionNavigation(currentPageBreakItem, items, sectionMap);
    if (defaultNav) {
      lines.push("");
      lines.push("_Default: " + defaultNav + "_");
    }
  }

  return lines.join("\n");
}

/**
 * Gets the default navigation behavior for a page break section.
 * Returns a human-readable description of where the section leads by default
 * (e.g., "Continue to next section", "Submit form", or specific section navigation).
 *
 * @param {FormApp.Item} pageBreakItem - The page break item to get navigation for
 * @param {FormApp.Item[]} allItems - All form items for resolving navigation targets
 * @param {Object} sectionMap - Map of item indices to section information
 * @return {string} Human-readable default navigation description, or empty string if none
 */
function getDefaultSectionNavigation(pageBreakItem, allItems, sectionMap) {
  var typedItem = pageBreakItem.asPageBreakItem();
  var navType = typedItem.getPageNavigationType();
  var navItem = typedItem.getGoToPage();
  
  if (navType === FormApp.PageNavigationType.CONTINUE) {
    return "Continue to next section";
  }
  
  if (navType === FormApp.PageNavigationType.SUBMIT) {
    return "**Submit form**";
  }
  
  if (navType === FormApp.PageNavigationType.GO_TO_PAGE && navItem) {
    // Find the index of the navigation target
    var targetIndex = -1;
    for (var i = 0; i < allItems.length; i++) {
      if (allItems[i].getId() === navItem.getId()) {
        targetIndex = i;
        break;
      }
    }
    
    if (targetIndex >= 0 && sectionMap[targetIndex]) {
      var section = sectionMap[targetIndex];
      return "**Go to section " + section.number + " (" + convertToMarkdown(section.title) + ")**";
    }
  }
  
  return "";
}

/**
 * Builds a map of page break item indices to section information.
 * This mapping enables section references in navigation links throughout the form.
 * Each page break item is tracked with its section number and title.
 *
 * @param {FormApp.Item[]} items - Array of all form items
 * @return {Object} Map with keys as item index, values as objects containing section number and title
 */
function buildSectionMap(items) {
  var sectionMap = {};
  var sectionNumber = 0;
  
  items.forEach(function(item, index) {
    if (item.getType() === FormApp.ItemType.PAGE_BREAK) {
      sectionNumber += 1;
      sectionMap[index] = {
        number: sectionNumber,
        title: item.getTitle() || "Section " + sectionNumber
      };
    }
  });
  
  return sectionMap;
}

/**
 * Gets the navigation text for a choice-specific page navigation.
 * Returns formatted text indicating where selecting this choice leads
 * (e.g., "→ Submit form" or "→ Go to section 2 (Contact Info)").
 *
 * @param {FormApp.PageNavigationType} navType - Type of navigation (CONTINUE, SUBMIT, or GO_TO_PAGE)
 * @param {FormApp.Item} navItem - The target page break item to navigate to (or null)
 * @param {FormApp.Item[]} allItems - All form items for resolving navigation targets
 * @param {Object} sectionMap - Map of item indices to section information
 * @return {string} Formatted navigation text to append to choice, or empty string for default (CONTINUE) behavior
 */
function getNavigationText(navType, navItem, allItems, sectionMap) {
  if (navType === FormApp.PageNavigationType.CONTINUE) {
    return ""; // Default behavior, no need to mention
  }
  
  if (navType === FormApp.PageNavigationType.SUBMIT) {
    return " → **Submit form**";
  }
  
  if (navType === FormApp.PageNavigationType.GO_TO_PAGE && navItem) {
    // Find the index of the navigation target
    var targetIndex = -1;
    for (var i = 0; i < allItems.length; i++) {
      if (allItems[i].getId() === navItem.getId()) {
        targetIndex = i;
        break;
      }
    }
    
    if (targetIndex >= 0 && sectionMap[targetIndex]) {
      var section = sectionMap[targetIndex];
      return " → **Go to section " + section.number + " (" + convertToMarkdown(section.title) + ")**";
    }
  }
  
  return "";
}

/**
 * Renders the body content of a form item as Markdown lines.
 * Handles different item types: TEXT, PARAGRAPH_TEXT, MULTIPLE_CHOICE, CHECKBOX,
 * LIST, SCALE, and others. Includes choice options, scale bounds, and navigation links.
 *
 * @param {FormApp.Item} item - The form item to render
 * @param {FormApp.ItemType} type - The type of the form item
 * @param {Object} sectionMap - Map of item indices to section information for navigation links
 * @return {string[]} Array of Markdown formatted strings representing the item body
 */
function renderItemBodyMarkdown(item, type, sectionMap) {
  var lines = [];

  var itemTypeConstructorName = snakeCaseToCamelCase("AS_" + type.toString() + "_ITEM");
  var typedItem = item[itemTypeConstructorName]();
  
  // Get all items for navigation lookup
  var form = FormApp.getActiveForm();
  var allItems = form ? form.getItems() : [];

  switch (type) {
    case FormApp.ItemType.TEXT:
      lines.push("_Open text response_");
      break;

    case FormApp.ItemType.PARAGRAPH_TEXT:
      lines.push("_Long open text response_");
      break;

    case FormApp.ItemType.MULTIPLE_CHOICE:
      lines.push("_Single choice_");
      lines.push("");
      typedItem.getChoices().forEach(function(choice) {
        var choiceText = "- " + convertToMarkdown(choice.getValue());
        
        // Check for page navigation
        var navType = choice.getPageNavigationType();
        var navItem = choice.getGotoPage();
        var navText = getNavigationText(navType, navItem, allItems, sectionMap);
        
        lines.push(choiceText + navText);
      });
      if (typedItem.hasOtherOption()) {
        lines.push("- Other: _text response_");
      }
      break;

    case FormApp.ItemType.CHECKBOX:
      lines.push("_Select all that apply_");
      lines.push("");
      typedItem.getChoices().forEach(function(choice) {
        lines.push("- " + convertToMarkdown(choice.getValue()));
      });
      if (typedItem.hasOtherOption()) {
        lines.push("- Other: _text response_");
      }
      break;

    case FormApp.ItemType.LIST:
      lines.push("_Dropdown (single choice)_");
      lines.push("");
      typedItem.getChoices().forEach(function(choice) {
        var choiceText = "- " + convertToMarkdown(choice.getValue());
        
        // Check for page navigation
        var navType = choice.getPageNavigationType();
        var navItem = choice.getGotoPage();
        var navText = getNavigationText(navType, navItem, allItems, sectionMap);
        
        lines.push(choiceText + navText);
      });
      break;

    case FormApp.ItemType.SCALE:
      var lower = typedItem.getLowerBound();
      var upper = typedItem.getUpperBound();
      var leftLabel = typedItem.getLeftLabel();
      var rightLabel = typedItem.getRightLabel();

      lines.push(
        "Scale: " +
          lower +
          " to " +
          upper +
          (leftLabel || rightLabel ? " (" + convertToMarkdown(leftLabel || "") + " … " + convertToMarkdown(rightLabel || "") + ")" : "")
      );
      break;

    default:
      lines.push("_Item type: " + type.toString() + " (not specially formatted)_");
      break;
  }

  return lines;
}

/**
 * Converts Google Forms rich text (HTML-like tags) to Markdown format.
 * Handles bold (<b>), italic (<i>), underline (<u>), links (<a>), and line breaks (<br>).
 * Note: Underline formatting is preserved as HTML since Markdown has no native underline syntax.
 *
 * @param {string} text - The HTML-like text from Google Forms to convert
 * @return {string} Markdown formatted text with converted tags
 */
function convertToMarkdown(text) {
  if (!text) return "";
  
  // Convert bold
  text = text.replace(/<b>(.*?)<\/b>/g, "**$1**");
  
  // Convert italic
  text = text.replace(/<i>(.*?)<\/i>/g, "*$1*");
  
  // Convert underline (Markdown doesn't have native underline, so we keep it as HTML or use emphasis)
  text = text.replace(/<u>(.*?)<\/u>/g, "<u>$1</u>");
  
  // Convert links
  text = text.replace(/<a href="(.*?)">(.*?)<\/a>/g, "[$2]($1)");
  
  // Handle line breaks
  text = text.replace(/<br>/g, "\n");
  text = text.replace(/<br\/>/g, "\n");
  text = text.replace(/<br \/>/g, "\n");
  
  return text;
}

/**
 * Converts a SNAKE_CASE string to camelCase format.
 * Used to convert FormApp item type names to method names (e.g., "AS_TEXT_ITEM" → "asTextItem").
 * This is the same helper function used in exportForm.js for consistency.
 *
 * @param {string} s - The SNAKE_CASE string to convert
 * @return {string} The camelCase version of the input string
 */
function snakeCaseToCamelCase(s) {
  return s.toLowerCase().replace(/(\_\w)/g, function(m) {
    return m[1].toUpperCase();
  });
}