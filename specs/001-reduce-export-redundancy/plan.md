# Implementation Plan: Reduce Export Redundancy

**Branch**: `001-reduce-export-redundancy` | **Date**: 2025-12-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-reduce-export-redundancy/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Optimize the `runExportAll()` function to eliminate redundant Google Apps Script API calls by fetching form data once and reusing it for both JSON and Markdown export operations. This reduces `FormApp.openById()` and `form.getItems()` calls from 2 each to 1 each (50% reduction) while maintaining backward compatibility for individual export functions and preserving the self-contained module architecture.

## Technical Context

**Language/Version**: JavaScript (ES5/ES6) - Google Apps Script V8 runtime
**Primary Dependencies**: Google Apps Script built-in APIs (FormApp, DriveApp, Utilities) - no external dependencies
**Storage**: Google Drive (output files only, no data storage layer)
**Testing**: Manual testing via Apps Script editor (no official testing framework available)
**Target Platform**: Google Apps Script cloud runtime (server-side JavaScript execution)
**Project Type**: Single project (server-side utility with global namespace)
**Performance Goals**: Reduce API calls by 50% when exporting both formats; minimal impact on individual exports
**Constraints**: Synchronous execution only (no async/await), global namespace (no modules), manual testing only, must preserve defensive programming patterns
**Scale/Scope**: 3 entry point functions, 2 export modules, typical forms have 10-50 items

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ Principle I: Simplicity First
**Status**: PASS
**Evaluation**: This feature directly supports core export functionality by optimizing an existing operation. It does not add new features or expand scope beyond the mission of exporting Google Forms to JSON and Markdown.

### ✅ Principle II: Defensive Programming
**Status**: PASS
**Evaluation**: FR-007 explicitly requires preserving all existing defensive programming patterns (typeof checks, try-catch blocks). The refactoring will maintain these patterns in both export modules.

### ✅ Principle III: No External Dependencies
**Status**: PASS
**Evaluation**: FR-008 explicitly prohibits introducing runtime dependencies beyond existing Google Apps Script APIs. No external packages or libraries will be added.

### ✅ Principle IV: Environment-Based Configuration
**Status**: PASS
**Evaluation**: Feature does not modify configuration management. Existing `.env` injection workflow for FORM_ID and EXPORT_FOLDER_ID remains unchanged.

### ✅ Principle V: Self-Contained Modules
**Status**: PASS ✅ (Post-Design Re-evaluation)
**Evaluation**: User Story 3 prioritizes maintaining module independence. Export modules will remain in separate files (`exportForm.js`, `toMarkdown.js`) with no direct cross-file dependencies.

**Design Decision** (from research.md): Parameter-based refactoring (Option A) chosen. Both export functions accept optional parameters (`optionalForm`, `optionalItems`) with fallback fetching using `||` operator. This preserves module independence (no cross-file dependencies) while enabling data sharing when orchestrated by `Code.js`.

**Implementation**: Export modules remain self-contained with no imports/requires. The orchestration layer (`runExportAll()` in `Code.js`) passes shared data via explicit parameters, maintaining clear dependency flow.

### ✅ Principle VI: Secrets Management (NON-NEGOTIABLE)
**Status**: PASS
**Evaluation**: Feature does not modify secrets management, deployment, or build processes. Existing template placeholder + injection workflow remains intact.

### ✅ Principle VII: Distribution Logic
**Status**: PASS
**Evaluation**: No changes to build scripts, injection logic, or deployment workflow. Code changes are limited to `src/Code.js`, `src/exportForm.js`, and `src/toMarkdown.js` source files.

### Constitution Summary
**Overall Status**: ✅ PASS (Post-Design Re-evaluation Complete)
**Violations**: None
**Design Clarifications**: Resolved in Phase 0 research (parameter-based refactoring chosen)

**Final Verdict**: All seven constitutional principles satisfied. Feature ready for implementation.

## Project Structure

### Documentation (this feature)

```text
specs/001-reduce-export-redundancy/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── api.md           # Export function signatures (contracts)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── Code.js              # Entry points (runExportAll, runExportToJSON, runExportToMarkdown)
├── exportForm.js        # JSON export logic (self-contained module)
└── toMarkdown.js        # Markdown export logic (self-contained module)

scripts/
├── inject-env.js        # Build-time environment variable injection
└── cleanup.js           # Post-deployment cleanup

tmp/dist/                # Gitignored build output (created during npm run push)
└── [*.js files]         # Injected source files (temporary)
```

**Structure Decision**: Single project structure (Option 1). Google Apps Script projects use a flat global namespace with all files loaded together. The existing three-file structure (`Code.js` for entry points, separate modules for each export format) already implements the optimal pattern for this platform. No structural changes needed beyond modifying function signatures and data flow within existing files.

## Complexity Tracking

**No violations identified.** This feature simplifies the codebase by reducing redundant API calls without adding new dependencies, modules, or abstractions.
