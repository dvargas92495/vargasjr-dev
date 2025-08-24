import * as fs from "fs";
import * as path from "path";
import { findPackageJson } from "@/server/versioning";

export function getVersion(): string {
  try {
    const content = findPackageJson();
    const packageJson = JSON.parse(content);
    return packageJson.version || "unknown";
  } catch (error) {
    return "unknown";
  }
}

export interface Logger {
  info(message: string): void;
  error(message: string): void;
  warn(message: string): void;
  debug(message: string): void;
  setLevel(level: string): void;
}

class FileLogger implements Logger {
  private logDir: string;
  private logFile: string;
  private level: string = "INFO";

  constructor(name: string, logFilename: string, version?: string) {
    const resolvedVersion = version || getVersion();
    const homeDir = process.env.HOME || process.cwd();
    this.logDir = path.join(
      homeDir,
      ".local",
      "var",
      "log",
      "vargas-jr",
      `v${resolvedVersion}`
    );
    this.logFile = path.join(this.logDir, logFilename);

    fs.mkdirSync(this.logDir, { recursive: true });
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `${timestamp} - ${level} - ${message}\n`;
  }

  private writeLog(level: string, message: string): void {
    const formattedMessage = this.formatMessage(level, message);
    fs.appendFileSync(this.logFile, formattedMessage);
    console.log(formattedMessage.trim());
  }

  info(message: string): void {
    this.writeLog("INFO", message);
  }

  error(message: string): void {
    this.writeLog("ERROR", message);
  }

  warn(message: string): void {
    this.writeLog("WARN", message);
  }

  debug(message: string): void {
    if (this.level === "DEBUG") {
      this.writeLog("DEBUG", message);
    }
  }

  setLevel(level: string): void {
    this.level = level;
  }
}

export function createFileLogger(
  name: string,
  logFilename: string,
  version?: string
): Logger {
  return new FileLogger(name, logFilename, version);
}
