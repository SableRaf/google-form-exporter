/**
 * Exports a Google Form to a Markdown string.
 *
 * @param {string} formId
 * @return {string} Markdown representation of the form.
 */
function exportFormToMarkdown(formId) {
  var form = FormApp.openById(formId);
  var items = form.getItems();

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
 * Gets the default navigation for a page break section
 *
 * @param {FormApp.Item} pageBreakItem - The page break item
 * @param {FormApp.Item[]} allItems - All form items
 * @param {Object} sectionMap - Map of section indices to info
 * @return {string} Default navigation description
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
 * Builds a map of page break item indices to section information
 * This helps us reference sections when showing navigation.
 *
 * @param {FormApp.Item[]} items
 * @return {Object} Map with keys as item index, values as section info
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
 * Gets the section reference for a page navigation item
 *
 * @param {FormApp.PageNavigationType} navType
 * @param {FormApp.Item} navItem - The item to navigate to (or null)
 * @param {FormApp.Item[]} allItems - All form items
 * @param {Object} sectionMap - Map of section indices to info
 * @return {string} Navigation description or empty string
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
 * Renders the body of a question (options, scale info, etc.) as markdown lines.
 *
 * @param {FormApp.Item} item
 * @param {FormApp.ItemType} type
 * @param {Object} sectionMap - Map of section information
 * @return {string[]} lines
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
 * Converts Google Forms rich text (HTML-like) to Markdown.
 * Handles bold, italic, underline, and links.
 *
 * @param {string} text
 * @return {string} Markdown formatted text
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
 * Converts a SNAKE_CASE string to a camelCase string.
 * Reuses the same helper as in ExportForm.gs.
 *
 * @param {string} s in SNAKE_CASE
 * @returns {string} the camelCase version of that string.
 */
function snakeCaseToCamelCase(s) {
  return s.toLowerCase().replace(/(\_\w)/g, function(m) {
    return m[1].toUpperCase();
  });
}