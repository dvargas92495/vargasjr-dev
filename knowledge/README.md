# Declarative Knowledge Management

This directory contains declarative knowledge files that are automatically synchronized with the Devin Knowledge API.

## File Format

Each `.json` file in this directory represents a single knowledge item with the following structure:

```json
{
  "name": "Knowledge Name",
  "body": "The content of the knowledge that Devin will read when triggered",
  "trigger_description": "Description of when this knowledge should be triggered",
  "parent_folder_id": null
}
```

### Required Fields

- `name`: The display name for the knowledge item
- `body`: The actual content/information that Devin will access
- `trigger_description`: Describes when this knowledge should be activated

### Optional Fields

- `parent_folder_id`: ID of the parent folder (use `null` for root level)

## Workflow

### Adding New Knowledge

1. Create a new `.json` file in this directory
2. Follow the required format above
3. Commit and push your changes
4. The CI pipeline will automatically create the knowledge in Devin when merged to main

### Updating Knowledge

1. Modify the existing `.json` file
2. Commit and push your changes
3. The CI pipeline will automatically update the knowledge in Devin when merged to main

### Removing Knowledge

1. Delete the `.json` file from this directory
2. Commit and push your changes
3. The CI pipeline will automatically remove the knowledge from Devin when merged to main

## Preview Changes

When you create a pull request that modifies knowledge files, the CI pipeline will:

1. Compare your local knowledge files with the current state in Devin
2. Generate a preview of what changes would be applied
3. Post a comment on your PR showing the diff

This allows you to review changes before they are applied to production.

## Authentication

The CI pipeline uses the `DEVIN_API_TOKEN` secret to authenticate with the Devin API. This token should be configured in the repository secrets.
