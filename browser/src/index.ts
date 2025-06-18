import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { browserRoutes } from './routes/browser';
import { BrowserManager } from './services/BrowserManager';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());

const browserManager = new BrowserManager();

app.use('/api/browser', browserRoutes(browserManager));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function startServer() {
  try {
    await browserManager.initialize();
    
    app.listen(PORT, () => {
      console.log(`Browser service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await browserManager.cleanup();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await browserManager.cleanup();
  process.exit(0);
});

startServer();
