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
import { IamInstanceProfile } from "@cdktf/provider-aws/lib/iam-instance-profile";
import { SesReceiptRule } from "@cdktf/provider-aws/lib/ses-receipt-rule";
import { SesReceiptRuleSet } from "@cdktf/provider-aws/lib/ses-receipt-rule-set";
import { ImagebuilderImagePipeline } from "@cdktf/provider-aws/lib/imagebuilder-image-pipeline";
import { ImagebuilderImageRecipe } from "@cdktf/provider-aws/lib/imagebuilder-image-recipe";
import { ImagebuilderComponent } from "@cdktf/provider-aws/lib/imagebuilder-component";
import { ImagebuilderInfrastructureConfiguration } from "@cdktf/provider-aws/lib/imagebuilder-infrastructure-configuration";
import { ImagebuilderDistributionConfiguration } from "@cdktf/provider-aws/lib/imagebuilder-distribution-configuration";
import { ImagebuilderImage } from "@cdktf/provider-aws/lib/imagebuilder-image";
import { AWS_S3_BUCKETS, VARGASJR_IMAGE_NAME } from "../app/lib/constants";


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
    this.createCustomAMI(commonTags);
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
      path: "lambda",
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
          SES_WEBHOOK_SECRET: process.env.SES_WEBHOOK_SECRET || '',
          LAMBDA_TEST_MODE: process.env.LAMBDA_TEST_MODE || 'false',
          TEST_WEBHOOK_URL: process.env.TEST_WEBHOOK_URL || ''
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

  private createCustomAMI(tags: Record<string, string>) {
    const imageBuilderRole = new IamRole(this, "ImageBuilderRole", {
      name: "vargasjr-imagebuilder-role",
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Principal: {
              Service: "ec2.amazonaws.com"
            }
          }
        ]
      }),
      tags
    });

    new IamRolePolicyAttachment(this, "ImageBuilderSSMPolicy", {
      role: imageBuilderRole.name,
      policyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
    });

    new IamRolePolicyAttachment(this, "ImageBuilderEC2Policy", {
      role: imageBuilderRole.name,
      policyArn: "arn:aws:iam::aws:policy/EC2InstanceProfileForImageBuilder"
    });

    const imageBuilderInstanceProfile = new IamInstanceProfile(this, "ImageBuilderInstanceProfile", {
      name: "vargasjr-imagebuilder-instance-profile",
      role: imageBuilderRole.name,
      tags
    });

    const nodeJsComponent = new ImagebuilderComponent(this, "NodeJSComponent", {
      name: VARGASJR_IMAGE_NAME,
      platform: "Linux",
      version: "1.0.0",
      data: `
name: Install Node.js 20
description: Installs Node.js 20.x on Ubuntu
schemaVersion: 1.0

phases:
  - name: build
    steps:
      - name: UpdatePackages
        action: ExecuteBash
        inputs:
          commands:
            - apt update
            - apt install -y unzip curl
      - name: InstallNodeJS
        action: ExecuteBash
        inputs:
          commands:
            - curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            - apt-get install -y nodejs
            - node --version
            - npm --version
      - name: InstallSSMAgent
        action: ExecuteBash
        inputs:
          commands:
            - systemctl enable snap.amazon-ssm-agent.amazon-ssm-agent.service
            - systemctl start snap.amazon-ssm-agent.amazon-ssm-agent.service
`,
      tags
    });

    const infraConfig = new ImagebuilderInfrastructureConfiguration(this, "VargasJRInfraConfig", {
      name: "vargasjr-infra-config",
      instanceProfileName: imageBuilderInstanceProfile.name,
      instanceTypes: ["t3.medium"],
      tags
    });

    const distConfig = new ImagebuilderDistributionConfiguration(this, "VargasJRDistConfig", {
      name: "vargasjr-dist-config",
      distribution: [{
        amiDistributionConfiguration: {
          name: `${VARGASJR_IMAGE_NAME}-{{ imagebuilder:buildDate }}`,
          description: "VargasJR AMI with Node.js pre-installed"
        },
        region: "us-east-1"
      }],
      tags
    });

    const imageRecipe = new ImagebuilderImageRecipe(this, "VargasJRImageRecipe", {
      name: VARGASJR_IMAGE_NAME,
      version: "1.0.0",
      parentImage: "ami-0e2c8caa4b6378d8c",
      component: [{
        componentArn: nodeJsComponent.arn
      }],
      tags
    });

    const imagePipeline = new ImagebuilderImagePipeline(this, "VargasJRImagePipeline", {
      name: VARGASJR_IMAGE_NAME,
      imageRecipeArn: imageRecipe.arn,
      infrastructureConfigurationArn: infraConfig.arn,
      distributionConfigurationArn: distConfig.arn,
      status: "ENABLED",
      tags
    });

    const image = new ImagebuilderImage(this, "VargasJRImage", {
      imageRecipeArn: imageRecipe.arn,
      infrastructureConfigurationArn: infraConfig.arn,
      distributionConfigurationArn: distConfig.arn,
      tags
    });

    return imagePipeline;
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
