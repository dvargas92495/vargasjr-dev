import express from "express";
import http from "http";
import { Logger } from "./utils";
import { getHealthCheckData } from "../server/health-check";
import { BROWSER_PORT } from "../server/constants";

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

  private createProxyHandler(targetPort: number) {
    return (req: express.Request, res: express.Response) => {
      const options = {
        hostname: 'localhost',
        port: targetPort,
        path: req.url,
        method: req.method,
        headers: {
          ...req.headers,
          host: `localhost:${targetPort}`
        }
      };

      const proxyReq = http.request(options, (proxyRes) => {
        res.status(proxyRes.statusCode || 500);
        Object.keys(proxyRes.headers).forEach(key => {
          const value = proxyRes.headers[key];
          if (value) {
            res.set(key, Array.isArray(value) ? value.join(', ') : value);
          }
        });

        proxyRes.pipe(res);
      });

      proxyReq.on('error', (error) => {
        this.logger.error(`Proxy request failed: ${error.message}`);
        if (!res.headersSent) {
          res.status(502).json({
            status: "error",
            message: "Browser service unavailable",
            error: error.message,
            timestamp: new Date().toISOString(),
          });
        }
      });

      if (req.body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
        proxyReq.write(JSON.stringify(req.body));
      }

      proxyReq.end();
    };
  }

  private setupRoutes(): void {
    this.app.use(express.json());

    this.app.use("/api/browser", this.createProxyHandler(BROWSER_PORT));

    this.app.get("/health", async (req, res) => {
      try {
        this.logger.info("Health check endpoint called");
        const healthResult = await getHealthCheckData();
        res.json(healthResult);
      } catch (error) {
        this.logger.error(`Health check failed: ${error}`);
        res.status(500).json({
          status: "error",
          message: "Health check failed",
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
      }
    });

    this.app.get("/ping", (req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          this.logger.info(`Health server started on port ${this.port}`);
          resolve();
        });

        this.server.on("error", (error: any) => {
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
          this.logger.info("Health server stopped");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
