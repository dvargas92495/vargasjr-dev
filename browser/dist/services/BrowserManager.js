"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserManager = void 0;
const playwright_1 = require("playwright");
class BrowserManager {
    constructor() {
        this.browser = null;
        this.sessions = new Map();
        this.cleanupInterval = null;
    }
    async initialize() {
        this.browser = await playwright_1.chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, 5 * 60 * 1000); // Cleanup every 5 minutes
        console.log('Browser manager initialized');
    }
    async createSession(sessionId) {
        if (!this.browser) {
            throw new Error('Browser not initialized');
        }
        const id = sessionId || this.generateSessionId();
        const context = await this.browser.newContext();
        const session = {
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
    async getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastUsed = new Date();
        }
        return session || null;
    }
    async createPage(sessionId, pageId) {
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
    async getPage(sessionId, pageId) {
        const session = await this.getSession(sessionId);
        if (!session) {
            return null;
        }
        return session.pages.get(pageId) || null;
    }
    async closeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            await session.context.close();
            this.sessions.delete(sessionId);
            console.log(`Closed browser session: ${sessionId}`);
        }
    }
    async closePage(sessionId, pageId) {
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
    async cleanup() {
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
    cleanupExpiredSessions() {
        const now = new Date();
        const maxAge = 30 * 60 * 1000; // 30 minutes
        for (const [sessionId, session] of this.sessions) {
            if (now.getTime() - session.lastUsed.getTime() > maxAge) {
                this.closeSession(sessionId);
            }
        }
    }
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generatePageId() {
        return `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    getSessions() {
        return Array.from(this.sessions.values());
    }
}
exports.BrowserManager = BrowserManager;
//# sourceMappingURL=BrowserManager.js.map