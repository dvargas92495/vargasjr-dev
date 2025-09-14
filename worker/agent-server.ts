import express from "express";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { Logger } from "./utils";
import { getHealthCheckData } from "../server/health-check";
import { rebootAgent } from "./reboot-manager";

export interface BrowserSession {
  id: string;
  context: BrowserContext;
  pages: Map<string, Page>;
  createdAt: Date;
  lastUsed: Date;
}

export interface AgentServerConfig {
  port: number;
  logger: Logger;
}

export class AgentServer {
  private app: express.Application;
  private server?: any;
  private logger: Logger;
  private port: number;
  private browser: Browser | null = null;
  private sessions: Map<string, BrowserSession> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: AgentServerConfig) {
    this.app = express();
    this.logger = config.logger;
    this.port = config.port;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.use(express.json());

    const authMiddleware = (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
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

      next();
    };

    this.app.post(
      "/api/browser/sessions",
      authMiddleware,
      async (req: express.Request, res: express.Response) => {
        try {
          const { sessionId } = req.body;
          const id = await this.createSession(sessionId);
          res.json({ sessionId: id });
        } catch (error) {
          res.status(500).json({ error: (error as Error).message });
        }
      }
    );

    this.app.get(
      "/api/browser/sessions",
      authMiddleware,
      async (req: express.Request, res: express.Response) => {
        try {
          const sessions = this.getSessions().map((session) => ({
            id: session.id,
            createdAt: session.createdAt,
            lastUsed: session.lastUsed,
            pageCount: session.pages.size,
          }));
          res.json({ sessions });
        } catch (error) {
          res.status(500).json({ error: (error as Error).message });
        }
      }
    );

    this.app.delete(
      "/api/browser/sessions/:sessionId",
      authMiddleware,
      async (req: express.Request, res: express.Response) => {
        try {
          const { sessionId } = req.params;
          await this.closeSession(sessionId);
          res.json({ success: true });
        } catch (error) {
          res.status(500).json({ error: (error as Error).message });
        }
      }
    );

    this.app.post(
      "/api/browser/sessions/:sessionId/pages",
      authMiddleware,
      async (req: express.Request, res: express.Response) => {
        try {
          const { sessionId } = req.params;
          const { pageId } = req.body;
          const id = await this.createPage(sessionId, pageId);
          res.json({ pageId: id });
        } catch (error) {
          res.status(500).json({ error: (error as Error).message });
        }
      }
    );

    this.app.post(
      "/api/browser/sessions/:sessionId/pages/:pageId/navigate",
      authMiddleware,
      async (req: express.Request, res: express.Response) => {
        try {
          const { sessionId, pageId } = req.params;
          const { url } = req.body;

          const page = await this.getPage(sessionId, pageId);
          if (!page) {
            return res.status(404).json({ error: "Page not found" });
          }

          await page.goto(url);
          res.json({ success: true, url });
        } catch (error) {
          res.status(500).json({ error: (error as Error).message });
        }
      }
    );

    this.app.post(
      "/api/browser/sessions/:sessionId/pages/:pageId/screenshot",
      authMiddleware,
      async (req: express.Request, res: express.Response) => {
        try {
          const { sessionId, pageId } = req.params;
          const { fullPage = false } = req.body;

          const page = await this.getPage(sessionId, pageId);
          if (!page) {
            return res.status(404).json({ error: "Page not found" });
          }

          const screenshot = await page.screenshot({
            fullPage,
            type: "png",
          });

          res.set("Content-Type", "image/png");
          res.send(screenshot);
        } catch (error) {
          res.status(500).json({ error: (error as Error).message });
        }
      }
    );

    this.app.post(
      "/api/browser/sessions/:sessionId/pages/:pageId/click",
      authMiddleware,
      async (req: express.Request, res: express.Response) => {
        try {
          const { sessionId, pageId } = req.params;
          const { selector } = req.body;

          const page = await this.getPage(sessionId, pageId);
          if (!page) {
            return res.status(404).json({ error: "Page not found" });
          }

          await page.click(selector);
          res.json({ success: true });
        } catch (error) {
          res.status(500).json({ error: (error as Error).message });
        }
      }
    );

    this.app.post(
      "/api/browser/sessions/:sessionId/pages/:pageId/type",
      authMiddleware,
      async (req: express.Request, res: express.Response) => {
        try {
          const { sessionId, pageId } = req.params;
          const { selector, text } = req.body;

          const page = await this.getPage(sessionId, pageId);
          if (!page) {
            return res.status(404).json({ error: "Page not found" });
          }

          await page.fill(selector, text);
          res.json({ success: true });
        } catch (error) {
          res.status(500).json({ error: (error as Error).message });
        }
      }
    );

    this.app.get(
      "/api/browser/sessions/:sessionId/pages/:pageId/content",
      authMiddleware,
      async (req: express.Request, res: express.Response) => {
        try {
          const { sessionId, pageId } = req.params;

          const page = await this.getPage(sessionId, pageId);
          if (!page) {
            return res.status(404).json({ error: "Page not found" });
          }

          const content = await page.content();
          const title = await page.title();
          const url = page.url();

          res.json({ content, title, url });
        } catch (error) {
          res.status(500).json({ error: (error as Error).message });
        }
      }
    );

    this.app.delete(
      "/api/browser/sessions/:sessionId/pages/:pageId",
      authMiddleware,
      async (req: express.Request, res: express.Response) => {
        try {
          const { sessionId, pageId } = req.params;
          await this.closePage(sessionId, pageId);
          res.json({ success: true });
        } catch (error) {
          res.status(500).json({ error: (error as Error).message });
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

    this.app.post(
      "/api/reboot",
      authMiddleware,
      async (req: express.Request, res: express.Response) => {
        try {
          this.logger.info("Reboot endpoint called");
          const result = await rebootAgent(undefined, this.logger);

          if (result.success) {
            res.json({
              status: "success",
              message: "Agent reboot initiated",
              timestamp: new Date().toISOString(),
            });
          } else {
            res.status(500).json({
              status: "error",
              message: result.error || "Failed to initiate reboot",
              timestamp: new Date().toISOString(),
            });
          }
        } catch (error) {
          this.logger.error(`Reboot failed: ${error}`);
          res.status(500).json({
            status: "error",
            message: "Reboot failed",
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          });
        }
      }
    );

    this.app.get("/ping", (req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });
  }

  public async start(): Promise<void> {
    if (process.env.ENABLE_BROWSER) {
      this.browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      this.cleanupInterval = setInterval(() => {
        this.cleanupExpiredSessions();
      }, 5 * 60 * 1000);
    }

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

  public async stop(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const [sessionId] of this.sessions) {
      await this.closeSession(sessionId);
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

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

  async createSession(sessionId?: string): Promise<string> {
    if (!this.browser) {
      throw new Error("Browser not initialized");
    }

    const id = sessionId || this.generateSessionId();
    const context = await this.browser.newContext();

    const session: BrowserSession = {
      id,
      context,
      pages: new Map(),
      createdAt: new Date(),
      lastUsed: new Date(),
    };

    this.sessions.set(id, session);
    console.log(`Created browser session: ${id}`);

    return id;
  }

  async getSession(sessionId: string): Promise<BrowserSession | null> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastUsed = new Date();
    }
    return session || null;
  }

  async createPage(sessionId: string, pageId?: string): Promise<string> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const id = pageId || this.generatePageId();
    const page = await session.context.newPage();
    session.pages.set(id, page);

    console.log(`Created page ${id} in session ${sessionId}`);
    return id;
  }

  async getPage(sessionId: string, pageId: string): Promise<Page | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    return session.pages.get(pageId) || null;
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.context.close();
      this.sessions.delete(sessionId);
      console.log(`Closed browser session: ${sessionId}`);
    }
  }

  async closePage(sessionId: string, pageId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      const page = session.pages.get(pageId);
      if (page) {
        await page.close();
        session.pages.delete(pageId);
        console.log(`Closed page ${pageId} in session ${sessionId}`);
      }
    }
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    const maxAge = 30 * 60 * 1000;

    for (const [sessionId, session] of this.sessions) {
      if (now.getTime() - session.lastUsed.getTime() > maxAge) {
        this.closeSession(sessionId);
      }
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePageId(): string {
    return `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getSessions(): BrowserSession[] {
    return Array.from(this.sessions.values());
  }
}
