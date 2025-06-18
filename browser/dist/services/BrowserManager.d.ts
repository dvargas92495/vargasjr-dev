import { BrowserContext, Page } from 'playwright';
export interface BrowserSession {
    id: string;
    context: BrowserContext;
    pages: Map<string, Page>;
    createdAt: Date;
    lastUsed: Date;
}
export declare class BrowserManager {
    private browser;
    private sessions;
    private cleanupInterval;
    initialize(): Promise<void>;
    createSession(sessionId?: string): Promise<string>;
    getSession(sessionId: string): Promise<BrowserSession | null>;
    createPage(sessionId: string, pageId?: string): Promise<string>;
    getPage(sessionId: string, pageId: string): Promise<Page | null>;
    closeSession(sessionId: string): Promise<void>;
    closePage(sessionId: string, pageId: string): Promise<void>;
    cleanup(): Promise<void>;
    private cleanupExpiredSessions;
    private generateSessionId;
    private generatePageId;
    getSessions(): BrowserSession[];
}
//# sourceMappingURL=BrowserManager.d.ts.map