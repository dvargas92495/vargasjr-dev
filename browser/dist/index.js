"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const browser_1 = require("./routes/browser");
const BrowserManager_1 = require("./services/BrowserManager");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const browserManager = new BrowserManager_1.BrowserManager();
app.use('/api/browser', (0, browser_1.browserRoutes)(browserManager));
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
async function startServer() {
    try {
        await browserManager.initialize();
        app.listen(PORT, () => {
            console.log(`Browser service running on port ${PORT}`);
        });
    }
    catch (error) {
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
//# sourceMappingURL=index.js.map