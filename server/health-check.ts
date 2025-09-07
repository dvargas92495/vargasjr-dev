import { execSync } from "child_process";
import { readFileSync, existsSync, statSync } from "fs";
import { AGENT_SERVER_PORT, LOCAL_AGENT_INSTANCE_ID } from "./constants";

export interface HealthCheckData {
  status: "healthy" | "unhealthy" | "fatal";
  timestamp: string;
  environment: {
    agentEnvironment: string;
    prNumber: string;
    workingDirectory: string;
    nodeVersion: string;
  };
  environmentVariables: {
    critical: Record<string, boolean>;
    optional: Record<string, boolean>;
  };
  processes: {
    agentProcesses: string[];
    hasAgentSession: boolean;
    screenOutput: string;
  };
  systemResources: {
    memory: string;
    disk: string;
  };
  fileSystem: {
    files: Record<string, any>;
    directories: Record<string, boolean>;
  };
  network: {
    github: string;
    vellum: string;
  };
  logs: {
    errorLog: any;
    browserErrorLog: any;
    outLog: any;
    agentLog: any;
    hasFatalError: boolean;
  };
  detailedReport: string;
}

export async function getHealthCheckData(): Promise<HealthCheckData> {
  let hasAgentSession = false;
  let hasFatalError = false;
  let detailedReport = "";

  const agentEnv = process.env.AGENT_ENVIRONMENT || "unknown";
  const prNumber = process.env.PR_NUMBER || "none";

  const criticalEnvVars = [
    "AGENT_ENVIRONMENT",
    "DATABASE_URL",
    "VELLUM_API_KEY",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
  ];
  const optionalEnvVars = ["PR_NUMBER", "GITHUB_PRIVATE_KEY", "NEON_API_KEY"];

  const criticalEnvStatus: Record<string, boolean> = {};
  criticalEnvVars.forEach((varName) => {
    criticalEnvStatus[varName] = !!process.env[varName];
  });

  const optionalEnvStatus: Record<string, boolean> = {};
  optionalEnvVars.forEach((varName) => {
    optionalEnvStatus[varName] = !!process.env[varName];
  });

  let agentProcesses: string[] = [];
  try {
    const psOutput = execSync("ps aux", { encoding: "utf8" });

    agentProcesses = psOutput
      .split("\n")
      .filter(
        (line) =>
          line.includes("poetry run agent") ||
          (line.includes("python") && line.includes("agent")) ||
          (line.includes("node") && line.includes("worker"))
      );
  } catch (error) {
    detailedReport += `Failed to get process information: ${error}\n`;
  }

  let screenOutput = "";
  try {
    screenOutput = execSync("screen -ls 2>/dev/null", { encoding: "utf8" });
    hasAgentSession =
      screenOutput.includes("agent-") || screenOutput.includes("\tagent\t");
  } catch (error) {
    screenOutput = `No screen sessions found or screen command failed: ${error}`;
  }

  detailedReport += "--- System Resources ---\n";
  let memInfo = "";
  let diskInfo = "";
  try {
    memInfo = execSync("free -h", { encoding: "utf8" });
    detailedReport += "Memory usage:\n";
    detailedReport += memInfo + "\n";

    diskInfo = execSync("df -h .", { encoding: "utf8" });
    detailedReport += "Disk usage (current directory):\n";
    detailedReport += diskInfo + "\n";
  } catch (error) {
    detailedReport += `Failed to get system resource information: ${error}\n`;
  }
  detailedReport += "\n";

  detailedReport += "--- File System Checks ---\n";
  const importantFiles = [
    ".env",
    "error.log",
    "browser-error.log",
    "agent.log",
    "out.log",
  ];
  const importantDirs = ["node_modules", "agent", "browser"];

  const fileStatus: Record<string, any> = {};
  importantFiles.forEach((file) => {
    if (existsSync(file)) {
      try {
        const stats = statSync(file);
        fileStatus[file] = {
          exists: true,
          size: stats.size,
          modified: stats.mtime.toISOString(),
        };
        detailedReport += `${file}: ✓ Exists (${
          stats.size
        } bytes, modified: ${stats.mtime.toISOString()})\n`;
      } catch (error) {
        fileStatus[file] = { exists: true, error: String(error) };
        detailedReport += `${file}: ✓ Exists (unable to read stats: ${error})\n`;
      }
    } else {
      fileStatus[file] = { exists: false };
      detailedReport += `${file}: ✗ Missing\n`;
    }
  });

  const dirStatus: Record<string, boolean> = {};
  importantDirs.forEach((dir) => {
    const exists = existsSync(dir);
    dirStatus[dir] = exists;
    detailedReport += `${dir}/: ${exists ? "✓ Exists" : "✗ Missing"}\n`;
  });
  detailedReport += "\n";

  detailedReport += "--- Network Connectivity ---\n";
  let githubTest = "";
  let vellumTest = "";
  try {
    detailedReport += "Testing GitHub API connectivity...\n";
    githubTest = execSync(
      'curl -s -o /dev/null -w "%{http_code}" https://api.github.com/user',
      { encoding: "utf8", timeout: 10000 }
    );
    detailedReport += `GitHub API response: ${githubTest}\n`;
  } catch (error) {
    githubTest = `Failed: ${error}`;
    detailedReport += `GitHub API test failed: ${error}\n`;
  }

  try {
    detailedReport += "Testing Vellum API connectivity...\n";
    vellumTest = execSync(
      'curl -s -o /dev/null -w "%{http_code}" https://api.vellum.ai',
      { encoding: "utf8", timeout: 10000 }
    );
    detailedReport += `Vellum API response: ${vellumTest}\n`;
  } catch (error) {
    vellumTest = `Failed: ${error}`;
    detailedReport += `Vellum API test failed: ${error}\n`;
  }
  detailedReport += "\n";

  const logAnalysis: any = {};

  if (existsSync("error.log")) {
    try {
      const errorLogContent = readFileSync("error.log", "utf8").trim();
      if (errorLogContent.length > 0) {
        const lines = errorLogContent.split("\n");
        logAnalysis.errorLog = {
          exists: true,
          length: errorLogContent.length,
          lines: lines.length,
          lastLines: lines.length > 20 ? lines.slice(-20) : lines,
        };

        if (
          errorLogContent.toLowerCase().includes("fatal") ||
          errorLogContent.toLowerCase().includes("critical") ||
          errorLogContent.toLowerCase().includes("traceback")
        ) {
          hasFatalError = true;
        }
      } else {
        logAnalysis.errorLog = { exists: true, empty: true };
      }
    } catch (error) {
      logAnalysis.errorLog = { exists: true, error: String(error) };
    }
  } else {
    logAnalysis.errorLog = { exists: false };
  }

  if (existsSync("browser-error.log")) {
    try {
      const browserErrorContent = readFileSync(
        "browser-error.log",
        "utf8"
      ).trim();
      if (browserErrorContent.length > 0) {
        const lines = browserErrorContent.split("\n");
        logAnalysis.browserErrorLog = {
          exists: true,
          length: browserErrorContent.length,
          lines: lines.length,
          lastLines: lines.length > 10 ? lines.slice(-10) : lines,
        };
      } else {
        logAnalysis.browserErrorLog = { exists: true, empty: true };
      }
    } catch (error) {
      logAnalysis.browserErrorLog = { exists: true, error: String(error) };
    }
  } else {
    logAnalysis.browserErrorLog = { exists: false };
  }

  if (existsSync("out.log")) {
    try {
      const outLogContent = readFileSync("out.log", "utf8").trim();
      if (outLogContent.length > 0) {
        const lines = outLogContent.split("\n");
        logAnalysis.outLog = {
          exists: true,
          length: outLogContent.length,
          lines: lines.length,
          lastLines: lines.length > 20 ? lines.slice(-20) : lines,
        };
      } else {
        logAnalysis.outLog = { exists: true, empty: true };
      }
    } catch (error) {
      logAnalysis.outLog = { exists: true, error: String(error) };
    }
  } else {
    logAnalysis.outLog = { exists: false };
  }

  if (existsSync("agent.log")) {
    try {
      const agentLogContent = readFileSync("agent.log", "utf8").trim();
      if (agentLogContent.length > 0) {
        const lines = agentLogContent.split("\n");
        logAnalysis.agentLog = {
          exists: true,
          length: agentLogContent.length,
          lines: lines.length,
          lastLines: lines.length > 10 ? lines.slice(-10) : lines,
        };
      } else {
        logAnalysis.agentLog = { exists: true, empty: true };
      }
    } catch (error) {
      logAnalysis.agentLog = { exists: true, error: String(error) };
    }
  } else {
    logAnalysis.agentLog = { exists: false };
  }

  let status: "healthy" | "unhealthy" | "fatal";
  if (hasAgentSession) {
    status = "healthy";
  } else if (hasFatalError) {
    status = "fatal";
  } else {
    status = "unhealthy";
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    environment: {
      agentEnvironment: agentEnv,
      prNumber,
      workingDirectory: process.cwd(),
      nodeVersion: process.version,
    },
    environmentVariables: {
      critical: criticalEnvStatus,
      optional: optionalEnvStatus,
    },
    processes: {
      agentProcesses,
      hasAgentSession,
      screenOutput,
    },
    systemResources: {
      memory: memInfo,
      disk: diskInfo,
    },
    fileSystem: {
      files: fileStatus,
      directories: dirStatus,
    },
    network: {
      github: githubTest,
      vellum: vellumTest,
    },
    logs: {
      ...logAnalysis,
      hasFatalError,
    },
    detailedReport,
  };
}

export async function checkLocalAgentHealth(): Promise<{
  isRunning: boolean;
  healthData?: any;
  error?: string;
}> {
  try {
    const response = await fetch(
      `http://localhost:${AGENT_SERVER_PORT}/health`,
      {
        method: "GET",
        signal: AbortSignal.timeout(5000),
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (response.ok) {
      const healthData = await response.json();
      return {
        isRunning: true,
        healthData,
      };
    } else {
      return {
        isRunning: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
    return {
      isRunning: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function createLocalAgentInstance(): {
  InstanceId?: string;
  State?: { Name?: string };
  KeyName?: string;
  PublicDnsName?: string;
  InstanceType?: string;
  ImageId?: string;
  Tags?: Array<{ Key?: string; Value?: string }>;
} {
  return {
    InstanceId: LOCAL_AGENT_INSTANCE_ID,
    State: { Name: "running" },
    KeyName: "local-dev",
    PublicDnsName: "localhost",
    InstanceType: "local",
    ImageId: "local-dev",
    Tags: [
      { Key: "Name", Value: "Local Agent" },
      { Key: "Type", Value: "local" },
      { Key: "Environment", Value: "development" },
    ],
  };
}
