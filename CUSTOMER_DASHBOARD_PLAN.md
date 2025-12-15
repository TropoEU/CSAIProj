# Customer Dashboard Implementation Plan

**Status**: 🚧 Planning Phase
**Priority**: Next Feature
**Estimated Time**: 16-24 hours

---

## Overview

A self-service portal for businesses (clients) using the AI widget. Provides read-only access to account information, usage statistics, billing, and conversation history.

**Key Principle**: Customers log in with their access code (no username/password for MVP).

---

## Goals

1. **Transparency**: Customers see exactly what their AI agent is doing
2. **Self-Service**: View invoices, usage, and conversation history without contacting support
3. **Trust Building**: Show detailed tool execution and AI behavior
4. **Simple MVP**: Read-only interface focused on visibility

---

## Technical Architecture

### Frontend
- **Location**: `frontend/customer/`
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS (match admin panel aesthetic)
- **Port**: `3003` (admin is 3002, widget dev is 3001)
- **Authentication**: JWT tokens (issued by backend after access code verification)

### Backend
- **New Routes**: `/api/customer/*`
- **Authentication**: Middleware to verify access code → client mapping
- **Permissions**: Read-only access to client's own data only

### Database
- **No new tables needed** - uses existing:
  - `clients` - Account info
  - `conversations` - Chat history
  - `messages` - Conversation details
  - `tool_executions` - Tool call logs
  - `invoices` - Billing history
  - `api_usage` - Usage statistics
  - `client_tools` - Available actions

---

## Pages & Features

### 1. Login Page (`/customer/login`)

**Purpose**: Authenticate with access code

**UI**:
```
┌─────────────────────────────────────┐
│  [Logo]  AI Customer Service        │
│                                     │
│  Customer Portal                    │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Access Code                   │ │
│  │ [____________________]        │ │
│  │                               │ │
│  │ [x] Remember me (30 days)     │ │
│  │                               │ │
│  │        [Login →]              │ │
│  └───────────────────────────────┘ │
│                                     │
│  Don't have an access code?         │
│  Contact your account manager.      │
└─────────────────────────────────────┘
```

**API**:
- `POST /api/customer/auth/login`
  - Body: `{ accessCode: string, rememberMe: boolean }`
  - Response: `{ token: string, client: { id, name, plan, ... } }`
  - Validation: Check `clients.access_code`
  - Error: Invalid code → "Access code not found"

**State Management**:
- Store JWT in localStorage: `customer_token`
- Store client info in context: `CustomerAuthContext`

---

### 2. Overview Dashboard (`/customer/dashboard`)

**Purpose**: High-level account summary

**Sections**:

#### Account Info
- Business name
- Current plan (display_name)
- Account status (active/suspended)
- Access code (masked: `ABC***XYZ`)

#### Usage Summary (Current Month)
- Conversations: `150 / 500` (with progress bar)
- Tokens Used: `1.2M / 5M`
- Tool Calls: `45 / Unlimited`
- Status: `✅ Healthy` or `⚠️ Approaching Limit`

#### Quick Stats
- Active conversations today
- Most used tool this week
- Average response time

#### Recent Activity
- Last 5 conversations (timestamp, first message preview)
- Link to full chat history

**API**:
- `GET /api/customer/dashboard/overview`
  - Response: `{ account, usage, stats, recentConversations }`

---

### 3. Actions Page (`/customer/actions`)

**Purpose**: Show what the AI can do (based on enabled tools)

**UI**:
```
Your AI Assistant Can:

┌────────────────────────────────────────┐
│ 🛒 Check Order Status                  │
│ Customers can ask about order delivery │
│ • Get real-time tracking info          │
│ • View driver details                  │
│ • See estimated delivery time          │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 📅 Book Appointments                   │
│ Schedule pickup times and reservations │
│ • Book table reservations              │
│ • Schedule pizza pickup                │
│ • Automatic confirmation               │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ 📦 Check Inventory                     │
│ Check product availability in stock    │
│ • Real-time inventory data             │
│ • Product availability                 │
└────────────────────────────────────────┘
```

**Data Source**:
- Query `client_tools` joined with `tools`
- For each enabled tool, show:
  - Friendly name
  - Plain language description
  - Bullet points of capabilities

**API**:
- `GET /api/customer/actions`
  - Response: `{ tools: [{ name, description, capabilities }] }`

---

### 4. Billing Page (`/customer/billing`)

**Purpose**: View invoices and payment history

**Sections**:

#### Current Billing Period
- Period: `Dec 1 - Dec 31, 2025`
- Status: `Paid` / `Pending` / `Overdue`
- Amount: `$49.00`
- Due Date: `Jan 1, 2026`

#### Invoice History (Table)
| Invoice # | Period | Amount | Status | Actions |
|-----------|--------|--------|--------|---------|
| INV-001 | Nov 2025 | $49.00 | Paid | [Download PDF] |
| INV-002 | Dec 2025 | $49.00 | Pending | [Download PDF] [Pay Now] |

#### Payment Method
- (For MVP: Show "Contact support to update payment method")
- (Future: Stripe integration)

**API**:
- `GET /api/customer/billing/invoices`
  - Response: `{ invoices: [{ id, period, amount, status, pdfUrl }] }`
- `GET /api/customer/billing/invoice/:id/pdf`
  - Response: PDF file download

---

### 5. Usage Page (`/customer/usage`)

**Purpose**: Detailed usage analytics

**Sections**:

#### Usage vs. Limits (Current Month)
- Visual progress bars for each metric
- Conversations: `150 / 500` (30%)
- Tokens: `1.2M / 5M` (24%)
- Tool Calls: `45 / Unlimited`

#### Usage Trends (Chart)
- Line chart showing daily conversations over last 30 days
- Bar chart showing token usage by day

#### Tool Usage Breakdown
- Pie chart: Which tools are called most often
- Table: Tool name, call count, success rate

#### Cost Breakdown (if applicable)
- LLM provider costs
- Token costs by provider
- Total estimated cost

**API**:
- `GET /api/customer/usage/current`
  - Response: `{ usage: { conversations, tokens, toolCalls }, limits }`
- `GET /api/customer/usage/trends?period=30d`
  - Response: `{ daily: [{ date, conversations, tokens }] }`
- `GET /api/customer/usage/tools`
  - Response: `{ tools: [{ name, count, successRate }] }`

---

### 6. Chat History Page (`/customer/conversations`)

**Purpose**: Browse past conversations

**Features**:
- Searchable table (by session ID, date range)
- Filter: Active / Ended
- Sort: Most recent first
- Pagination: 20 per page
- Export: CSV / JSON

**Table Columns**:
| Session ID | Started | Duration | Messages | Status | Actions |
|------------|---------|----------|----------|--------|---------|
| sess_abc... | Dec 15, 10:30 AM | 5m 23s | 8 | Ended | [View] |

**API**:
- `GET /api/customer/conversations?page=1&limit=20&search=&status=all`
  - Response: `{ conversations, totalPages }`
- `GET /api/customer/conversations/export?format=csv`
  - Response: CSV file download

---

### 7. Conversation Detail Page (`/customer/conversations/:id`)

**Purpose**: View full conversation transcript

**Similar to Admin's ConversationDetail but:**
- No edit/delete capabilities
- Simplified view focused on customer experience
- Show tool executions in a user-friendly way

**Sections**:
- Conversation metadata (session ID, date, duration)
- Full message transcript (user + AI)
- Tool executions (collapsed by default, expandable)
- Token usage for this conversation

**API**:
- `GET /api/customer/conversations/:id`
  - Response: `{ conversation, messages, toolExecutions }`

---

### 8. Widget Settings (Future/Optional)

**Purpose**: Customize widget appearance

**For MVP**: Read-only display of current settings
**Future**: Allow customers to customize:
- Colors
- Position
- Greeting message
- Upload logo

---

## Backend Implementation

### Authentication Middleware

**File**: `backend/src/middleware/customerAuth.js`

```javascript
async function customerAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const client = await Client.findById(decoded.clientId);

    if (!client) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.client = client;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

### API Routes

**File**: `backend/src/routes/customer.js`

```javascript
const router = express.Router();

// Auth
router.post('/auth/login', customerController.login);
router.post('/auth/logout', customerAuth, customerController.logout);

// Dashboard
router.get('/dashboard/overview', customerAuth, customerController.getOverview);

// Actions
router.get('/actions', customerAuth, customerController.getActions);

// Billing
router.get('/billing/invoices', customerAuth, customerController.getInvoices);
router.get('/billing/invoice/:id/pdf', customerAuth, customerController.getInvoicePDF);

// Usage
router.get('/usage/current', customerAuth, customerController.getCurrentUsage);
router.get('/usage/trends', customerAuth, customerController.getUsageTrends);
router.get('/usage/tools', customerAuth, customerController.getToolUsage);

// Conversations
router.get('/conversations', customerAuth, customerController.getConversations);
router.get('/conversations/:id', customerAuth, customerController.getConversationDetail);
router.get('/conversations/export', customerAuth, customerController.exportConversations);

module.exports = router;
```

---

## Security Considerations

1. **Access Code Protection**:
   - Never expose access code in API responses (mask it)
   - Rate limit login attempts (5 per minute)
   - Log all login attempts

2. **Data Isolation**:
   - Middleware MUST verify client owns requested resource
   - Example: Can't view another client's conversations

3. **Read-Only Enforcement**:
   - No PUT/PATCH/DELETE routes for MVP
   - Future: Separate permission system

4. **Token Security**:
   - Short expiry (7 days default)
   - "Remember me" extends to 30 days
   - Refresh token mechanism (future)

---

## UI/UX Considerations

1. **Responsive Design**: Mobile-first (many customers will check on phone)
2. **Loading States**: Show spinners for all data fetching
3. **Error Handling**: Friendly error messages, not technical jargon
4. **Empty States**: "No conversations yet" with helpful message
5. **Consistent Theme**: Match admin panel colors/styling for brand consistency

---

## Testing Strategy

1. **Unit Tests**: All API endpoints with Mocha/Chai
2. **Integration Tests**: Full auth flow (login → access data → logout)
3. **Manual Testing**:
   - Test with multiple clients (data isolation)
   - Test invalid access codes
   - Test expired tokens
   - Test "remember me" functionality

---

## Development Phases

### Phase 1: Backend API (6-8 hours)
- [ ] Create `customerAuth` middleware
- [ ] Create `/api/customer/*` routes
- [ ] Implement all controller methods
- [ ] Add validation and error handling
- [ ] Write API tests

### Phase 2: Frontend Setup (2-3 hours)
- [ ] Create `frontend/customer/` React app
- [ ] Set up routing (React Router)
- [ ] Create `CustomerAuthContext`
- [ ] Set up Tailwind CSS
- [ ] Configure Vite build

### Phase 3: Core Pages (6-8 hours)
- [ ] Login page with access code auth
- [ ] Overview dashboard
- [ ] Navigation layout
- [ ] Logout functionality

### Phase 4: Data Pages (4-6 hours)
- [ ] Actions page (tool listing)
- [ ] Billing page (invoice table)
- [ ] Usage page (charts and metrics)
- [ ] Chat history page (conversation list)
- [ ] Conversation detail page

### Phase 5: Polish & Testing (2-4 hours)
- [ ] Responsive design testing
- [ ] Loading states and error handling
- [ ] Empty states
- [ ] Cross-browser testing
- [ ] Integration testing

---

## Open Questions

1. **Should customers be able to download their data?**
   - Export conversations as JSON/CSV?
   - GDPR compliance considerations

2. **Password protection in addition to access code?**
   - MVP: Access code only
   - Future: Optional password for extra security

3. **Email notifications?**
   - New invoice available
   - Approaching usage limits
   - Conversation summaries

4. **Multi-user access per client?**
   - MVP: Single access code
   - Future: Multiple users per client (team access)

---

## Success Metrics

- [ ] Customers can log in with access code
- [ ] Customers can view all their conversations
- [ ] Customers can download invoices
- [ ] Customers can see real-time usage stats
- [ ] Load time < 2 seconds for all pages
- [ ] Zero data leakage between clients

---

## Next Steps

1. **Get Approval**: Review this plan with team/stakeholders
2. **Set Timeline**: Allocate 2-3 days for development
3. **Create Tasks**: Break down into GitHub issues or Jira tickets
4. **Start with Backend**: API routes and authentication first
5. **Build Frontend**: Once API is stable, build React UI

---

**Last Updated**: December 15, 2025
