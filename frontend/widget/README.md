# CSAI Chat Widget

Embeddable AI customer service chat widget for websites.

## Quick Start

### Development

1. Start the backend API (from project root):
   ```bash
   cd backend
   npm start
   ```

2. Start the widget dev server (from widget directory):
   ```bash
   cd frontend/widget
   npm run dev
   ```

3. Open http://localhost:3001 in your browser to see the demo

### Production Build

```bash
npm run build
```

This creates a single bundled file at `dist/widget.js` that can be deployed.

## Usage

Add this script tag to any HTML page:

```html
<script src="http://localhost:3001/widget.js"
        data-api-key="bobs_pizza_api_key_123"
        data-api-url="http://localhost:3000"
        data-position="bottom-right"
        data-primary-color="#667eea"
        data-title="Chat Support"
        data-subtitle="We typically reply instantly"
        data-greeting="Hi! How can I help you today?">
</script>
```

### Configuration Options

All configuration is done via `data-*` attributes on the script tag:

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `data-api-key` | ✅ Yes | - | Your API key (from `clients` table) |
| `data-api-url` | No | `http://localhost:3000` | Backend API URL |
| `data-position` | No | `bottom-right` | Widget position: `bottom-right`, `bottom-left`, `top-right`, `top-left` |
| `data-primary-color` | No | `#0066cc` | Primary theme color (hex) |
| `data-title` | No | `Chat Support` | Header title |
| `data-subtitle` | No | `We typically reply instantly` | Header subtitle |
| `data-greeting` | No | `Hi! How can I help you today?` | Greeting message shown in empty state |

### JavaScript API

The widget instance is exposed globally as `window.CSAIWidget`:

```javascript
// Open the widget
window.CSAIWidget.open();

// Close the widget
window.CSAIWidget.close();

// Clear conversation history
window.CSAIWidget.clearHistory();

// Destroy the widget
window.CSAIWidget.destroy();
```

## Features

- ✅ AI-powered conversations using Ollama/Claude/OpenAI
- ✅ Tool execution via n8n webhooks
- ✅ Persistent conversation history (localStorage + API)
- ✅ Unread message counter
- ✅ Typing indicators and loading states
- ✅ Error handling with retry
- ✅ Mobile responsive (full-screen on mobile)
- ✅ Shadow DOM for CSS isolation
- ✅ Customizable colors and position
- ✅ Lightweight (<100KB bundled)

## Architecture

```
src/
├── index.js              # Entry point - auto-initialization
├── widget.js             # Main widget class
├── api.js                # API client for backend communication
├── storage.js            # localStorage wrapper
├── styles.css            # Widget styles (injected into Shadow DOM)
└── components/
    ├── bubble.js         # Chat bubble button
    ├── window.js         # Chat window container
    ├── messages.js       # Message list component
    └── input.js          # Input field with send button
```

### Shadow DOM

The widget uses Shadow DOM to encapsulate styles and prevent CSS conflicts with the host page. All styles are scoped to the widget's shadow root.

### Session Management

- Each browser gets a unique `sessionId` stored in localStorage
- Session persists across page reloads
- Conversation history is stored both locally (last 20 messages) and on the server
- The widget automatically loads history on initialization

## Testing

Try these sample queries on the demo page:

- "What's the status of order #12345?"
- "I'd like to book an appointment for tomorrow at 2pm"
- "Do you have pepperoni pizza in stock?"
- "What are your business hours?"

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Development Notes

- Built with Vite for fast dev server and optimized builds
- Pure vanilla JavaScript (no framework dependencies)
- ES6+ modules
- CSS Variables for theming
- Responsive design with mobile-first approach

## Production Deployment

1. Build the widget:
   ```bash
   npm run build
   ```

2. Deploy `dist/widget.js` to your CDN or static hosting

3. Update the script tag to point to your deployed URL:
   ```html
   <script src="https://your-cdn.com/widget.js"
           data-api-key="your_api_key"
           data-api-url="https://your-api.com">
   </script>
   ```

## Troubleshooting

### Widget doesn't appear
- Check browser console for errors
- Verify the script tag has `data-api-key` attribute
- Ensure the backend API is running

### Messages don't send
- Check that `data-api-url` points to the correct backend
- Verify the API key is valid in the `clients` table
- Check network tab for failed requests

### Styles look broken
- The widget uses Shadow DOM, so host page styles shouldn't affect it
- If styles are missing, ensure the CSS is being bundled correctly

### Conversation history doesn't persist
- Check if localStorage is enabled in the browser
- Verify the backend `/chat/history/:sessionId` endpoint is working
- Check browser storage limits (localStorage has ~5MB limit per domain)

## License

Part of the CSAI (Customer Service AI) Platform
