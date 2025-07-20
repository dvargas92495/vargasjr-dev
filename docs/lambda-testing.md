# Lambda Email Testing with Preview Branches

## Overview
This guide explains how to test Lambda email processing against preview branch APIs.

## Usage

### 1. Configure Lambda for Testing
```bash
npm run test-lambda-email configure https://your-preview-branch.vercel.app
```

### 2. Test with Sample Email
```bash
npm run test-lambda-email test
```

### 3. Reset to Production
```bash
npm run test-lambda-email reset
```

## Environment Variables
- `LAMBDA_TEST_MODE`: Set to 'true' to enable test mode
- `TEST_WEBHOOK_URL`: Preview branch webhook URL to use during testing

## How It Works

The Lambda function now checks for test mode configuration:

1. **Test Mode Detection**: When `LAMBDA_TEST_MODE=true` and `TEST_WEBHOOK_URL` is set, the Lambda uses the test webhook URL
2. **Production Mode**: When test mode is disabled or test URL is not set, it uses the standard production webhook URL
3. **Dynamic Configuration**: The utility script allows you to easily switch between test and production modes

## Testing Workflow

1. Deploy a preview branch with your changes
2. Use the utility script to configure Lambda with the preview branch URL:
   ```bash
   npm run test-lambda-email configure https://your-preview-branch-url.vercel.app
   ```
3. Send test emails or invoke Lambda directly to test the flow
4. Verify webhook calls reach your preview branch API
5. Reset Lambda to production configuration when done:
   ```bash
   npm run test-lambda-email reset
   ```

## Security Considerations

- Test webhook URLs are only used when explicitly enabled via `LAMBDA_TEST_MODE`
- Production webhook secret is still used for signature verification
- Configuration changes are temporary and can be easily reset
- The Lambda function logs when it's using a test webhook URL for transparency

## Example Usage

```bash
# Configure for testing against a preview branch
npm run test-lambda-email configure https://vargasjr-git-feature-branch.vercel.app

# Send a test email to trigger the Lambda
npm run test-lambda-email test

# Check your preview branch logs to verify the webhook was received

# Reset back to production when done
npm run test-lambda-email reset
```
