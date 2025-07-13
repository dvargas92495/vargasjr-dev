import { EventEmitter } from 'events';
import * as dotenv from 'dotenv';
import { createFileLogger, getVersion, Logger } from './utils';
import { postgresSession } from './database';
import { RoutineJob } from './routine-job';
import { checkAndRebootIfNeeded } from './reboot-manager';
import { RoutineJobsTable } from '../db/schema';
import { eq } from 'drizzle-orm';

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
  private lastUpdated: Date;
  private updateInterval: number;
  private routineJobs: RoutineJob[] = [];
  private mainInterval?: NodeJS.Timeout;

  constructor(config: AgentRunnerConfig = {}) {
    dotenv.config();
    this.currentVersion = getVersion();
    this.logger = config.logger || createFileLogger('AgentRunner', 'agent.log', this.currentVersion);
    
    const logLevel = process.env.LOG_LEVEL;
    if (logLevel) {
      this.logger.setLevel(logLevel);
    }

    this.cancelSignal = config.cancelSignal || new EventEmitter();
    this.sleepTime = (config.sleepTime || 0.01) * 1000;
    this.maxLoops = config.maxLoops;
    this.lastUpdated = new Date();
    this.updateInterval = 60000;

    this.loadRoutineJobs().then(jobs => {
      this.routineJobs = jobs;
    }).catch(error => {
      this.logger.error(`Failed to load routine jobs during initialization: ${error}`);
      this.routineJobs = [];
    });

    this.logger.info(`Initialized agent v${this.currentVersion}`);
  }

  public run(): void {
    this.mainThread();
  }

  private mainThread(): void {
    let loops = 0;
    
    const runLoop = () => {
      if (!this.shouldRun()) {
        return;
      }

      this.logger.info('Running...');

      setTimeout(() => {
        loops++;
        if (this.maxLoops && loops >= this.maxLoops) {
          this.logger.info('Max loops reached, stopping...');
          this.cancelSignal.emit('cancel');
          return;
        }

        for (const job of this.routineJobs) {
          if (job.shouldRun()) {
            job.run().then(outputs => {
              if (outputs) {
                this.logger.info(`Routine job ${job.getName()} completed with outputs: ${JSON.stringify(outputs)}`);
              }
            }).catch(error => {
              this.logger.error(`Routine job ${job.getName()} failed: ${error}`);
            });
            break;
          }
        }

        if (Date.now() - this.lastUpdated.getTime() > this.updateInterval) {
          this.logger.info('Checking for updates...');
          this.lastUpdated = new Date();
          
          try {
            this.checkAndRebootIfNeeded();
          } catch (error) {
            this.logger.error(`Failed to check for updates: ${error}`);
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
    return this.cancelSignal.listenerCount('cancel') === 0;
  }

  private async loadRoutineJobs(): Promise<RoutineJob[]> {
    try {
      const db = postgresSession();
      const routineJobs = await db.select().from(RoutineJobsTable).where(eq(RoutineJobsTable.enabled, true));
      return routineJobs.map((job: any) => new RoutineJob(job.name, job.cronExpression, this.logger));
    } catch (error) {
      this.logger.error(`Failed to load routine jobs: ${error}`);
      return [];
    }
  }

  private checkAndRebootIfNeeded(): void {
    checkAndRebootIfNeeded(this.logger);
  }
}
