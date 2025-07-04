# Terraform Infrastructure Setup

## Required AWS IAM Permissions

The AWS user/role used for terraform deployment must have the following IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:ListAttachedRolePolicies",
        "s3:*",
        "ses:*",
        "lambda:*",
        "ec2:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## Current IAM Permission Issue

The deployment is failing with the following error:
```
Error: creating IAM Role (vargas-jr-email-lambda-role): operation error IAM: CreateRole, https response error StatusCode: 403, RequestID: 6b5d901c-e2e3-40f1-b754-1ec6a885563a, api error AccessDenied: User: arn:aws:iam::009994482511:user/vargas-jr-admin is not authorized to perform: iam:CreateRole on resource: arn:aws:iam::009994482511:role/vargas-jr-email-lambda-role because no identity-based policy allows the iam:CreateRole action
```

**Solution**: The AWS user `vargas-jr-admin` needs to be granted the `iam:CreateRole` permission in the AWS console or via an IAM policy update.

## Backend Configuration

The terraform state is stored in S3 bucket `vargas-jr-terraform-state` with environment-specific keys:
- Production: `terraform/state/production/terraform.tfstate`
- Preview: `terraform/state/preview-pr-{number}/terraform.tfstate`

This separation prevents conflicts between preview and production deployments. The "already exists" errors mentioned in the deployment logs are likely from previous failed deployments where resources were partially created, not from backend conflicts.

## Deployment Process

1. **Preview Mode** (Pull Requests): `npm run terraform -- --preview`
   - Runs `cdktf diff` to show planned changes
   - Posts results as GitHub PR comment
   - Uses preview-specific state key

2. **Production Mode** (Main branch): `npm run terraform`
   - Runs `cdktf deploy --auto-approve`
   - Applies changes to production infrastructure
   - Uses production state key

## Error Handling

The terraform runner includes proper error handling that should cause deployments to fail on IAM permission errors. If errors appear to "silently succeed", check the GitHub Actions logs for the full error output.
