# Google Form Exporter

Export Google Forms to JSON and Markdown formats, automatically saved to Google Drive.

## Overview

This Google Apps Script project allows you to export the structure and content of any Google Form to both JSON and Markdown formats. The exported files are automatically timestamped and saved to a specified Google Drive folder.

**Use cases:**
- Document form structure for version control
- Create human-readable snapshots of your forms
- Archive form configurations before making changes
- Generate form documentation in Markdown
- Export form data for analysis or migration

**Supported form elements:**
- Text and paragraph text questions
- Multiple choice and checkbox questions
- Dropdown lists
- Linear scales
- Images and videos
- Multi-page forms with page breaks and navigation logic

## Prerequisites

- A Google account with access to Google Apps Script
- Node.js and npm installed (for deployment)
- A Google Form you want to export
- A Google Drive folder for storing exports

## Setup

### 1. Clone this repository

```bash
git clone <repository-url>
cd google-form-exporter
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create a Google Apps Script project

1. Go to [script.google.com](https://script.google.com)
2. Create a new project
3. Copy the Script ID from the URL (it looks like: `https://script.google.com/home/projects/YOUR_SCRIPT_ID_HERE/edit`)

### 4. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your configuration:

```env
# Get this from your Google Form URL (the long ID in the URL)
FORM_ID=your_form_id_here

# Get this from your Google Drive folder URL (the folder ID in the URL)
EXPORT_FOLDER_ID=your_folder_id_here
```

### 5. Configure clasp

Copy the clasp configuration file:

```bash
cp .clasp.json.example .clasp.json
```

Edit `.clasp.json` and set the `scriptId` to your Google Apps Script project ID:

```json
  "scriptId": "your_script_id_here",
```

### 6. Login to clasp

```bash
clasp login
```

This will open a browser window to authenticate with your Google account.

### 7. Deploy to Google Apps Script

```bash
npm run push
```

This command will:
- Inject your environment variables into the code
- Push the code to your Google Apps Script project
- Clean up temporary files

## Usage

1. Open your script in the Apps Script editor:
   ```bash
   npm run open
   ```

2. In the editor, select one of these functions from the dropdown:
   - `runExportToJSON` - Export to JSON only
   - `runExportToMarkdown` - Export to Markdown only

3. Click the Run button

4. On first run, you'll need to authorize the script to access your Google Forms and Drive

5. Check your Google Drive folder for the exported files

### Exported Files

Files are saved to your configured Google Drive folder with timestamps:

- **JSON**: `form_export_2025-12-10_14-30-45.json`
  - Complete form structure with all metadata
  - Includes question types, options, validation rules
  - Machine-readable format for further processing

- **Markdown**: `form_export_2025-12-10_14-30-45.md`
  - Human-readable form documentation
  - Includes section navigation for multi-page forms
  - Formatted for easy reading and sharing

## Project Structure

```
google-form-exporter/
├── src/
│   ├── Code.js           # Entry points and configuration
│   ├── exportForm.js     # JSON export logic
│   └── toMarkdown.js     # Markdown export logic
├── scripts/
│   ├── inject-env.js     # Environment variable injection
│   └── cleanup.js        # Cleanup temporary files
├── .env.example          # Example environment variables
├── .clasp.json.example   # Example clasp configuration
└── package.json          # npm configuration
```

## Development

### Pushing changes

After making changes to the code in [src/](src/):

```bash
npm run push
```

### Pulling changes

To pull the latest version from Google Apps Script:

```bash
npm run pull
```

### Opening in editor

```bash
npm run open
```

## Troubleshooting

**"Authorization required"**: On first run, you need to authorize the script. Click "Review Permissions" and grant access.

**"Form not found"**: Double-check your `FORM_ID` in [.env](.env) matches your Google Form ID.

**"Folder not found"**: Verify your `EXPORT_FOLDER_ID` in [.env](.env) is correct and the script has access to that folder.

**Changes not appearing**: Make sure you ran `npm run push` after editing the code.

## License

GPL-3.0 License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
