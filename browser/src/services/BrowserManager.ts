import { chromium, Browser, BrowserContext, Page } from 'playwright';

export interface BrowserSession {
  id: string;
  context: BrowserContext;
  pages: Map<string, Page>;
  createdAt: Date;
  lastUsed: Date;
}

export class BrowserManager {
  private browser: Browser | null = null;
  private sessions: Map<string, BrowserSession> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000); // Cleanup every 5 minutes

    console.log('Browser manager initialized');
  }

  async createSession(sessionId?: string): Promise<string> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const id = sessionId || this.generateSessionId();
    const context = await this.browser.newContext();
    
    const session: BrowserSession = {
      id,
      context,
      pages: new Map(),
      createdAt: new Date(),
      lastUsed: new Date()
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

  async cleanup(): Promise<void> {
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

    console.log('Browser manager cleaned up');
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    const maxAge = 30 * 60 * 1000; // 30 minutes

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
