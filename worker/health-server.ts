import express from 'express';
import { Logger } from './utils';
import { getHealthCheckData } from '../scripts/healthcheck';

export interface AgentServerConfig {
  port: number;
  logger: Logger;
}

export class AgentServer {
  private app: express.Application;
  private server?: any;
  private logger: Logger;
  private port: number;

  constructor(config: AgentServerConfig) {
    this.app = express();
    this.logger = config.logger;
    this.port = config.port;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.get('/health', async (req, res) => {
      try {
        this.logger.info('Health check endpoint called');
        const healthResult = await getHealthCheckData();
        res.json(healthResult);
      } catch (error) {
        this.logger.error(`Health check failed: ${error}`);
        res.status(500).json({ 
          status: 'error', 
          message: 'Health check failed',
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    this.app.get('/ping', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          this.logger.info(`Health server started on port ${this.port}`);
          resolve();
        });
        
        this.server.on('error', (error: any) => {
          this.logger.error(`Health server error: ${error}`);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.logger.info('Health server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
