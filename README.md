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

CSAI is a **multi-tenant AI customer service platform** that provides businesses with an intelligent chat widget for their websites. The AI agent can answer questions, check orders/inventory, perform actions (refunds, bookings, CRM updates), and integrate with any system via n8n workflows.

**Works on ANY platform**: Wix, Shopify, WordPress, or custom HTML — **zero developer involvement required on the client side**.

---

## ✨ Features

- 🤖 **Intelligent AI Agent** - OpenAI GPT-4, Claude, or private models (Ollama)
- 🛠️ **Flexible Tool System** - Generic tools with client-specific integration mapping
- 🎨 **Customizable Widget** - White-label chat widget with visual editor
- 📊 **Admin Dashboard** - Complete management interface (port 3002)
- 👥 **Customer Dashboard** - Self-service portal for businesses (port 3003)
- 💰 **Billing & Analytics** - Invoice generation, usage tracking, plan management
- 🔐 **Multi-tenant Architecture** - Isolated data per client
- 🔄 **Real-time Integrations** - Connect to Shopify, Gmail, CRMs, databases via n8n
- 🌐 **Multi-language Support** - English and Hebrew with full RTL support
- 🔒 **Private Model Support** - Use Ollama for local/private deployments

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm/pnpm
- **Docker** and Docker Compose
- **OpenAI API Key** or **Anthropic API Key** (or Ollama for local testing)

### Installation

1. **Install dependencies**

   ```bash
   npm install
   cd backend && npm install
   cd ../frontend/widget && npm install
   cd ../admin && npm install
   cd ../customer && npm install
   ```

2. **Configure environment**

   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your API keys and database credentials
   ```

3. **Start services**

   ```bash
   npm run dockerup    # Start PostgreSQL, Redis, n8n
   npm run migrate     # Run database migrations
   npm start           # Start backend (port 3000)
   ```

4. **Start frontend (optional)**

   ```bash
   npm run widget      # Widget dev server (port 3001)
   npm run admin       # Admin dashboard (port 3002)
   npm run customer    # Customer dashboard (port 3003)
   ```

   Or start all services at once:
   ```bash
   npm run startall    # Start backend + all frontends in parallel
   ```

5. **Access dashboards**

   - **Admin**: http://localhost:3002 (username: `admin`, password: `admin123`)
   - **Customer**: http://localhost:3003 (login with access code, e.g., `GAV091`)

### Verify Installation

```bash
npm run check:connections  # Check all service connections
curl http://localhost:3000/health  # Health check
```

---

## 🏗️ Architecture

```
Client Website → AI Widget → Backend (Node.js/Express)
                              ↓
                    LLM Service (OpenAI/Claude/Ollama)
                              ↓
                    Tool Manager → n8n Workflows
                              ↓
                    External Systems (Shopify, Gmail, CRMs, etc.)
```

**Key Benefits:**
- ✅ No custom API code per client - n8n handles integrations
- ✅ Works with any platform - Wix, Shopify, WordPress, custom HTML
- ✅ Fast onboarding - New clients in ~1 hour
- ✅ Scalable multi-tenant architecture
- ✅ Flexible LLM options (cloud or private models)

---

## 📁 Project Structure

```
CSAIProj/
├── backend/
│   ├── src/          # Node.js/Express backend
│   └── db/migrations/# SQL migration files
├── frontend/
│   ├── widget/       # Embeddable chat widget
│   ├── admin/        # Admin dashboard (React)
│   └── customer/     # Customer dashboard (React)
├── docker/           # Docker Compose configuration
└── n8n-workflows/    # Demo n8n workflows
```

---

## 🛠️ Development

### Common Commands

```bash
# Backend
npm start              # Start backend server
npm run migrate        # Run database migrations

# Frontend
npm run widget         # Widget dev server (port 3001)
npm run admin          # Admin dashboard (port 3002)
npm run customer       # Customer dashboard (port 3003)
npm run startall       # Start all services in parallel

# Docker
npm run dockerup       # Start containers
npm run dockerdown     # Stop containers

# Testing
npm test               # Run all tests
npm run mockdata       # Generate test data
```

### Environment Variables

Key variables in `backend/.env`:

```env
# Database (use localhost for local dev, container names for Docker deployment)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=aiuser
POSTGRES_PASSWORD=your_password
POSTGRES_DB=aiclient

# Redis (use localhost for local dev)
REDIS_HOST=localhost
REDIS_PORT=6379

# LLM (choose one)
OPENAI_API_KEY=your_key
# OR
ANTHROPIC_API_KEY=your_key
# OR
OLLAMA_BASE_URL=http://localhost:11434

# n8n
N8N_HOST=localhost
N8N_PORT=5678

PORT=3000
```

See `backend/.env.example` for complete configuration.

---

## 📚 Documentation

- **[CLAUDE.md](CLAUDE.md)** - Comprehensive development guide
- **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)** - Implementation roadmap
- **[docs/CUSTOMER_DASHBOARD_COMPLETE.md](docs/CUSTOMER_DASHBOARD_COMPLETE.md)** - Customer Dashboard details
- **[docs/TOOLS_INTEGRATIONS_ARCHITECTURE.md](docs/TOOLS_INTEGRATIONS_ARCHITECTURE.md)** - Tools & Integrations architecture
- **[n8n-workflows/README.md](n8n-workflows/README.md)** - n8n workflow setup

### API Endpoints

**Chat**: `POST /chat/message`, `GET /chat/history/:sessionId`

**Admin**: `GET /admin/clients`, `POST /admin/clients`, `GET /admin/tools`, etc.

**Customer**: `POST /api/customer/auth/login`, `GET /api/customer/dashboard/overview`, etc.

See `backend/src/routes/` for complete API documentation.

---

## 🎨 Widget Integration

### Minimal Embed Code (Recommended)

The widget now auto-configures from the server. Just add this to any HTML page:

```html
<script src="http://localhost:3001/widget.js" data-api-key="YOUR_API_KEY"></script>
```

That's it! The widget fetches all styling configuration (colors, text, position) from the server based on your admin dashboard settings.

### Using Admin Dashboard

1. Go to **Admin Dashboard** → **Clients** → Select client
2. Configure widget appearance in **Widget Customization** section
3. **Save Configuration** (styling is stored on server)
4. Copy the minimal embed code
5. Paste into your website

### Override Options

Need to override specific settings? Add data attributes:

```html
<script
  src="http://localhost:3001/widget.js"
  data-api-key="YOUR_API_KEY"
  data-position="bottom-left"
  data-primary-color="#FF5722"
></script>
```

Toggle "Show full configuration" in the admin dashboard to see all available options.

### Demo Page

Visit the demo page to see the widget in action:

```bash
cd frontend/widget && npm run dev
# Open http://localhost:3001/demo.html
```

The demo shows a realistic Bob's Pizza restaurant website with a fully themed widget.

---

## 👥 Customer Dashboard

Self-service portal for businesses to monitor their AI chat widget usage:

- 📊 **Dashboard** - Account overview, usage stats, recent conversations
- 💬 **Conversations** - View and search all conversations
- 💰 **Billing** - View and download invoices as PDF
- 📈 **Usage Analytics** - Current usage vs limits, tool breakdown, trends

**Access**: http://localhost:3003 (login with access code)

See [docs/CUSTOMER_DASHBOARD_COMPLETE.md](docs/CUSTOMER_DASHBOARD_COMPLETE.md) for details.

---

## 🔧 Tools & Integrations

Flexible architecture for connecting tools to external systems:

1. **Generic Tools** - Reusable tool templates (e.g., "get_order_status")
2. **Integration Types** - API categories (e.g., `order_api`, `inventory_api`)
3. **Client Integrations** - Client-specific API connections with credentials
4. **Client Tools** - Maps generic tools to client integrations via n8n webhooks

**Benefits:**
- One generic tool works with multiple clients
- Same n8n workflow serves all clients
- Easy addition of new integration types

**Supported**: Shopify, WooCommerce, Gmail, Google Sheets, CRMs, databases, custom APIs

See [docs/TOOLS_INTEGRATIONS_ARCHITECTURE.md](docs/TOOLS_INTEGRATIONS_ARCHITECTURE.md) for detailed architecture.

---

## 🧪 Testing

Tests run automatically via GitHub Actions CI. The CI pipeline includes:
- ESLint linting (required to pass)
- Unit and integration tests
- Frontend builds
- API health checks

### Running Tests Locally

```bash
# Linting (must pass for CI)
npm run lint              # Lint backend
npm run lint:fix          # Auto-fix lint issues

# Unit & Integration Tests
npm run test:unit         # Unit tests (Vitest)
npm run test:models       # Database model tests
npm run test:redis        # Redis cache service tests
npm run test:all          # All integration tests

# Service-Specific Tests
npm run test:llm          # LLM service tests (requires API key)
npm run test:phase2       # Full conversation flow
npm run test:phase3       # Tool execution flow
npm run test:phase6       # Billing & usage tests

# Test Data & Connectivity
npm run mockdata          # Generate test data
npm run check:connections # Check all service connections
npm run check:ollama      # Check Ollama connectivity
```

### Frontend Linting

```bash
cd frontend/admin && npm run lint     # Admin dashboard
cd frontend/customer && npm run lint  # Customer dashboard
cd frontend/widget && npm run lint    # Widget
```

---

## 🚢 Deployment

**Backend**: Vercel, Railway, DigitalOcean, AWS/GCP/Azure

**Database**: Supabase, Railway, AWS RDS

**Redis**: Upstash, Redis Cloud, Self-hosted

**n8n**: Railway, Contabo VM, n8n Cloud

**Widget CDN**: Cloudflare Pages, Vercel, Netlify, AWS S3 + CloudFront

---

## 📧 Support

For questions, issues, or feature requests, please open an issue on GitHub.

---

<div align="center">

**Made with ❤️ for businesses who want AI-powered customer service**

[⬆ Back to Top](#csai---ai-customer-service-agent-platform)

</div>
