import express from "express";
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

  private setupRoutes(): void {
    this.app.use(express.json());

    this.app.use(
      "/api/browser",
      async (req: express.Request, res: express.Response) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return res.status(401).json({
            status: "error",
            message: "Authorization header required",
            timestamp: new Date().toISOString(),
          });
        }

        const token = authHeader.replace("Bearer ", "");
        if (token !== process.env.ADMIN_TOKEN) {
          return res.status(401).json({
            status: "error",
            message: "Invalid authorization token",
            timestamp: new Date().toISOString(),
          });
        }

        try {
          let body: string | undefined;
          if (
            req.body &&
            (req.method === "POST" ||
              req.method === "PUT" ||
              req.method === "PATCH")
          ) {
            body = JSON.stringify(req.body);
          }

          const targetPath = req.url.replace(/^\/api\/browser/, '');
          const browserPort = process.env.BROWSER_PORT || BROWSER_PORT;
          const targetUrl = `http://localhost:${browserPort}/api/browser${targetPath}`;
          const proxyResponse = await fetch(targetUrl, {
            method: req.method,
            headers: {
              ...req.headers,
              host: `localhost:${BROWSER_PORT}`,
            },
            body,
          });

          res.status(proxyResponse.status);

          proxyResponse.headers.forEach((value, key) => {
            res.set(key, value);
          });

          const responseBody = await proxyResponse.arrayBuffer();
          res.send(Buffer.from(responseBody));
        } catch (error) {
          this.logger.error(
            `Proxy request failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          res.status(502).json({
            status: "error",
            message: "Browser service unavailable",
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          });
        }
      }
    );

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
