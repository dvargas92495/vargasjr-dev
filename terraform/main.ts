import { Construct } from "constructs";
import { App, TerraformStack, TerraformOutput } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket";
import { S3BucketVersioningA } from "@cdktf/provider-aws/lib/s3-bucket-versioning";
import { S3BucketServerSideEncryptionConfigurationA } from "@cdktf/provider-aws/lib/s3-bucket-server-side-encryption-configuration";
import { SecurityGroup } from "@cdktf/provider-aws/lib/security-group";
import { SecurityGroupRule } from "@cdktf/provider-aws/lib/security-group-rule";
import { KeyPair } from "@cdktf/provider-aws/lib/key-pair";
import { SecretsmanagerSecret } from "@cdktf/provider-aws/lib/secretsmanager-secret";
import { SecretsmanagerSecretVersion } from "@cdktf/provider-aws/lib/secretsmanager-secret-version";
import { SesEmailIdentity } from "@cdktf/provider-aws/lib/ses-email-identity";
import { SesDomainIdentity } from "@cdktf/provider-aws/lib/ses-domain-identity";
import { Instance } from "@cdktf/provider-aws/lib/instance";

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
      CreatedBy: "cdktf-infrastructure",
      ...(config.prNumber && { PRNumber: config.prNumber }),
    };

    this.createS3Resources(commonTags);
    
    const securityGroup = this.createSecurityGroup(commonTags);
    
    this.createSESResources(commonTags);
    
    this.createKeyPairResources(config, commonTags);
  }

  private createS3Resources(tags: Record<string, string>) {
    const memoryBucket = new S3Bucket(this, "MemoryBucket", {
      bucket: "vargas-jr-memory",
      tags: {
        ...tags,
        Purpose: "agent-memory-backup",
      },
    });

    new S3BucketVersioningA(this, "MemoryBucketVersioning", {
      bucket: memoryBucket.id,
      versioningConfiguration: {
        status: "Enabled",
      },
    });

    new S3BucketServerSideEncryptionConfigurationA(this, "MemoryBucketEncryption", {
      bucket: memoryBucket.id,
      rule: [
        {
          applyServerSideEncryptionByDefault: {
            sseAlgorithm: "AES256",
          },
        },
      ],
    });

    const inboxBucket = new S3Bucket(this, "InboxBucket", {
      bucket: "vargas-jr-inbox",
      tags: {
        ...tags,
        Purpose: "email-attachments",
      },
    });

    new S3BucketVersioningA(this, "InboxBucketVersioning", {
      bucket: inboxBucket.id,
      versioningConfiguration: {
        status: "Enabled",
      },
    });

    new S3BucketServerSideEncryptionConfigurationA(this, "InboxBucketEncryption", {
      bucket: inboxBucket.id,
      rule: [
        {
          applyServerSideEncryptionByDefault: {
            sseAlgorithm: "AES256",
          },
        },
      ],
    });

    new TerraformOutput(this, "MemoryBucketName", {
      value: memoryBucket.bucket,
      description: "Name of the S3 bucket for agent memory backup",
    });

    new TerraformOutput(this, "InboxBucketName", {
      value: inboxBucket.bucket,
      description: "Name of the S3 bucket for email attachments",
    });
  }

  private createSecurityGroup(tags: Record<string, string>): SecurityGroup {
    const securityGroup = new SecurityGroup(this, "SSHSecurityGroup", {
      name: "vargas-jr-ssh-access",
      description: "Security group for VargasJR agent SSH access",
      tags: {
        ...tags,
        Purpose: "ssh-access",
      },
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
      description: "All outbound traffic",
      securityGroupId: securityGroup.id,
    });

    new TerraformOutput(this, "SecurityGroupId", {
      value: securityGroup.id,
      description: "ID of the SSH security group",
    });

    return securityGroup;
  }

  private createSESResources(tags: Record<string, string>) {
    const domainIdentity = new SesDomainIdentity(this, "DomainIdentity", {
      domain: "vargasjr.dev",
    });

    const emailIdentity = new SesEmailIdentity(this, "EmailIdentity", {
      email: "hello@vargasjr.dev",
    });

    new TerraformOutput(this, "SESDomainIdentity", {
      value: domainIdentity.domain,
      description: "SES domain identity for email sending",
    });

    new TerraformOutput(this, "SESEmailIdentity", {
      value: emailIdentity.email,
      description: "SES email identity for sending emails",
    });
  }

  private createKeyPairResources(config: VargasJRStackConfig, tags: Record<string, string>) {
    const keyPairName = config.prNumber ? `pr-${config.prNumber}-key` : "main-key";
    const secretName = config.prNumber 
      ? `vargasjr-pr-${config.prNumber}-${keyPairName}-pem`
      : `vargasjr-prod-${keyPairName}-pem`;

    const keyPair = new KeyPair(this, "EC2KeyPair", {
      keyName: keyPairName,
      publicKey: "ssh-rsa PLACEHOLDER_PUBLIC_KEY_CONTENT", // This would be replaced with actual public key
      tags: {
        ...tags,
        Purpose: "ec2-access",
      },
    });

    const secret = new SecretsmanagerSecret(this, "KeyPairSecret", {
      name: secretName,
      description: `SSH key for VargasJR agent: ${secretName}`,
      tags: {
        ...tags,
        Purpose: "ssh-key-storage",
      },
    });

    new SecretsmanagerSecretVersion(this, "KeyPairSecretVersion", {
      secretId: secret.id,
      secretString: "PLACEHOLDER_PRIVATE_KEY_CONTENT", // This would be replaced with actual private key
    });

    new TerraformOutput(this, "KeyPairName", {
      value: keyPair.keyName,
      description: "Name of the EC2 key pair",
    });

    new TerraformOutput(this, "KeyPairSecretName", {
      value: secret.name,
      description: "Name of the secret containing the private key",
    });
  }
}

class VargasJREC2Stack extends TerraformStack {
  constructor(scope: Construct, id: string, config: VargasJRStackConfig & { 
    securityGroupId: string;
    keyPairName: string;
    instanceName?: string;
  }) {
    super(scope, id);

    const region = config.region || "us-east-1";
    
    new AwsProvider(this, "AWS", {
      region: region,
    });

    const instanceName = config.instanceName || 
      (config.prNumber ? `vargas-jr-pr-${config.prNumber}` : "vargas-jr-main");

    const commonTags = {
      Project: "VargasJR",
      Type: config.environment,
      CreatedBy: "cdktf-infrastructure",
      ...(config.prNumber && { PRNumber: config.prNumber }),
    };

    const instance = new Instance(this, "VargasJRAgent", {
      ami: "ami-0e2c8caa4b6378d8c", // Ubuntu AMI
      instanceType: "t3.micro",
      keyName: config.keyPairName,
      securityGroups: [config.securityGroupId],
      tags: {
        ...commonTags,
        Name: instanceName,
        Purpose: "agent-runner",
      },
    });

    new TerraformOutput(this, "InstanceId", {
      value: instance.id,
      description: "ID of the EC2 instance",
    });

    new TerraformOutput(this, "InstancePublicDns", {
      value: instance.publicDns,
      description: "Public DNS name of the EC2 instance",
    });

    new TerraformOutput(this, "InstancePublicIp", {
      value: instance.publicIp,
      description: "Public IP address of the EC2 instance",
    });
  }
}

const app = new App();

new VargasJRInfrastructureStack(app, "vargasjr-production", {
  environment: "production",
});

new VargasJRInfrastructureStack(app, "vargasjr-preview-template", {
  environment: "preview",
  prNumber: "PLACEHOLDER", // This would be replaced when creating actual preview environments
});

app.synth();
