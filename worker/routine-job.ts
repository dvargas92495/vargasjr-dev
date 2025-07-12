import { Logger } from './utils';
import { VellumClient } from 'vellum-ai';

export class RoutineJob {
  private name: string;
  private logger: Logger;
  private lastRun: Date | null = null;
  private minute: string;
  private hour: string;
  private day: string;
  private month: string;
  private weekday: string;

  constructor(name: string, cronExpression: string, logger: Logger) {
    this.name = name;
    this.logger = logger;

    const cronParts = cronExpression.split(' ');
    if (cronParts.length !== 5) {
      throw new Error('Invalid cron expression');
    }

    this.minute = cronParts[0];
    this.hour = cronParts[1];
    this.day = cronParts[2];
    this.month = cronParts[3];
    this.weekday = cronParts[4];
  }

  shouldRun(): boolean {
    const now = new Date();

    if (this.lastRun === null || (now.getTime() - this.lastRun.getTime()) > 60000) {
      if (this.matchesSchedule(now)) {
        this.lastRun = now;
        return true;
      }
    }

    return false;
  }

  private matchesSchedule(dt: Date): boolean {
    if (!this.matchesField(dt.getMinutes(), this.minute)) {
      return false;
    }

    if (!this.matchesField(dt.getHours(), this.hour)) {
      return false;
    }

    if (!this.matchesField(dt.getDate(), this.day)) {
      return false;
    }

    if (!this.matchesField(dt.getMonth() + 1, this.month)) {
      return false;
    }

    if (!this.matchesField(dt.getDay(), this.weekday)) {
      return false;
    }

    return true;
  }

  private matchesField(value: number, pattern: string): boolean {
    if (pattern === '*') {
      return true;
    }

    if (pattern.includes(',')) {
      return pattern.split(',').includes(value.toString());
    }

    if (pattern.includes('-')) {
      const [start, end] = pattern.split('-').map(Number);
      return start <= value && value <= end;
    }

    return parseInt(pattern) === value;
  }

  getName(): string {
    return this.name;
  }

  async run(): Promise<void> {
    this.logger.info(`Running Routine Job ${this.name}`);
    
    try {
      const apiKey = process.env.VELLUM_API_KEY;
      if (!apiKey) {
        throw new Error('VELLUM_API_KEY environment variable is required');
      }

      const vellumClient = new VellumClient({
        apiKey: apiKey,
      });

      const stream = await vellumClient.executeWorkflowStream({
        workflowDeploymentName: this.name,
        inputs: [],
      });

      for await (const event of stream) {
        if (event.type === 'WORKFLOW') {
          this.logger.info(`Workflow ${this.name} event: ${event.data.state}`);
          if (event.data.error) {
            this.logger.error(`Workflow ${this.name} error: ${event.data.error.message}`);
          }
        }
      }

      this.logger.info(`Completed Routine Job ${this.name}`);
    } catch (error) {
      this.logger.error(`Failed to execute workflow ${this.name}: ${error}`);
    }
  }
}
