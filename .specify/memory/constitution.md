<!--
Sync Impact Report:
Version: 1.0.0 → 1.1.0
Modified Principles:
  - Principle IV expanded with detailed secrets management rules
Added Sections:
  - Core Principles VI (Secrets Management - NON-NEGOTIABLE)
  - Core Principles VII (Distribution Logic)
  - Security Standards section added
Removed Sections: N/A
Templates Requiring Updates:
  ✅ plan-template.md - Constitution Check section remains generic
  ✅ spec-template.md - No updates needed
  ✅ tasks-template.md - No updates needed
Follow-up TODOs: None
-->

# Google Form Exporter Constitution

## Core Principles

### I. Simplicity First

This project MUST remain a focused, single-purpose utility. The core mission is to export Google Forms to JSON and Markdown formats—nothing more. New features MUST be rejected unless they directly support this core export functionality.

**Rationale**: Apps Script projects are difficult to test, debug, and maintain. Complexity is expensive here. Every added feature increases maintenance burden in an environment with limited tooling support.

### II. Defensive Programming

All code MUST handle Google Apps Script API quirks defensively. Methods that may not exist on all item types MUST be checked with `typeof` before invocation. Try-catch blocks MUST wrap calls that may throw for certain item configurations.

**Rationale**: Google Apps Script's type system uses runtime downcasting (`asMultipleChoiceItem()`), and not all methods are available on all item types. The API documentation is incomplete, making defensive checks non-negotiable.

### III. No External Dependencies

This project MUST NOT introduce runtime dependencies beyond the Google Apps Script built-in APIs (FormApp, DriveApp, Utilities). Build-time tooling (clasp, dotenv) is acceptable.

**Rationale**: Apps Script has no package manager. Dependencies would require vendoring, increasing bundle size and maintenance complexity. The platform's built-in APIs are sufficient for the current scope.

### IV. Environment-Based Configuration

All deployment-specific values (Form ID, Folder ID, Script ID) MUST be managed via `.env` and injected at build time. Source files MUST NOT contain hardcoded IDs.

**Rationale**: Enables safe version control without exposing sensitive IDs. Supports multiple deployment targets (dev, prod, personal) without code changes. Aligns with Apps Script's deployment model where code is pushed to remote projects.

### V. Self-Contained Modules

Each export format (JSON, Markdown) MUST be implemented in a separate, self-contained module file. Shared utilities MUST be minimal and clearly justified.

**Rationale**: Apps Script editor loads all files into a single global namespace. Clear file boundaries reduce namespace collision risk and improve code navigation in the limited Apps Script IDE.

### VI. Secrets Management (NON-NEGOTIABLE)

All sensitive values MUST follow the secrets management protocol:

1. **Source Files**: Source files in `src/` MUST use template placeholders (e.g., `"{{FORM_ID}}"`) and MUST NEVER contain actual secret values
2. **Environment Files**: Actual secrets MUST be stored in `.env` (gitignored) with `.env.example` providing the template structure
3. **Build-Time Injection**: The `scripts/inject-env.js` script MUST inject secrets into `tmp/dist/` during build—this temporary directory is gitignored and cleaned after deployment
4. **Version Control**: `.gitignore` MUST include `.env`, `.clasp.json`, `.clasprc.json`, and `tmp/` to prevent accidental secret commits
5. **Pre-Push Validation**: The `scripts/inject-env.js` script MUST validate that all required environment variables are present before proceeding

**Protected Secrets**:
- `FORM_ID` - Google Form identifier
- `EXPORT_FOLDER_ID` - Google Drive folder identifier
- `.clasp.json` (contains `scriptId` which must be filled by the user)
- `.clasprc.json` (contains OAuth tokens)

**Rationale**: Apps Script requires pushing code to remote Google servers. Template placeholders + build-time injection prevent accidental secret exposure in git history while maintaining usable source files. The temporary `tmp/dist/` directory serves as a clean isolation boundary.

### VII. Distribution Logic

The project uses a build-inject-deploy workflow that MUST be preserved:

1. **Source**: `src/*.js` files contain template placeholders
2. **Build**: `npm run push` triggers `scripts/inject-env.js` which:
   - Validates `.env` exists and contains required variables
   - Creates clean `tmp/dist/` directory
   - Copies `src/*.js` files to `tmp/dist/`
   - Performs string replacement: `{{FORM_ID}}` → actual value
   - Logs injected values (safe, as they're only shown to authorized user)
3. **Deploy**: `clasp push` reads from `tmp/dist/` (via `.clasp.json` rootDir setting)
4. **Cleanup**: `scripts/cleanup.js` removes `tmp/dist/` after deployment

**Distribution Constraints**:
- MUST NOT introduce alternate deployment paths that bypass injection
- MUST NOT commit compiled/injected files to version control
- MUST NOT add "convenience" features that store secrets in source files
- MAY add validation or logging to `inject-env.js`, but MUST NOT change injection flow

**Rationale**: This two-phase model (source with placeholders → temporary injected build) prevents the entire class of "forgot to remove secret before commit" errors. The temporary directory pattern is superior to in-place replacement.

## Technology Constraints

### Google Apps Script Platform

- **Runtime**: Apps Script V8 runtime (ES6 features supported with limitations)
- **APIs**: FormApp, DriveApp, Utilities only—no external HTTP calls, no Node.js APIs
- **Deployment**: clasp-based push/pull workflow
- **Editor**: Google Apps Script web IDE is the runtime environment

### Language Subset

- JavaScript (ES5/ES6 compatible)
- No async/await (Apps Script uses synchronous APIs)
- No modules (Apps Script uses global namespace)
- No npm packages at runtime

### Testing Reality

**Apps Script has no official testing framework.** Testing MUST be manual via the Apps Script editor's Run button. Test plans MUST be documented but automated tests are NOT required.

This is an accepted constraint of the platform. Complex logic that would benefit from unit tests MUST be kept minimal or avoided.

## Security Standards

### Secrets Protection

All changes MUST pass these security checks:

1. **No hardcoded secrets**: Source files (`src/*.js`) MUST use template placeholders (`{{SECRET_NAME}}`)
2. **Gitignore verification**: `.gitignore` MUST include `.env`, `.clasp.json`, `.clasprc.json`, `tmp/`
3. **Pre-commit review**: Before committing, verify no actual IDs appear in `src/` files (search for pattern: 1-character strings longer than 20 chars that aren't template syntax)
4. **Environment validation**: `.env.example` MUST document all required secrets with placeholder values

### Distribution Integrity

All deployment-related changes MUST:

1. **Preserve injection flow**: Changes to build scripts MUST maintain the `src/` → `tmp/dist/` → `clasp push` sequence
2. **Validate before deploy**: `inject-env.js` MUST check for required variables before copying files
3. **Clean temporary artifacts**: `cleanup.js` MUST be called after deployment to remove `tmp/dist/`
4. **Document new secrets**: New environment variables MUST be added to both `.env.example` and `inject-env.js` validation

## Quality Standards

### Code Review Gates

All changes MUST:

1. **Preserve defensive patterns**: Maintain `typeof` checks and try-catch blocks for API calls
2. **Maintain format separation**: JSON and Markdown logic must remain in separate files
3. **Pass security checks**: Verify no secrets in source files (see Security Standards above)
4. **Update documentation**: CLAUDE.md MUST reflect any architectural changes
5. **Verify in Apps Script**: Test via `npm run push` and manual execution in Apps Script editor

### Documentation Requirements

- **CLAUDE.md**: MUST document all entry points, module responsibilities, and platform quirks
- **README.md**: MUST provide complete setup and usage instructions for new users
- **Inline comments**: MUST explain non-obvious Apps Script API behaviors and workarounds

### Comments Hygiene
- All functions MUST have JSDoc-style comments
- Comments MUST explain "why" not just "what"
- Comments MUST NOT contradict code behavior
- Comments MUST NEVER behave as change logs
- Comments should describe the current code, NOT compare it to previous versions or deleted code.

Comments should describe the current code, not compare it to previous versions or deleted code.
Bad patterns:

- References to "old" functions or approaches that aren't in the codebase anymore
- Comparisons like "50% reduction: 4 calls → 2 calls"
- Phrases like "optimized," "improved," or "fixed" that imply there was a previous version
- Any mention of what the code used to do or how it's changed

Good pattern:

- Describe what the current code does
- Explain the current implementation
- Focus on the present state only

**Rationale**: If someone is reading the code, they only see what exists now. References to removed code create confusion and clutter. Historical context belongs in git commit messages, PRs, or changelogs—not in code comments.

For example, DO NOT use comments like this:

```javascript
/**
 * Export form as JSON and Markdown (optimized to fetch form data once)
 *
 * This function fetches the form and items once, then passes them to both
 * export functions to avoid redundant API calls (50% reduction: 4 calls → 2 calls)
 */
function oldFunction() {
  // This is a hack
}
```

DO use comments like this:

```javascript
/**
 * Export form as JSON and Markdown
 *
 * This function fetches the form and items, then passes them to both export functions
 */
function runExportAll() {
  // Fetch form and items once
  var form = FormApp.openById(FORM_ID);
  ...
}
```

### File Naming Convention

Exported files MUST use timestamps: `yyyy-MM-dd_HH-mm-ss`

- JSON: `form_export_<timestamp>.json`
- Markdown: `form_export_<timestamp>.md`

This convention is NOT configurable—changing it requires constitutional amendment.

## Governance

### Amendment Process

1. Propose change with rationale in pull request or issue
2. Document impact on existing code and templates
3. Update this constitution with new version number
4. Update affected templates (`.specify/templates/`)
5. Update CLAUDE.md if architectural principles change

### Versioning Policy

- **MAJOR**: Platform change (e.g., migrating off Apps Script), principle removal/replacement
- **MINOR**: New principle added, technology constraint changed
- **PATCH**: Clarification, typo fix, non-semantic refinement

- Releases MUST be tagged in git with version number
- Releases MUST be made on GitHub Releases page 
- Releases MUST include concise and human-readable changelog notes

### Compliance

- All pull requests MUST verify compliance with Core Principles I-VII
- Security checks (Principle VI) are NON-NEGOTIABLE and cannot be waived
- Complexity additions MUST be justified against Principle I (Simplicity First)
- Distribution changes MUST preserve Principle VII workflow integrity
- Use CLAUDE.md for runtime development guidance—this constitution defines project boundaries

**Version**: 1.1.0 | **Ratified**: 2025-12-11 | **Last Amended**: 2025-12-11
