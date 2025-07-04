import { Construct } from "constructs";
import { App, TerraformStack, S3Backend } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket";
import { S3BucketVersioningA } from "@cdktf/provider-aws/lib/s3-bucket-versioning";
import { SecurityGroup } from "@cdktf/provider-aws/lib/security-group";
import { SecurityGroupRule } from "@cdktf/provider-aws/lib/security-group-rule";
import { SesEmailIdentity } from "@cdktf/provider-aws/lib/ses-email-identity";
import { SesDomainIdentity } from "@cdktf/provider-aws/lib/ses-domain-identity";
import { LambdaFunction } from "@cdktf/provider-aws/lib/lambda-function";
import { LambdaPermission } from "@cdktf/provider-aws/lib/lambda-permission";
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { IamRolePolicyAttachment } from "@cdktf/provider-aws/lib/iam-role-policy-attachment";
import { SesReceiptRule } from "@cdktf/provider-aws/lib/ses-receipt-rule";
import { SesReceiptRuleSet } from "@cdktf/provider-aws/lib/ses-receipt-rule-set";
import { SecretsmanagerSecret } from "@cdktf/provider-aws/lib/secretsmanager-secret";
import { SecretsmanagerSecretVersion } from "@cdktf/provider-aws/lib/secretsmanager-secret-version";
import { AWS_S3_BUCKETS } from "../app/lib/constants";
import { randomBytes } from "crypto";

interface VargasJRStackConfig {
  environment: "production" | "preview";
  prNumber?: string;
  region?: string;
}

class VargasJRInfrastructureStack extends TerraformStack {
  constructor(scope: Construct, id: string, config: VargasJRStackConfig) {
    super(scope, id);

    const region = config.region || "us-east-1";
    
    new AwsProvider(this, "AWS", {
      region: region,
    });

    const commonTags = {
      Project: "VargasJR",
      Type: config.environment,
      ...(config.prNumber && { PRNumber: config.prNumber }),
    };

    new S3Backend(this, {
      bucket: AWS_S3_BUCKETS.TERRAFORM_STATE,
      key: `terraform/state/${config.environment}${config.prNumber ? `-pr-${config.prNumber}` : ''}/terraform.tfstate`,
      region: region,
      encrypt: true,
    });

    this.createTerraformStateS3Bucket(commonTags);
    this.createS3Resources(commonTags);
    this.createSecurityGroup(commonTags);
    this.createSESResources(commonTags);
    this.createEmailLambdaResources(commonTags);
  }

  private createS3Resources(tags: Record<string, string>) {
    const memoryBucket = new S3Bucket(this, "MemoryBucket", {
      bucket: AWS_S3_BUCKETS.MEMORY,
    });

    new S3BucketVersioningA(this, "MemoryBucketVersioning", {
      bucket: memoryBucket.id,
      versioningConfiguration: {
        status: "Disabled",
      },
    });

    const inboxBucket = new S3Bucket(this, "InboxBucket", {
      bucket: AWS_S3_BUCKETS.INBOX,
    });

    new S3BucketVersioningA(this, "InboxBucketVersioning", {
      bucket: inboxBucket.id,
      versioningConfiguration: {
        status: "Disabled",
      },
    });
  }

  private createTerraformStateS3Bucket(tags: Record<string, string>) {
    return null;
  }

  private createSecurityGroup(tags: Record<string, string>): SecurityGroup {
    const securityGroup = new SecurityGroup(this, "SSHSecurityGroup", {
      name: "vargas-jr-ssh-access",
      description: "Security group for VargasJR agent SSH access",
    });

    new SecurityGroupRule(this, "SSHIngressRule", {
      type: "ingress",
      fromPort: 22,
      toPort: 22,
      protocol: "tcp",
      cidrBlocks: ["0.0.0.0/0"],
      description: "SSH access from anywhere",
      securityGroupId: securityGroup.id,
    });

    new SecurityGroupRule(this, "AllEgressRule", {
      type: "egress",
      fromPort: 0,
      toPort: 0,
      protocol: "-1",
      cidrBlocks: ["0.0.0.0/0"],
      securityGroupId: securityGroup.id,
    });

    return securityGroup;
  }

  private createSESResources(tags: Record<string, string>) {
    new SesDomainIdentity(this, "DomainIdentity", {
      domain: "vargasjr.dev",
    });

    new SesEmailIdentity(this, "EmailIdentity", {
      email: "hello@vargasjr.dev",
    });
  }

  private createEmailLambdaResources(tags: Record<string, string>) {
    const lambdaRole = new IamRole(this, "EmailLambdaRole", {
      name: "vargas-jr-email-lambda-role",
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Principal: {
              Service: "lambda.amazonaws.com"
            }
          }
        ]
      }),
      tags
    });

    new IamRolePolicyAttachment(this, "EmailLambdaBasicExecution", {
      role: lambdaRole.name,
      policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
    });

    const webhookSecret = new SecretsmanagerSecret(this, "SESWebhookSecret", {
      name: "vargas-jr-ses-webhook-secret",
      description: "Secret for SES webhook signature verification",
      tags
    });

    new SecretsmanagerSecretVersion(this, "SESWebhookSecretVersion", {
      secretId: webhookSecret.id,
      secretString: randomBytes(32).toString('hex')
    });

    const emailLambda = new LambdaFunction(this, "EmailLambdaFunction", {
      functionName: "vargas-jr-email-processor",
      role: lambdaRole.arn,
      handler: "index.handler",
      runtime: "nodejs18.x",
      timeout: 30,
      environment: {
        variables: {
          WEBHOOK_URL: this.getWebhookUrl(),
          SES_WEBHOOK_SECRET: webhookSecret.arn
        }
      },
      code: {
        zipFile: this.getLambdaCode()
      },
      tags
    });

    new LambdaPermission(this, "EmailLambdaSESPermission", {
      statementId: "AllowSESInvoke",
      action: "lambda:InvokeFunction",
      functionName: emailLambda.functionName,
      principal: "ses.amazonaws.com"
    });

    const receiptRuleSet = new SesReceiptRuleSet(this, "EmailReceiptRuleSet", {
      ruleSetName: "vargas-jr-email-rules"
    });

    new SesReceiptRule(this, "EmailReceiptRule", {
      name: "process-incoming-email",
      ruleSetName: receiptRuleSet.ruleSetName,
      recipients: ["hello@vargasjr.dev"],
      enabled: true,
      lambdaAction: [
        {
          functionArn: emailLambda.arn,
          invocationType: "Event"
        }
      ]
    });
  }

  private getWebhookUrl(): string {
    const environment = process.env.VERCEL_ENV === 'production' ? 'production' : 'preview';
    if (environment === 'production') {
      return 'https://vargasjr.dev/api/ses/webhook';
    } else {
      return `https://${process.env.VERCEL_URL}/api/ses/webhook`;
    }
  }

  private getLambdaCode(): string {
    return `
const https = require('https');
const crypto = require('crypto');

exports.handler = async (event) => {
    console.log('Received SES event:', JSON.stringify(event, null, 2));
    
    try {
        const snsPayload = {
            Records: [{
                ses: event.Records[0].ses
            }]
        };
        
        const body = JSON.stringify(snsPayload);
        const webhookSecret = process.env.SES_WEBHOOK_SECRET;
        
        const hmac = crypto.createHmac('sha256', webhookSecret);
        hmac.update(body);
        const signature = hmac.digest('base64');
        
        const webhookUrl = new URL(process.env.WEBHOOK_URL);
        const options = {
            hostname: webhookUrl.hostname,
            port: 443,
            path: webhookUrl.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'x-amz-sns-message-signature': signature
            }
        };
        
        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    console.log('Webhook response:', res.statusCode, data);
                    resolve({
                        statusCode: 200,
                        body: JSON.stringify({ message: 'Email processed successfully' })
                    });
                });
            });
            
            req.on('error', (error) => {
                console.error('Webhook request failed:', error);
                reject(error);
            });
            
            req.write(body);
            req.end();
        });
        
    } catch (error) {
        console.error('Error processing email:', error);
        throw error;
    }
};`;
  }

}

const app = new App();

const environment = process.env.VERCEL_ENV === 'production' ? 'production' : 'preview';
const prNumber = process.env.VERCEL_GIT_COMMIT_REF?.replace('refs/heads/devin/', '').split('-')[0];

new VargasJRInfrastructureStack(app, `vargasjr-${environment}`, {
  environment,
  ...(environment === 'preview' && prNumber && { prNumber }),
});

app.synth();
