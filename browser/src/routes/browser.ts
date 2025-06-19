import { Router, Request, Response } from 'express';
import { BrowserManager } from '../services/BrowserManager';

export function browserRoutes(browserManager: BrowserManager): Router {
  const router = Router();

  router.post('/sessions', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      const id = await browserManager.createSession(sessionId);
      res.json({ sessionId: id });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.get('/sessions', async (req: Request, res: Response) => {
    try {
      const sessions = browserManager.getSessions().map(session => ({
        id: session.id,
        createdAt: session.createdAt,
        lastUsed: session.lastUsed,
        pageCount: session.pages.size
      }));
      res.json({ sessions });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      await browserManager.closeSession(sessionId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.post('/sessions/:sessionId/pages', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { pageId } = req.body;
      const id = await browserManager.createPage(sessionId, pageId);
      res.json({ pageId: id });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.post('/sessions/:sessionId/pages/:pageId/navigate', async (req: Request, res: Response) => {
    try {
      const { sessionId, pageId } = req.params;
      const { url } = req.body;
      
      const page = await browserManager.getPage(sessionId, pageId);
      if (!page) {
        return res.status(404).json({ error: 'Page not found' });
      }

      await page.goto(url);
      res.json({ success: true, url });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.post('/sessions/:sessionId/pages/:pageId/screenshot', async (req: Request, res: Response) => {
    try {
      const { sessionId, pageId } = req.params;
      const { fullPage = false } = req.body;
      
      const page = await browserManager.getPage(sessionId, pageId);
      if (!page) {
        return res.status(404).json({ error: 'Page not found' });
      }

      const screenshot = await page.screenshot({ 
        fullPage,
        type: 'png'
      });
      
      res.set('Content-Type', 'image/png');
      res.send(screenshot);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.post('/sessions/:sessionId/pages/:pageId/click', async (req: Request, res: Response) => {
    try {
      const { sessionId, pageId } = req.params;
      const { selector } = req.body;
      
      const page = await browserManager.getPage(sessionId, pageId);
      if (!page) {
        return res.status(404).json({ error: 'Page not found' });
      }

      await page.click(selector);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.post('/sessions/:sessionId/pages/:pageId/type', async (req: Request, res: Response) => {
    try {
      const { sessionId, pageId } = req.params;
      const { selector, text } = req.body;
      
      const page = await browserManager.getPage(sessionId, pageId);
      if (!page) {
        return res.status(404).json({ error: 'Page not found' });
      }

      await page.fill(selector, text);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.get('/sessions/:sessionId/pages/:pageId/content', async (req: Request, res: Response) => {
    try {
      const { sessionId, pageId } = req.params;
      
      const page = await browserManager.getPage(sessionId, pageId);
      if (!page) {
        return res.status(404).json({ error: 'Page not found' });
      }

      const content = await page.content();
      const title = await page.title();
      const url = page.url();
      
      res.json({ content, title, url });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.delete('/sessions/:sessionId/pages/:pageId', async (req: Request, res: Response) => {
    try {
      const { sessionId, pageId } = req.params;
      await browserManager.closePage(sessionId, pageId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}
