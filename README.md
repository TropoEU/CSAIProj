# CSAI - AI Customer Service Agent Platform

<div align="center">

**A plug-and-play AI customer service widget for business websites**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-red.svg)](https://redis.io/)
[![n8n](https://img.shields.io/badge/n8n-Latest-orange.svg)](https://n8n.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Features](#-features) • [Quick Start](#-quick-start) • [Architecture](#-architecture) • [Documentation](#-documentation)

</div>

---

## 🎯 What is CSAI?

CSAI is a **multi-tenant AI customer service platform** that provides businesses with an intelligent chat widget for their websites. The AI agent can:

- 💬 **Answer questions** about products, services, and policies
- 🔍 **Check orders, bookings, and inventory** in real-time
- ⚡ **Perform actions** like refunds, bookings, CRM updates, and more
- 🌍 **Support multiple languages** (English, Hebrew, and more)
- 🔌 **Integrate with any system** via n8n workflows (Shopify, Gmail, Google Sheets, CRMs, etc.)

**Works on ANY platform**: Wix, Shopify, WordPress, or custom HTML — **zero developer involvement required on the client side**.

---

## ✨ Features

### Core Capabilities

- 🤖 **Intelligent AI Agent** - Powered by OpenAI GPT-4, Claude, or private models (Ollama) for natural conversations
- 🛠️ **Tool Execution System** - Execute real actions via n8n webhooks
- 🎨 **Customizable Widget** - White-label chat widget with visual editor (14 color options, embed code generator, live preview)
- 📊 **Admin Dashboard** - Complete management interface for clients, tools, integrations, and billing
- 💰 **Billing Infrastructure** - Invoice generation, usage tracking, and plan management
- 🔐 **Multi-tenant Architecture** - Isolated data and configurations per client
- 📈 **Analytics & Monitoring** - Track conversations, tool usage, API consumption, and revenue
- 🔄 **Real-time Integrations** - Connect to Shopify, Gmail, CRMs, databases, and more
- 🌐 **Multi-language Support** - Hebrew and English support out of the box (Hebrew in progress)
- 🔒 **Private Model Support** - Use Ollama for local/private LLM deployments

### Technical Features

- 🐳 **Dockerized Services** - PostgreSQL, Redis, and n8n in containers
- 🗄️ **PostgreSQL Database** - Robust schema with migrations
- ⚡ **Redis Caching** - Conversation context, rate limiting, and response caching
- 🔌 **n8n Workflows** - Visual workflow automation for integrations
- 🧪 **Comprehensive Testing** - Unit and integration tests
- 📝 **Database Migrations** - Version-controlled schema changes

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm/pnpm
- **Docker** and Docker Compose
- **Ollama** (optional, for local/private LLM testing) - running on `localhost:11434`
- **OpenAI API Key** or **Anthropic API Key** (for cloud LLM services)
- **OpenAI API Key** or **Anthropic API Key** (for cloud LLM services)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/CSAIProj.git
   cd CSAIProj
   ```

2. **Install dependencies**

   ```bash
   # Root dependencies (if any)
   npm install

   # Backend dependencies
   cd backend
   npm install

   # Frontend dependencies
   cd ../frontend/widget
   npm install

   cd ../admin
   npm install
   ```

3. **Configure environment variables**

   ```bash
   # Copy and edit the backend .env file
   cp backend/.env.example backend/.env
   # Edit backend/.env with your configuration
   ```

4. **Start Docker services**

   ```bash
   npm run dockerup
   ```

5. **Run database migrations**

   ```bash
   npm run migrate
   ```

6. **Start the backend server**

   ```bash
   npm start
   # or
   npm run backend
   ```

7. **Generate mock data (optional)**

   ```bash
   # Generate test clients, invoices, and usage data
   npm run mockdata

   # Add mock integrations (Shopify, WooCommerce, etc.)
   npm run mock:integrations
   ```

8. **Start the frontend (optional)**

   ```bash
   # Widget dev server (port 3001)
   npm run widget

   # Admin dashboard (port 3002)
   npm run admin
   ```

9. **Access the Admin Dashboard**

   - URL: http://localhost:3002
   - Username: `admin`
   - Password: `admin123`

### Verify Installation

Check that all services are running:

```bash
# Check service connectivity
npm run check:connections

# Check health endpoint
curl http://localhost:3000/health
```

Expected output:

```
✅ PostgreSQL: OK
✅ Redis: OK
✅ n8n: OK
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT WEBSITE                            │
│  <script src="https://yourdomain.com/widget.js"></script>    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              YOUR AI WIDGET (Chat Bubble)                    │
│         Vanilla JS + Vite + Shadow DOM                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              YOUR BACKEND (Node.js/Express)                  │
│  • Conversation Management                                   │
│  • LLM Integration (OpenAI/Claude/Ollama)                   │
│  • Tool Execution                                            │
│  • Rate Limiting & Caching                                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    LLM SERVICE                                │
│  • OpenAI GPT-4 / Claude 3.5 Sonnet (Cloud)                │
│  • Ollama (Local/Private Models)                            │
│  • Configurable per client                                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              TOOL MANAGER → n8n WORKFLOWS                     │
│  • Webhook Execution                                         │
│  • Per-client Workflows                                      │
│  • Integration with External Systems                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              EXTERNAL SYSTEMS                                │
│  Shopify • Gmail • Google Sheets • CRMs • Databases         │
└─────────────────────────────────────────────────────────────┘
```

### Why This Architecture?

- ✅ **No custom API code per client** - n8n handles integrations
- ✅ **Works with any platform** - Wix, Shopify, WordPress, custom HTML
- ✅ **Clean separation** - Backend stays small and maintainable
- ✅ **Fast onboarding** - New clients in ~1 hour
- ✅ **Scalable** - Multi-tenant architecture with isolated data
- ✅ **Flexible LLM options** - Support for cloud (OpenAI/Claude) and private models (Ollama)

---

## 📁 Project Structure

```
CSAIProj/
├── backend/                 # Node.js/Express backend
│   ├── src/
│   │   ├── controllers/    # Route handlers
│   │   ├── models/         # Database models (9 tables)
│   │   ├── routes/         # API routes (chat, tools, admin)
│   │   ├── services/       # Business logic (LLM, n8n, cache)
│   │   ├── middleware/     # Auth, rate limiting
│   │   ├── prompts/        # System prompt templates
│   │   └── scripts/        # Migration runner
│   ├── tests/              # Unit and integration tests
│   └── package.json
├── frontend/
│   ├── widget/             # Embeddable chat widget
│   │   ├── src/
│   │   │   ├── widget.js   # Main widget class
│   │   │   ├── api.js      # API client
│   │   │   └── components/ # UI components
│   │   └── vite.config.js
│   └── admin/              # Admin dashboard (React)
│       ├── src/
│       │   ├── pages/      # Dashboard pages
│       │   ├── components/ # Reusable components
│       │   └── services/   # API client
│       └── vite.config.js
├── db/
│   └── migrations/         # SQL migration files
├── docker/
│   ├── docker-compose.yml  # Container orchestration
│   └── init-n8n-schema.sql # n8n schema initialization
├── n8n-workflows/          # Demo n8n workflows
└── package.json            # Root package.json with scripts
```

---

## 🛠️ Development

### Available Scripts

#### Backend Server

```bash
npm start              # Start the Express backend server
npm run backend        # Alias for 'start'
```

#### Frontend Development

```bash
npm run widget         # Start widget dev server (port 3001)
npm run admin          # Start admin dashboard (port 3002)
```

#### Database Migrations

```bash
npm run migrate        # Apply all pending migrations
npm run migrate:down   # Rollback the last migration
npm run migrate:status # Show migration status
```

#### Docker Management

```bash
npm run dockerup       # Start containers (Postgres, Redis, n8n)
npm run dockerdown     # Stop containers (data persists)
npm run dockerclean    # Stop and remove containers (deletes data!)
```

#### Testing

```bash
npm test               # Run all integration tests
npm run test:models    # Run model tests
npm run test:redis     # Run Redis cache tests
npm run test:llm       # Run LLM service tests
npm run test:phase2    # Run Phase 2 integration test (conversation flow)
npm run test:phase3    # Run Phase 3 integration test (tool execution)
npm run test:phase6    # Run Phase 6 integration test (billing & analytics)
```

#### Mock Data Generation

```bash
npm run mockdata           # Generate mock clients, usage, and invoices
npm run mock:integrations  # Add mock integrations to clients
```

#### Connectivity Checks

```bash
npm run check:connections  # Check all service connections
npm run check:ollama      # Check Ollama connectivity
```

### Environment Variables

Key environment variables (see `backend/.env`):

```env
# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=aiuser
POSTGRES_PASSWORD=your_password
POSTGRES_DB=aiclient

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# n8n
N8N_HOST=localhost
N8N_PORT=5678
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your_password
WEBHOOK_URL=http://localhost:5678

# LLM Configuration
# Option 1: OpenAI (Cloud)
OPENAI_API_KEY=your_openai_key

# Option 2: Anthropic Claude (Cloud)
ANTHROPIC_API_KEY=your_anthropic_key

# Option 3: Ollama (Local/Private Models)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
# Use Ollama for local testing and private model deployments

# API
PORT=3000
NODE_ENV=development
```

### Database Schema

The platform uses PostgreSQL with the following core tables:

- **clients** - Multi-tenant client configuration
- **conversations** - Chat session tracking
- **messages** - Individual messages (30-day retention)
- **tools** - Master tool catalog
- **client_tools** - Client-to-tool mappings with webhook URLs
- **client_integrations** - Integration configurations
- **tool_executions** - Execution history and logging
- **api_usage** - Token usage and analytics
- **admins** - Admin user accounts

See `db/migrations/` for the complete schema.

---

## 📚 Documentation

- **[CLAUDE.md](CLAUDE.md)** - Comprehensive development guide and project documentation
- **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)** - Detailed implementation phases and roadmap
- **[n8n-workflows/README.md](n8n-workflows/README.md)** - n8n workflow setup and configuration

### API Endpoints

#### Chat API

- `POST /chat/message` - Send a message to the AI agent
- `GET /chat/history/:sessionId` - Get conversation history

#### Admin API

- `GET /admin/clients` - List all clients
- `POST /admin/clients` - Create a new client
- `GET /admin/tools` - List all tools
- `POST /admin/tools` - Create a new tool
- `GET /admin/stats/tools` - Get tool usage statistics
- `POST /admin/test-chat` - Test chat functionality

#### Health Check

- `GET /health` - Check service health (PostgreSQL, Redis, n8n)

See `backend/src/routes/` for complete API documentation.

---

## 🎨 Widget Integration

### Using the Admin Dashboard (Recommended)

The easiest way to configure and deploy the widget:

1. Go to **Admin Dashboard** → **Clients** → Select your client
2. Scroll to the **Widget Customization** section
3. Configure appearance (14 color options, position, text)
4. Click **Show Preview** to see changes
5. Click **Save Configuration**
6. Copy the generated embed code with one click
7. Paste into your website

### Basic Integration (Manual)

Alternatively, add this script tag to any HTML page:

```html
<script
  src="http://localhost:3001/widget.js"
  data-api-key="your_client_api_key"
  data-api-url="http://localhost:3000"
  data-position="bottom-right"
  data-primary-color="#667eea"
  data-title="Chat Support"
  data-subtitle="We typically reply instantly"
  data-greeting="Hi! How can I help you today?"
></script>
```

### Configuration Options

| Attribute            | Required | Default                         | Description                  |
| -------------------- | -------- | ------------------------------- | ---------------------------- |
| `data-api-key`       | ✅ Yes   | -                               | Client API key from database |
| `data-api-url`       | No       | `http://localhost:3000`         | Backend API URL              |
| `data-position`      | No       | `bottom-right`                  | Widget position              |
| `data-primary-color` | No       | `#0066cc`                       | Primary theme color (hex)    |
| `data-title`         | No       | `Chat Support`                  | Header title                 |
| `data-subtitle`      | No       | `We typically reply instantly`  | Header subtitle              |
| `data-greeting`      | No       | `Hi! How can I help you today?` | Empty state greeting         |

### JavaScript API

The widget instance is exposed globally:

```javascript
// Open the widget
window.CSAIWidget.open();

// Close the widget
window.CSAIWidget.close();

// Clear conversation history
window.CSAIWidget.clearHistory();
```

---

## 🔧 n8n Integration

n8n workflows handle all external system integrations. Each client can have custom workflows for:

- **Shopify** - Order status, inventory checks, refunds
- **Gmail** - Send emails, create tickets
- **Google Sheets** - Update spreadsheets, track data
- **CRMs** - Add leads, update contacts
- **Databases** - Query and update data
- **Custom APIs** - Any REST API integration

### Setting Up n8n Workflows

1. Import workflows from `n8n-workflows/` directory
2. Configure webhook URLs in the admin dashboard
3. Map tools to workflows in `client_tools` table
4. Test workflows using the admin dashboard

See [n8n-workflows/README.md](n8n-workflows/README.md) for detailed setup instructions.

---

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:models
npm run test:redis
npm run test:llm
npm run test:phase2
npm run test:phase3
```

### Test Coverage

- ✅ Database models (9 tables)
- ✅ Redis cache service
- ✅ LLM service integration
- ✅ Tool execution system
- ✅ Conversation flow (Phase 2)
- ✅ Full integration tests (Phase 3)

---

## 🚢 Deployment

### Backend Deployment

The backend can be deployed to:

- **Vercel** - Serverless functions
- **Railway** - Full-stack hosting
- **DigitalOcean** - App Platform
- **AWS/GCP/Azure** - Traditional VMs or containers

### Database Hosting

- **Supabase** - Managed PostgreSQL
- **Railway** - Managed PostgreSQL
- **AWS RDS** - Production-grade database

### Redis Hosting

- **Upstash** - Serverless Redis
- **Redis Cloud** - Managed Redis
- **Self-hosted** - Docker container

### n8n Hosting

- **Railway** - Easy deployment
- **Contabo VM** - Self-hosted
- **n8n Cloud** - Managed service

### Widget CDN

Build the widget and host on:

- **Cloudflare Pages**
- **Vercel**
- **Netlify**
- **AWS S3 + CloudFront**

---

## 📧 Support

For questions, issues, or feature requests, please open an issue on GitHub.

---

<div align="center">

**Made with ❤️ for businesses who want AI-powered customer service**

[⬆ Back to Top](#csai---ai-customer-service-agent-platform)

</div>
