# Phase 6: Billing Infrastructure & Plan Management Foundation

**Status**: Ready to begin
**Estimated Time**: 30-40 hours
**Goal**: Build infrastructure for billing, plan management, and LLM optimization (business rules to be configured later)

---

## Context

**What's Complete**:

- ✅ Phases 1-5: Full MVP with backend, widget, and admin dashboard
- ✅ Ollama (Hermes-2-Pro-Mistral-7B) working for local development
- ✅ Claude 3.5 Sonnet integration prepared (code exists but not active)
- ✅ Token tracking and usage logging infrastructure
- ✅ Multi-tenant architecture with per-client configuration
- ✅ `plan_type` field exists in database (currently cosmetic)

**Current Limitations**:

- Using local Ollama model (free but limited quality)
- No cost management or usage limits
- No billing infrastructure
- No payment provider integration
- `plan_type` field doesn't enforce anything
- No way to bill clients or track revenue

**What Phase 6 Adds**:

- **Billing infrastructure** (invoices, payment tracking, provider abstraction)
- **Plan configuration system** (flexible, configurable limits)
- **Usage reporting** (comprehensive analytics)
- **Plan enforcement middleware** (generic, works with any limits)
- **Payment provider abstraction** (ready for Stripe/PayPal integration)
- Production-ready LLM configuration
- Cost optimization and monitoring

**Important**: This phase builds **infrastructure**, not business rules. You'll configure:

- Plan limits and features (in admin UI or config file)
- Pricing structure (in billing service config)
- Payment provider connection (via abstraction layer)

---

## Phase 6 Goals

### 1. Billing Infrastructure

**1.1 Billing Database Schema**:

```sql
-- Migration: Create billing/invoices table
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id),
    billing_period VARCHAR(7) NOT NULL,  -- YYYY-MM format
    plan_type VARCHAR(50) NOT NULL,
    base_cost DECIMAL(10, 2) DEFAULT 0,
    usage_cost DECIMAL(10, 2) DEFAULT 0,
    total_cost DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',  -- pending/paid/overdue/cancelled
    payment_provider VARCHAR(50),  -- stripe/paypal/manual/null
    payment_provider_id VARCHAR(255),  -- external payment ID
    payment_method VARCHAR(50),  -- credit_card/bank_transfer/manual
    created_at TIMESTAMP DEFAULT NOW(),
    paid_at TIMESTAMP,
    due_date DATE,
    notes TEXT
);

CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_invoices_billing_period ON invoices(billing_period);
CREATE INDEX idx_invoices_status ON invoices(status);
```

**1.2 Billing Service** (`backend/src/services/billingService.js`):

```javascript
// Infrastructure for billing - pricing configurable
class BillingService {
  // Calculate invoice from usage data
  static async generateInvoice(clientId, billingPeriod) {
    // Aggregate usage from api_usage table
    // Apply configurable pricing (base + usage-based)
    // Create invoice record
  }

  // Payment provider abstraction layer
  static async createPaymentIntent(invoiceId, amount, currency = "USD") {
    // Placeholder for Stripe/PayPal/etc.
    // Returns payment intent ID
  }

  static async processPayment(invoiceId, paymentProviderId) {
    // Placeholder for payment processing
    // Update invoice status
  }

  static async refundPayment(invoiceId, amount) {
    // Placeholder for refunds
  }

  static async getPaymentStatus(paymentProviderId) {
    // Placeholder for checking payment status
  }
}
```

**1.3 Billing API Endpoints** (`/admin/billing/*`):

- `GET /admin/billing/invoices` - List all invoices with filters
- `GET /admin/billing/invoices/:id` - Get invoice details
- `POST /admin/billing/invoices/:id/mark-paid` - Mark as paid (manual)
- `POST /admin/billing/invoices/:id/charge` - Charge via payment provider (future)
- `GET /admin/clients/:id/invoices` - Get client's invoices
- `POST /admin/billing/webhook` - Webhook endpoint for payment providers (future)
- `GET /admin/billing/revenue` - Revenue analytics

**1.4 Billing Dashboard** (admin panel):

- View all invoices with filters (status, date, client)
- Mark invoices as paid (manual)
- Generate invoice PDFs
- View revenue analytics
- Payment provider integration UI (placeholder - to be connected later)

**Deliverable**: Complete billing infrastructure ready for payment provider integration

---

### 2. Plan Configuration Infrastructure

**2.1 Flexible Plan Configuration** (`backend/src/config/planLimits.js`):

```javascript
// Infrastructure for plan limits - values configurable, not hardcoded
export const PLAN_CONFIG = {
  // Structure supports any plan type and any limit type
  // Actual values to be configured based on business model
  free: {
    limits: {
      conversationsPerMonth: null, // Configure later
      messagesPerMonth: null,
      tokensPerMonth: null,
      toolsEnabled: null,
      integrationsEnabled: null,
      costLimitUSD: null,
    },
    features: {
      llmProvider: "ollama", // Configurable
      customBranding: false,
      prioritySupport: false,
    },
    pricing: {
      baseCost: 0, // Configure later
      usageMultiplier: 0, // Configure later
    },
  },
  starter: {
    limits: {
      /* Configure later */
    },
    features: {
      /* Configure later */
    },
    pricing: {
      /* Configure later */
    },
  },
  pro: {
    limits: {
      /* Configure later */
    },
    features: {
      /* Configure later */
    },
    pricing: {
      /* Configure later */
    },
  },
  // Add more plans as needed
};

// Helper function to get plan config
export function getPlanConfig(planType) {
  return PLAN_CONFIG[planType] || PLAN_CONFIG.free;
}

// Helper function to check if limit is exceeded
export function checkLimit(planType, limitType, currentUsage) {
  const config = getPlanConfig(planType);
  const limit = config.limits[limitType];
  if (limit === null) return { allowed: true }; // Unlimited
  return {
    allowed: currentUsage < limit,
    remaining: limit - currentUsage,
    limit: limit,
  };
}
```

**2.2 Plan Enforcement Middleware** (`backend/src/middleware/planLimits.js`):

```javascript
// Generic middleware that works with any configurable limit
export async function checkPlanLimits(req, res, next) {
  const client = req.client; // From auth middleware
  const planConfig = getPlanConfig(client.plan_type);

  // Check any limit type (messages, tokens, cost, etc.)
  // Works with configurable limits, not hardcoded values

  // Example: Check message limit
  const messageUsage = await getCurrentUsage(client.id, "messagesPerMonth");
  const messageCheck = checkLimit(
    client.plan_type,
    "messagesPerMonth",
    messageUsage
  );

  if (!messageCheck.allowed) {
    return res.status(429).json({
      error: "Plan limit exceeded",
      limit: messageCheck.limit,
      current: messageUsage,
      message: "Please upgrade your plan or contact support",
    });
  }

  next();
}
```

**2.3 Usage Tracking Service** (enhance existing `ApiUsage` model):

```javascript
// Generic usage tracking - works with any metric
class UsageTracker {
  static async getCurrentUsage(clientId, metric, period = "month") {
    // Calculate current usage for any metric
    // Supports: messages, tokens, conversations, cost, etc.
  }

  static async resetUsage(clientId, period) {
    // Reset usage counters (monthly reset)
  }

  static async getUsageHistory(clientId, metric, months = 12) {
    // Get historical usage data
  }
}
```

**Deliverable**: Flexible plan system that can be configured without code changes

---

### 3. Usage Reporting & Analytics

**3.1 Client Usage Reports** (admin dashboard):

- Monthly usage summary (conversations, messages, tokens, tool calls, cost)
- Usage trends over time (charts - last 6-12 months)
- Current month vs previous month comparison
- Usage breakdown by tool
- Cost breakdown per client
- Usage by plan type

**3.2 Usage API Endpoints** (`/admin/clients/:id/usage`):

- `GET /admin/clients/:id/usage` - Current month usage
- `GET /admin/clients/:id/usage/history` - Historical usage (last 12 months)
- `GET /admin/clients/:id/usage/export` - Export usage as CSV
- `GET /admin/usage/summary` - All clients usage summary

**3.3 Usage Alerts** (backend service):

- Email/webhook when client reaches 80% of limit (configurable threshold)
- Email/webhook when client exceeds limit
- Daily usage summary emails (optional)
- Admin dashboard shows clients near limit

**Deliverable**: Comprehensive usage reporting and analytics

---

### 4. Plan Management Infrastructure

**4.1 Plan Upgrade/Downgrade System** (admin dashboard):

- Change client plan with immediate effect
- Prorate billing for mid-month changes (configurable)
- Handle plan downgrade (warn if usage exceeds new limits)
- Plan change history tracking
- Automatic limit updates when plan changes

**4.2 Plan Configuration UI** (admin dashboard):

- Configure plan limits and features (no hardcoding)
- Define pricing per plan
- Enable/disable features per plan
- **Note**: Business rules (what each plan includes) defined here, not in code

**4.3 Plan Enforcement in Chat API**:

- Generic limit checking (uses plan configuration)
- Return appropriate error messages
- Suggest plan upgrade when limits exceeded (configurable message)

**Deliverable**: Complete plan management system with configurable rules

---

### 5. LLM Provider Selection & Optimization

**5.1 Per-Client LLM Provider Selection**:

- Allow admins to set preferred LLM per client (admin dashboard)
- Override plan defaults if needed
- Support for: Ollama, Claude, OpenAI
- Fallback provider configuration

**5.2 Cost Optimization Strategies**:

- Advanced prompt compression techniques
- Optimize context window usage (smart truncation)
- Fallback to cheaper models for simple queries
- A/B testing for model selection (optional)

**5.3 Provider Cost Tracking**:

- Track costs per provider per client
- Compare provider costs in analytics
- Recommend cheaper provider when appropriate
- Cost calculator service (configurable pricing)

**Deliverable**: Flexible LLM provider selection with cost optimization

---

### 6. Admin Dashboard Enhancements

**6.1 Client Detail Page - Usage Tab**:

- Current month usage with progress bars
- Usage history chart (last 6 months)
- Plan limits visualization
- Quick upgrade button
- Usage breakdown by metric

**6.2 Billing Page** (new):

- List all invoices with filters
- Revenue analytics
- Outstanding payments
- Payment history
- Payment provider status (when connected)

**6.3 Usage Reports Page** (new):

- All clients usage overview
- Filter by plan type
- Export reports
- Usage trends
- Cost analysis

**Deliverable**: Complete admin tools for billing and usage management

---

## Implementation Steps

### Step 1: Billing Infrastructure (8-10 hours)

1. Create billing table migration
2. Create `BillingService` with payment provider abstraction
3. Implement invoice generation from usage data
4. Create billing API endpoints
5. Build billing dashboard (admin panel)
6. Test invoice generation and tracking

### Step 2: Plan Configuration System (6-8 hours)

1. Create flexible `planLimits.js` config structure
2. Build plan enforcement middleware (generic)
3. Create usage tracking service enhancements
4. Add plan configuration UI (admin dashboard)
5. Test plan enforcement with configurable limits

### Step 3: Usage Reporting (5-6 hours)

1. Create usage API endpoints
2. Build usage reporting UI components
3. Add usage alerts system
4. Create usage export functionality
5. Test reporting and alerts

### Step 4: Plan Management (4-5 hours)

1. Implement plan upgrade/downgrade logic
2. Add prorating calculation (configurable)
3. Build plan management UI
4. Add plan change history tracking
5. Test plan changes and enforcement

### Step 5: LLM Optimization (4-5 hours)

1. Enable Claude 3.5 Sonnet for production
2. Add per-client provider selection
3. Implement cost calculator service
4. Add provider cost tracking
5. Test provider selection and cost tracking

### Step 6: Admin Dashboard Updates (3-4 hours)

1. Create billing page
2. Add usage tab to client detail page
3. Create usage reports page
4. Add cost analytics widgets
5. Test all new admin features

---

## Testing Checklist

- [ ] Billing table created and migrations work
- [ ] Invoice generation from usage data works
- [ ] Payment provider abstraction layer ready (placeholders work)
- [ ] Plan configuration system flexible and configurable
- [ ] Plan enforcement middleware works with any limit type
- [ ] Usage tracking accurate for all metrics
- [ ] Usage reports display correctly
- [ ] Plan upgrade/downgrade works with prorating
- [ ] Usage alerts trigger at configured thresholds
- [ ] Admin dashboard shows billing and usage data
- [ ] LLM provider selection works per client
- [ ] Cost tracking accurate

---

## What's NOT Included (To Be Decided Later)

- ❌ **Specific plan limits** (free/starter/pro features) - configure in admin UI or config file
- ❌ **Pricing structure** - configure in billing service
- ❌ **Payment provider integration** - use abstraction layer to add Stripe/PayPal later
- ❌ **Business rules** (what each plan includes) - define in configuration
- ❌ **Self-service portal** - clients upgrade/downgrade themselves (optional future feature)

---

## Future Integration Points

**Payment Providers** (via abstraction layer):

- Stripe integration (credit cards, subscriptions)
- PayPal integration
- Bank transfer tracking
- Other payment gateways

**Subscription Management** (optional):

- Recurring billing automation
- Trial periods
- Plan change notifications
- Automatic upgrades/downgrades

**Self-Service Portal** (optional):

- Clients view their usage
- Clients upgrade/downgrade plans
- Clients view invoices
- Payment method management

---

## Files to Create/Modify

**Backend**:

- `db/migrations/YYYYMMDDHHMMSS_create_billing_table.sql` - NEW: Billing table
- `backend/src/services/billingService.js` - NEW: Billing service with provider abstraction
- `backend/src/config/planLimits.js` - NEW: Flexible plan configuration
- `backend/src/middleware/planLimits.js` - NEW: Generic plan enforcement
- `backend/src/services/usageTracker.js` - NEW: Enhanced usage tracking
- `backend/src/services/costCalculator.js` - NEW: Cost calculation (configurable pricing)
- `backend/src/routes/admin.js` - Add billing and usage endpoints
- `backend/src/models/Invoice.js` - NEW: Invoice model
- `backend/src/controllers/chatController.js` - Add plan limit checks

**Frontend Admin**:

- `frontend/admin/src/pages/Billing.jsx` - NEW: Billing dashboard
- `frontend/admin/src/pages/UsageReports.jsx` - NEW: Usage reports page
- `frontend/admin/src/pages/ClientDetail.jsx` - Add usage tab
- `frontend/admin/src/components/PlanConfig.jsx` - NEW: Plan configuration UI
- `frontend/admin/src/services/api.js` - Add billing and usage endpoints

**Environment**:

- `backend/.env` - Add billing configuration (optional for now)

---

## Success Metrics

After Phase 6, you should have:

- ✅ Complete billing infrastructure (invoices, tracking, provider abstraction)
- ✅ Flexible plan configuration system (define limits without code changes)
- ✅ Plan enforcement middleware (works with any configurable limits)
- ✅ Comprehensive usage reporting and analytics
- ✅ Payment provider abstraction layer (ready for Stripe/PayPal)
- ✅ Plan management system (upgrade/downgrade with prorating)
- ✅ LLM provider selection per client
- ✅ Cost tracking and optimization
- ✅ Admin tools for billing and usage management
- ✅ Infrastructure ready for business model decisions
