export const AWS_S3_BUCKETS = {
  MEMORY: 'vargas-jr-memory',
  INBOX: 'vargas-jr-inbox',
  TERRAFORM_STATE: 'vargas-jr-terraform-state',
} as const;

export const AWS_SECRETS = {
  SES_WEBHOOK_SECRET: 'vargas-jr-ses-webhook-secret',
} as const;
