# Browser Service

Express server with Playwright integration for browser automation and manipulation.

## Features

- **Session Management**: Create and manage multiple browser sessions
- **Page Control**: Navigate, click, type, and take screenshots
- **RESTful API**: Clean HTTP endpoints for browser automation
- **Automatic Cleanup**: Sessions expire after 30 minutes of inactivity
- **TypeScript**: Full type safety and IntelliSense support

## API Endpoints

### Sessions

- `POST /api/browser/sessions` - Create a new browser session
- `GET /api/browser/sessions` - List all active sessions
- `DELETE /api/browser/sessions/:sessionId` - Close a browser session

### Pages

- `POST /api/browser/sessions/:sessionId/pages` - Create a new page in session
- `DELETE /api/browser/sessions/:sessionId/pages/:pageId` - Close a page

### Browser Actions

- `POST /api/browser/sessions/:sessionId/pages/:pageId/navigate` - Navigate to URL
- `POST /api/browser/sessions/:sessionId/pages/:pageId/screenshot` - Take screenshot
- `POST /api/browser/sessions/:sessionId/pages/:pageId/click` - Click element
- `POST /api/browser/sessions/:sessionId/pages/:pageId/type` - Type text
- `GET /api/browser/sessions/:sessionId/pages/:pageId/content` - Get page content

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run browser:dev

# Build for production
npm run browser:build

# Start production server
npm run browser:start
```

## Usage Example

```javascript
// Create a session
const sessionResponse = await fetch('/api/browser/sessions', {
  method: 'POST'
});
const { sessionId } = await sessionResponse.json();

// Create a page
const pageResponse = await fetch(`/api/browser/sessions/${sessionId}/pages`, {
  method: 'POST'
});
const { pageId } = await pageResponse.json();

// Navigate to a website
await fetch(`/api/browser/sessions/${sessionId}/pages/${pageId}/navigate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://example.com' })
});

// Take a screenshot
const screenshot = await fetch(`/api/browser/sessions/${sessionId}/pages/${pageId}/screenshot`, {
  method: 'POST'
});
```
