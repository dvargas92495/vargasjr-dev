import { EventEmitter } from "events";
import * as dotenv from "dotenv";
import { createFileLogger, Logger } from "./utils";
import { getVersion } from "@/server/versioning";
import { postgresSession } from "./database";
import { RoutineJob } from "./routine-job";
import { RoutineJobsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AgentServer } from "./agent-server";
import { AGENT_SERVER_PORT } from "@/server/constants";

dotenv.config();

export interface AgentRunnerConfig {
  cancelSignal?: EventEmitter;
  logger?: Logger;
  sleepTime?: number;
  maxLoops?: number;
}

export class AgentRunner {
  private currentVersion: string;
  private logger: Logger;
  private cancelSignal: EventEmitter;
  private sleepTime: number;
  private maxLoops?: number;
  private routineJobs: RoutineJob[] = [];
  private mainInterval?: NodeJS.Timeout;
  private agentServer?: AgentServer;

  constructor(config: AgentRunnerConfig = {}) {
    console.log("Initializing the agent...");
    dotenv.config();
    this.currentVersion = getVersion();
    this.logger =
      config.logger ||
      createFileLogger("AgentRunner", "agent.log", this.currentVersion);

    console.log("Initialized the logger");
    const logLevel = process.env.LOG_LEVEL;
    if (logLevel) {
      this.logger.setLevel(logLevel);
    }

    this.cancelSignal = config.cancelSignal || new EventEmitter();
    this.sleepTime = (config.sleepTime || 0.01) * 1000;
    this.maxLoops = config.maxLoops;

    this.loadRoutineJobs()
      .then((jobs) => {
        this.routineJobs = jobs;
        this.logger.info(
          `Initialized ${jobs.length} scheduled job${
            jobs.length === 1 ? "" : "s"
          }`
        );
      })
      .catch((error) => {
        this.logger.error(
          `Failed to load routine jobs during initialization: ${error}`
        );
        this.routineJobs = [];
      });

    this.logger.info(`Initialized agent v${this.currentVersion}`);

    const healthPort = parseInt(
      process.env.AGENT_SERVER_PORT || AGENT_SERVER_PORT.toString(),
      10
    );
    this.agentServer = new AgentServer({
      port: healthPort,
      logger: this.logger,
      agentRunner: this,
    });
  }

  public async run(): Promise<void> {
    try {
      await this.agentServer?.start();
      this.logger.info("Agent server started successfully");
    } catch (error) {
      this.logger.error(`Failed to start agent server: ${error}`);
    }

    this.mainThread();
  }

  private mainThread(): void {
    let loops = 0;

    const runLoop = () => {
      if (!this.shouldRun()) {
        return;
      }

      setTimeout(() => {
        loops++;
        if (this.maxLoops && loops >= this.maxLoops) {
          this.logger.info("Max loops reached, stopping...");
          this.cancelSignal.emit("cancel");
          return;
        }

        for (const job of this.routineJobs) {
          if (job.shouldRun()) {
            job
              .run()
              .then((result) => {
                const { outputs, executionId } = result || {};
                if (outputs) {
                  this.logger.info(
                    `Routine job ${job.getName()} completed with outputs: ${JSON.stringify(
                      outputs
                    )} (execution ID: ${executionId || "unknown"})`
                  );
                }
              })
              .catch((error) => {
                this.logger.error(
                  `Routine job ${job.getName()} failed: ${error}`
                );
              });
            break;
          }
        }

        if (this.shouldRun()) {
          setTimeout(runLoop, this.sleepTime);
        }
      }, this.sleepTime);
    };

    runLoop();
  }

  private shouldRun(): boolean {
    return this.cancelSignal.listenerCount("cancel") === 0;
  }

  private async loadRoutineJobs(): Promise<RoutineJob[]> {
    try {
      const db = postgresSession();
      const routineJobs = await db
        .select()
        .from(RoutineJobsTable)
        .where(eq(RoutineJobsTable.enabled, true));
      return routineJobs.map(
        (job: any) => new RoutineJob(job.name, job.cronExpression, this.logger)
      );
    } catch (error) {
      this.logger.error(`Failed to load routine jobs: ${error}`);
      return [];
    }
  }

  public async reloadRoutineJobs(): Promise<void> {
    this.logger.info("Reloading routine jobs...");
    try {
      const jobs = await this.loadRoutineJobs();
      this.routineJobs = jobs;
      this.logger.info(
        `Successfully reloaded ${jobs.length} scheduled job${
          jobs.length === 1 ? "" : "s"
        }`
      );
    } catch (error) {
      this.logger.error(`Failed to reload routine jobs: ${error}`);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    this.logger.info("Stopping AgentRunner...");

    if (this.mainInterval) {
      clearTimeout(this.mainInterval);
    }

    this.cancelSignal.emit("cancel");

    try {
      await this.agentServer?.stop();
    } catch (error) {
      this.logger.error(`Error stopping agent server: ${error}`);
    }

    this.logger.info("AgentRunner stopped");
  }
}
