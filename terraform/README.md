# Terraform Infrastructure Setup

## Backend Configuration

The terraform state is stored in S3 bucket `vargas-jr-terraform-state` with a single state file:

- All environments: `terraform/state/terraform.tfstate`

This consolidated approach uses a single state file for all deployments. The "already exists" errors mentioned in the deployment logs are likely from previous failed deployments where resources were partially created.

## Deployment Process

1. **Preview Mode** (Pull Requests): `npm run terraform -- --preview`

   - Runs `cdktf diff` to show planned changes
   - Posts results as GitHub PR comment
   - Uses shared state file (read-only)

2. **Production Mode** (Main branch): `npm run terraform`
   - Runs `cdktf deploy --auto-approve`
   - Applies changes to production infrastructure
   - Uses shared state file

## Error Handling

The terraform runner includes proper error handling with explicit `process.exit(1)` calls to ensure that deployment failures cause GitHub Actions to fail immediately. This prevents the "silent success" issue where errors were logged but the action continued to pass.

Key improvements:

- Terraform apply failures now call `process.exit(1)` instead of just throwing errors
- Plan failures in preview mode also call `process.exit(1)` to fail the action
- Main function catches all unhandled errors and exits with code 1
