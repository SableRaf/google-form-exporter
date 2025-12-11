# Feature Specification: Reduce Export Redundancy

**Feature Branch**: `001-reduce-export-redundancy`
**Created**: 2025-12-11
**Status**: Draft
**Input**: User description: "Reduce redundancy between exportForm and toMarkdown. Avoid running the same calls twice when running both."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export to Both Formats Efficiently (Priority: P1)

As a form administrator, when I run `runExportAll()` to export both JSON and Markdown formats simultaneously, the system should fetch form data once and reuse it for both export operations, rather than making duplicate API calls to Google Forms.

**Why this priority**: This is the core optimization that directly addresses the user's stated need. It provides immediate performance improvement for the most common use case (exporting both formats).

**Independent Test**: Can be fully tested by running `runExportAll()` with logging enabled, verifying that `FormApp.openById()` and `form.getItems()` are called only once instead of twice, and confirming both export files are created correctly.

**Acceptance Scenarios**:

1. **Given** a valid form ID is configured, **When** user runs `runExportAll()`, **Then** the system fetches the form object and items array exactly once
2. **Given** form data has been fetched once, **When** both JSON and Markdown exports execute, **Then** both exports use the same fetched data
3. **Given** both exports complete, **When** user checks Drive folder, **Then** both JSON and Markdown files are present with matching timestamps and content

---

### User Story 2 - Individual Exports Remain Independent (Priority: P2)

As a form administrator, when I run `runExportToJSON()` or `runExportToMarkdown()` individually, each export should continue to work independently without requiring changes to my workflow.

**Why this priority**: Ensures backward compatibility and maintains the existing single-format export use cases without regression.

**Independent Test**: Can be fully tested by running `runExportToJSON()` alone and `runExportToMarkdown()` alone, verifying each produces correct output without requiring the other.

**Acceptance Scenarios**:

1. **Given** a valid form ID, **When** user runs `runExportToJSON()` only, **Then** JSON export completes successfully without calling Markdown export code
2. **Given** a valid form ID, **When** user runs `runExportToMarkdown()` only, **Then** Markdown export completes successfully without calling JSON export code
3. **Given** individual exports are run, **When** compared to previous versions, **Then** output format and behavior remain unchanged

---

### User Story 3 - Maintain Module Independence (Priority: P3)

As a developer, the JSON and Markdown export modules should remain in separate files with minimal coupling, preserving the architecture principle of self-contained modules.

**Why this priority**: Aligns with Constitution Principle V (Self-Contained Modules). While important for maintainability, it's lower priority than functional optimization.

**Independent Test**: Can be verified by reviewing the code structure and confirming that `exportForm.js` and `toMarkdown.js` remain separate files with no direct dependencies on each other.

**Acceptance Scenarios**:

1. **Given** the optimization is implemented, **When** reviewing module structure, **Then** `exportForm.js` and `toMarkdown.js` remain separate files
2. **Given** shared data-fetching logic is needed, **When** reviewing code architecture, **Then** shared logic exists in a neutral location (e.g., `Code.js`) rather than creating cross-module dependencies
3. **Given** future changes to one export format, **When** modifying that module, **Then** changes don't require modifications to the other export module

---

### Edge Cases

- What happens when `FormApp.openById()` fails (invalid form ID or permission error)? Both exports should fail gracefully with the same error message.
- What happens when form data changes between the two exports in the current implementation? This optimization should eliminate this risk by ensuring both exports use identical data.
- How does the system handle very large forms with 100+ items? Single fetch should improve performance without changing behavior.
- What happens if one export format succeeds but the other fails during processing? The successful export should still be saved; errors should be logged independently.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST fetch form data (via `FormApp.openById()`) exactly once when `runExportAll()` is executed
- **FR-002**: System MUST fetch form items (via `form.getItems()`) exactly once when `runExportAll()` is executed
- **FR-003**: System MUST pass the fetched form object and items array to both `exportFormToJson()` and `exportFormToMarkdown()` functions
- **FR-004**: Exported JSON and Markdown files MUST contain identical form data when generated via `runExportAll()`
- **FR-005**: Individual export functions (`runExportToJSON()`, `runExportToMarkdown()`) MUST continue to work independently without changes to their public interfaces
- **FR-006**: System MUST maintain the existing file naming convention (timestamps) for both export formats
- **FR-007**: System MUST preserve all existing defensive programming patterns (typeof checks, try-catch blocks) in the refactored code
- **FR-008**: System MUST NOT introduce runtime dependencies beyond existing Google Apps Script APIs (FormApp, DriveApp, Utilities)

### Key Entities

- **Form Data**: Represents the Google Form object obtained via `FormApp.openById()`, including metadata (title, description, editors) and configuration
- **Form Items**: Array of all question/section items in the form, obtained via `form.getItems()`, each with type-specific properties accessed via downcasting
- **Shared Fetch Result**: Temporary in-memory structure containing both the form object and items array, reused by both export functions during a single `runExportAll()` execution

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When `runExportAll()` executes, Google Apps Script API calls (`FormApp.openById()` and `form.getItems()`) are reduced from 2 calls each to 1 call each (50% reduction)
- **SC-002**: Both JSON and Markdown exports produced by `runExportAll()` contain identical form data, verified by comparing metadata fields (title, description, item count)
- **SC-003**: Individual export functions (`runExportToJSON()`, `runExportToMarkdown()`) continue to execute successfully when called independently, with no change in execution time or output format
- **SC-004**: All existing manual test scenarios documented in CLAUDE.md pass without modification after the optimization is implemented
- **SC-005**: Code review confirms no new cross-module dependencies introduced between `exportForm.js` and `toMarkdown.js`

## Assumptions

- Form data does not change during the execution of a single `runExportAll()` call (safe assumption given synchronous Apps Script execution model)
- The performance benefit of reducing API calls is valuable even though execution time improvement may be minimal for typical forms (10-50 items)
- Users primarily use `runExportAll()` rather than individual export functions, making this optimization worthwhile
- Refactoring both export functions to accept parameters (form object, items array) is acceptable as long as backward compatibility is maintained in the entry point functions

## Constraints

- **Platform Constraint**: Must work within Google Apps Script V8 runtime limitations (synchronous execution, no async/await, global namespace)
- **Architectural Constraint**: Must preserve Constitution Principle V (Self-Contained Modules) - no direct cross-file dependencies between `exportForm.js` and `toMarkdown.js`
- **Compatibility Constraint**: Must not break existing deployments or require users to update their `.env` configuration
- **Testing Constraint**: Manual testing only (Apps Script has no official testing framework), so changes must be verifiable via Apps Script editor execution and log inspection

## Out of Scope

- Optimizing performance of individual export functions when called separately
- Caching form data across multiple separate function invocations
- Adding automated testing infrastructure
- Changing export file formats or naming conventions
- Optimizing other duplicated logic (e.g., `snakeCaseToCamelCase()` helper duplication is acceptable per current architecture)
