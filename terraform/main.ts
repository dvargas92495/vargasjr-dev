import * as path from "path";
import { Construct } from "constructs";
import { App, TerraformStack, S3Backend, TerraformAsset, AssetType } from "cdktf";
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
import { AWS_S3_BUCKETS } from "../app/lib/constants";


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
      key: "terraform/state/terraform.tfstate",
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


    const lambdaAsset = new TerraformAsset(this, "EmailLambdaAsset", {
      path: "lambda-email-processor.js",
      type: AssetType.ARCHIVE,
    });

    const emailLambda = new LambdaFunction(this, "EmailLambdaFunction", {
      functionName: "vargas-jr-email-processor",
      role: lambdaRole.arn,
      handler: "lambda-email-processor.handler",
      runtime: "nodejs18.x",
      timeout: 30,
      environment: {
        variables: {
          WEBHOOK_URL: this.getWebhookUrl(),
          SES_WEBHOOK_SECRET: process.env.SES_WEBHOOK_SECRET || ''
        }
      },
      filename: lambdaAsset.path,
      sourceCodeHash: lambdaAsset.assetHash,
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
          invocationType: "Event",
          position: 1
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


}

const app = new App();

const environment = process.env.VERCEL_ENV === 'production' ? 'production' : 'preview';
const prNumber = process.env.VERCEL_GIT_COMMIT_REF?.replace('refs/heads/devin/', '').split('-')[0];

new VargasJRInfrastructureStack(app, `vargasjr-${environment}`, {
  environment,
  ...(environment === 'preview' && prNumber && { prNumber }),
});

app.synth();
