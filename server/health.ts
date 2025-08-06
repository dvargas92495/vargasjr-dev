import { EC2 } from "@aws-sdk/client-ec2";
import { SSM } from "@aws-sdk/client-ssm";
import { IAMClient, GetInstanceProfileCommand } from "@aws-sdk/client-iam";

export interface HealthCheckResult {
  instanceId: string;
  status: "healthy" | "unhealthy" | "offline";
  error?: string;
  diagnostics?: {
    ssm?: {
      registered: boolean;
      pingStatus?: string;
      lastPingDateTime?: Date;
      timeSinceLastPing?: string;
      platformType?: string;
      agentVersion?: string;
      associationStatus?: string;
      lastAssociationExecutionDate?: Date;
      troubleshooting?: string[];
    };
    healthcheck?: {
      environmentVariables?: {
        critical?: Record<string, boolean>;
        optional?: Record<string, boolean>;
      };
      processes?: string;
      memory?: string;
      fatalErrors?: boolean;
    };
    troubleshooting?: string[];
  };
}

export interface HealthCheckOptions {
  environment?: "preview" | "production";
  version?: string;
  prNumber?: string;
}

export interface SSMReadinessResult {
  ready: boolean;
  error?: string;
  diagnostics?: {
    registered: boolean;
    pingStatus?: string;
    lastPingDateTime?: Date;
    timeSinceLastPing?: string;
    platformType?: string;
    agentVersion?: string;
    associationStatus?: string;
    lastAssociationExecutionDate?: Date;
    troubleshooting?: string[];
  };
}

export async function validateSSMReadiness(
  instanceId: string,
  region: string = "us-east-1"
): Promise<SSMReadinessResult> {
  console.log(`[SSM Validation] Starting validation for instance ${instanceId} in region ${region}`);
  const validationStartTime = Date.now();
  
  const ec2 = new EC2({ region });
  const ssm = new SSM({ region });

  try {
    console.log(`[SSM Validation] Checking EC2 instance state...`);
    const instanceResult = await ec2.describeInstances({
      InstanceIds: [instanceId],
    });
    const instance = instanceResult.Reservations?.[0]?.Instances?.[0];

    if (!instance) {
      console.error(`[SSM Validation] Instance ${instanceId} not found`);
      return {
        ready: false,
        error: "Instance not found",
      };
    }

    const instanceState = instance.State?.Name;
    console.log(`[SSM Validation] Instance state: ${instanceState}`);
    
    if (instanceState !== "running") {
      console.error(`[SSM Validation] Instance is ${instanceState}, must be running for SSM`);
      return {
        ready: false,
        error: `Instance is ${instanceState}, must be running for SSM`,
      };
    }

    console.log(`[SSM Validation] Checking SSM registration...`);
    const ssmInstances = await ssm.describeInstanceInformation({
      Filters: [{ Key: "InstanceIds", Values: [instanceId] }],
    });

    if (!ssmInstances.InstanceInformationList?.length) {
      console.error(`[SSM Validation] Instance ${instanceId} not registered with Systems Manager`);
      return {
        ready: false,
        error: "Instance not registered with Systems Manager",
        diagnostics: {
          registered: false,
          troubleshooting: [
            "Verify SSM Agent is installed and running",
            "Check IAM instance profile has AmazonSSMManagedInstanceCore policy", 
            "Verify VPC endpoints or outbound HTTPS (443) connectivity",
            "Restart SSM Agent: sudo systemctl restart amazon-ssm-agent"
          ]
        }
      };
    }

    const ssmInstance = ssmInstances.InstanceInformationList[0];
    const pingStatus = ssmInstance.PingStatus;
    const lastPingDateTime = ssmInstance.LastPingDateTime;
    const platformType = ssmInstance.PlatformType;
    const agentVersion = ssmInstance.AgentVersion;
    const associationStatus = ssmInstance.AssociationStatus;
    const lastAssociationExecutionDate = ssmInstance.LastAssociationExecutionDate;

    console.log(`[SSM Validation] SSM Instance Info - Ping: ${pingStatus}, Platform: ${platformType}, Agent: ${agentVersion}`);

    if (pingStatus !== "Online") {
      console.error(`[SSM Validation] Instance SSM ping status is ${pingStatus}, expected Online`);
      
      let timeSinceLastPing = "Unknown";
      if (lastPingDateTime) {
        const timeDiff = Date.now() - lastPingDateTime.getTime();
        const minutes = Math.floor(timeDiff / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
          timeSinceLastPing = `${hours}h ${minutes % 60}m ago`;
        } else {
          timeSinceLastPing = `${minutes}m ago`;
        }
      }

      const troubleshootingSteps = [
        "Check SSM Agent status: sudo systemctl status amazon-ssm-agent",
        "Restart SSM Agent: sudo systemctl restart amazon-ssm-agent",
        "Verify IAM instance profile permissions (AmazonSSMManagedInstanceCore)",
        "Check VPC endpoints for Systems Manager or ensure outbound HTTPS access",
        "Review CloudWatch logs for SSM Agent errors"
      ];

      if (lastPingDateTime) {
        const timeSinceLastPing = Date.now() - lastPingDateTime.getTime();
        if (timeSinceLastPing > 5 * 60 * 1000) {
          troubleshootingSteps.unshift("SSM Agent hasn't pinged in over 5 minutes - likely connectivity issue");
        }
      }

      return {
        ready: false,
        error: `SSM ping status is ${pingStatus} (expected Online)`,
        diagnostics: {
          registered: true,
          pingStatus,
          lastPingDateTime,
          timeSinceLastPing,
          platformType,
          agentVersion,
          associationStatus,
          lastAssociationExecutionDate,
          troubleshooting: troubleshootingSteps
        }
      };
    }

    const validationDuration = Date.now() - validationStartTime;
    console.log(`[SSM Validation] ✅ Instance ${instanceId} is ready for SSM commands (${validationDuration}ms)`);
    
    return {
      ready: true,
      diagnostics: {
        registered: true,
        pingStatus,
        lastPingDateTime,
        platformType,
        agentVersion,
        associationStatus,
        lastAssociationExecutionDate,
        troubleshooting: []
      }
    };
  } catch (error) {
    const validationDuration = Date.now() - validationStartTime;
    const errorMessage = error instanceof Error ? error.message : "SSM validation failed";
    console.error(`[SSM Validation] ❌ Validation failed after ${validationDuration}ms: ${errorMessage}`);
    
    return { ready: false, error: errorMessage };
  }
}

export async function checkInstanceHealth(
  instanceId: string,
  region: string = "us-east-1",
  maxAttempts: number = 20
): Promise<HealthCheckResult> {
  const ssm = new SSM({ region });

  try {
    const ssmValidationStartTime = Date.now();
    const ssmValidation = await validateSSMReadiness(instanceId, region);
    const ssmValidationDuration = Date.now() - ssmValidationStartTime;
    console.log(
      `[Health Check] SSM Validation - Duration: ${ssmValidationDuration}ms, Ready: ${ssmValidation.ready}`
    );

    if (!ssmValidation.ready) {
      return {
        instanceId,
        status: "offline",
        error: `Health check failed: ${ssmValidation.error}`,
        diagnostics: {
          ssm: ssmValidation.diagnostics,
          troubleshooting: ssmValidation.diagnostics?.troubleshooting || []
        }
      };
    }

    try {
      const sendCommandStartTime = Date.now();
      const directoryName = `vargasjr_dev_agent-*`;

      const ssmOperation = async () => {
        const commandResult = await ssm.sendCommand({
          InstanceIds: [instanceId],
          DocumentName: "AWS-RunShellScript",
          Parameters: {
            commands: [`cd /home/ubuntu/${directoryName} && timeout 5s npm run healthcheck`],
          },
          TimeoutSeconds: 30,
        });
        const sendCommandDuration = Date.now() - sendCommandStartTime;
        const commandId = commandResult.Command?.CommandId;
        console.log(`[Health Check] SSM Send Command - Duration: ${sendCommandDuration}ms, CommandId: ${commandId}`);
        if (!commandId) {
          throw new Error("Failed to get command ID from SSM");
        }

        const pollingStartTime = Date.now();
        let attempts = 0;
        let commandOutput = "";

        while (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000));

          try {
            const outputResult = await ssm.getCommandInvocation({
              CommandId: commandId,
              InstanceId: instanceId,
            });

            if (outputResult.Status === "Success") {
              commandOutput = outputResult.StandardOutputContent || "";
              break;
            } else if (outputResult.Status === "Failed") {
              const errorDetails =
                outputResult.StandardErrorContent || "No error details available";
              const outputDetails =
                outputResult.StandardOutputContent || "No output";
              
              const exitCode = outputResult.ResponseCode || 1;
              const isFatalError = exitCode === 2;
              
              if (isFatalError) {
                throw new Error(
                  `Fatal error detected (exit code ${exitCode}): ${errorDetails}\nCommand output: ${outputDetails}`
                );
              }
              
              throw new Error(
                `SSM command failed (exit code ${exitCode}): ${errorDetails}\nCommand output: ${outputDetails}`
              );
            }
          } catch (outputError) {
            if (attempts === maxAttempts - 1) {
              throw outputError;
            }
            console.error(
              `[Health Check] Attempt ${attempts + 1}/${maxAttempts} Error: ${
                outputError instanceof Error
                  ? outputError.message
                  : String(outputError)
              }`
            );
          }

          attempts++;
        }

        const pollingDuration = Date.now() - pollingStartTime;
        console.log(
          `[Health Check] SSM Polling Loop - Total duration: ${pollingDuration}ms, Attempts: ${
            attempts + 1
          }/${maxAttempts}, Final Status: ${commandOutput ? 'Success' : 'Timeout'}`
        );

        if (attempts >= maxAttempts) {
          throw new Error("SSM command timed out");
        }

        return commandOutput;
      };

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("SSM health check timed out after 15 seconds"));
        }, 15000);
      });

      const commandOutput = await Promise.race([ssmOperation(), timeoutPromise]);

      const hasAgentSession =
        commandOutput.includes("agent-") || commandOutput.includes("\tagent\t");

      const diagnosticInfo = parseHealthcheckOutput(commandOutput);
      const troubleshootingSteps = generateTroubleshootingSteps(commandOutput, hasAgentSession);

      return {
        instanceId,
        status: hasAgentSession ? "healthy" : "unhealthy",
        error: hasAgentSession ? undefined : generateDetailedErrorMessage(commandOutput),
        diagnostics: {
          ssm: ssmValidation.diagnostics,
          healthcheck: diagnosticInfo,
          troubleshooting: troubleshootingSteps
        }
      };
    } catch (ssmError) {
      const errorMessage =
        ssmError instanceof Error ? ssmError.message : "SSM command failed";
      console.error(`[Health Check] SSM command error: ${errorMessage}`);

      return {
        instanceId,
        status: "offline",
        error: `Health check failed: ${errorMessage}`,
        diagnostics: {
          ssm: ssmValidation.diagnostics,
          troubleshooting: generateTroubleshootingSteps("", false)
        }
      };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Health check failed";
    console.error(`[Health Check] Unexpected error: ${errorMessage}`);

    return {
      instanceId,
      status: "offline",
      error: `Health check failed: ${errorMessage}`,
      diagnostics: {
        troubleshooting: ["Check instance state and SSM connectivity", "Verify agent installation and configuration"]
      }
    };
  }
}

function parseHealthcheckOutput(output: string): any {
  const diagnostics: any = {};
  
  if (output.includes('Environment Variables Check')) {
    const envSection = output.split('--- Environment Variables Check ---')[1]?.split('---')[0];
    if (envSection) {
      diagnostics.environmentVariables = {
        critical: extractEnvVarStatus(envSection, ['AGENT_ENVIRONMENT', 'DATABASE_URL', 'VELLUM_API_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']),
        optional: extractEnvVarStatus(envSection, ['PR_NUMBER', 'GITHUB_PRIVATE_KEY', 'NEON_API_KEY'])
      };
    }
  }
  
  if (output.includes('Process Information')) {
    diagnostics.processes = output.includes('Agent-related processes found') ? 'found' : 'none';
  }
  
  if (output.includes('Memory usage:')) {
    const memoryMatch = output.match(/Memory usage:\s*\n([^\n]+)/);
    if (memoryMatch) {
      diagnostics.memory = memoryMatch[1].trim();
    }
  }
  
  if (output.includes('Screen sessions:')) {
    diagnostics.screenSessions = output.includes('Agent screen session detected: ✓ Yes');
  }
  
  if (output.includes('Network Connectivity')) {
    const networkSection = output.split('--- Network Connectivity ---')[1]?.split('---')[0];
    if (networkSection) {
      diagnostics.networkConnectivity = {
        github: networkSection.includes('GitHub API response: 200'),
        vellum: networkSection.includes('Vellum API response: 200')
      };
    }
  }
  
  if (output.includes('File System Checks')) {
    const fileSection = output.split('--- File System Checks ---')[1]?.split('---')[0];
    if (fileSection) {
      diagnostics.fileSystem = {
        nodeModules: fileSection.includes('node_modules/: ✓ Exists'),
        envFile: fileSection.includes('.env: ✓ Exists'),
        errorLog: fileSection.includes('error.log: ✓ Exists'),
        agentLog: fileSection.includes('agent.log: ✓ Exists')
      };
    }
  }
  
  if (output.includes('FATAL ERROR') || output.includes('💀')) {
    diagnostics.fatalErrors = true;
  }
  
  return diagnostics;
}

function extractEnvVarStatus(section: string, varNames: string[]): Record<string, boolean> {
  const status: Record<string, boolean> = {};
  varNames.forEach(varName => {
    status[varName] = section.includes(`${varName}: ✓ Set`);
  });
  return status;
}

function generateDetailedErrorMessage(output: string): string {
  if (output.includes('💀 FATAL ERROR')) {
    if (output.includes('Missing') && output.includes('environment variables')) {
      return 'Agent has fatal errors due to missing critical environment variables (DATABASE_URL, VELLUM_API_KEY, etc.)';
    }
    if (output.includes('Database connection') || output.includes('database')) {
      return 'Agent has fatal errors - database connectivity issues detected';
    }
    return 'Agent has fatal errors - check logs for critical issues';
  }
  
  if (output.includes('✗ Missing') || (output.includes('Missing') && output.includes('environment variables'))) {
    const missingVars: string[] = [];
    if (output.includes('DATABASE_URL: ✗ Missing')) missingVars.push('DATABASE_URL');
    if (output.includes('VELLUM_API_KEY: ✗ Missing')) missingVars.push('VELLUM_API_KEY');
    if (output.includes('AGENT_ENVIRONMENT: ✗ Missing')) missingVars.push('AGENT_ENVIRONMENT');
    if (missingVars.length > 0) {
      return `Missing critical environment variables: ${missingVars.join(', ')} - agent cannot start`;
    }
    return 'Missing critical environment variables - check agent configuration';
  }
  
  if (output.includes('No agent-related processes found')) {
    if (output.includes('node_modules/: ✗ Missing')) {
      return 'Agent process not running - dependencies not installed (missing node_modules)';
    }
    return 'Agent process not running - may have crashed or failed to start';
  }
  
  if (output.includes('No screen sessions found') || output.includes('screen command failed')) {
    return 'No screen sessions found - agent may not have started properly or screen is not available';
  }
  
  if (output.includes('GitHub API test failed') || output.includes('Vellum API test failed')) {
    return 'Agent not running - network connectivity issues detected (GitHub/Vellum API unreachable)';
  }
  
  if (output.includes('Memory usage:') && (output.includes('100%') || output.includes('full'))) {
    return 'Agent not running - system may be out of memory or disk space';
  }
  
  return 'Agent not running - check screen sessions and process status';
}

function generateTroubleshootingSteps(output: string, hasAgentSession: boolean): string[] {
  const steps: string[] = [];
  
  if (output.includes('💀 FATAL ERROR')) {
    steps.push('Check error.log and agent.log for critical errors: tail -f error.log agent.log');
    if (output.includes('Missing') && output.includes('environment variables')) {
      steps.push('Set missing environment variables in .env file (DATABASE_URL, VELLUM_API_KEY, AGENT_ENVIRONMENT)');
    }
    if (output.includes('Database connection') || output.includes('database')) {
      steps.push('Test database connectivity: check DATABASE_URL and network access');
    }
    steps.push('Verify all environment variables are properly set: cat .env');
    steps.push('Restart the agent process: npm run agent:start');
  } else if (!hasAgentSession) {
    if (output.includes('✗ Missing') || (output.includes('Missing') && output.includes('environment variables'))) {
      const missingVars: string[] = [];
      if (output.includes('DATABASE_URL: ✗ Missing')) missingVars.push('DATABASE_URL');
      if (output.includes('VELLUM_API_KEY: ✗ Missing')) missingVars.push('VELLUM_API_KEY');
      if (output.includes('AGENT_ENVIRONMENT: ✗ Missing')) missingVars.push('AGENT_ENVIRONMENT');
      if (missingVars.length > 0) {
        steps.push(`Set missing environment variables in .env file: ${missingVars.join(', ')}`);
      } else {
        steps.push('Set missing environment variables in .env file');
      }
    }
    
    if (output.includes('node_modules/: ✗ Missing')) {
      steps.push('Install dependencies: npm install');
    }
    
    steps.push('Check if agent screen session exists: screen -ls');
    steps.push('Restart agent: cd /home/ubuntu/vargasjr_dev_agent-* && npm run agent:start');
    steps.push('Check agent logs: tail -f agent.log error.log');
    
    if (output.includes('GitHub API test failed') || output.includes('Vellum API test failed')) {
      steps.push('Check network connectivity: curl -I https://api.github.com && curl -I https://api.vellum.ai');
      steps.push('Verify firewall and security group settings allow outbound HTTPS');
    }
    
    if (output.includes('Memory usage:')) {
      steps.push('Check system resources: free -h && df -h');
      steps.push('Consider restarting the instance if resources are exhausted');
    }
    
    steps.push('Verify environment variables are set: env | grep -E "(DATABASE_URL|VELLUM_API_KEY|AGENT_ENVIRONMENT)"');
  }
  
  if (output.includes('No agent-related processes found')) {
    steps.push('Check system resources: free -h && df -h');
    if (!output.includes('node_modules/: ✗ Missing')) {
      steps.push('Verify node_modules are installed: ls -la node_modules');
    }
    steps.push('Check for any error logs: ls -la *.log');
  }
  
  return steps;
}
