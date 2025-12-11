# Client Onboarding Guide

**Complete step-by-step guide for integrating a new customer into the CSAI platform**

This document walks through the entire process of onboarding a new client, from initial account creation to a fully functional AI assistant integrated on their website.

---

## Prerequisites

Before starting, ensure you have:

- ✅ Admin access to the dashboard (http://localhost:3002)
- ✅ n8n instance running (http://localhost:5678)
- ✅ Backend server running (http://localhost:3000)
- ✅ Client's business information (name, website, contact details)
- ✅ List of integrations the client needs (Shopify, Gmail, etc.)

---

## Phase 1: Create Client Account

**Location**: Admin Dashboard → Clients Page

### Steps:

1. **Navigate to Clients**
   - Open http://localhost:3002
   - Click "Clients" in the sidebar
   - Click "Add Client" button (top right)

2. **Fill in Client Details**
   - **Name**: Client's business name (e.g., "Acme Store")
   - **Email**: Client's contact email
   - **Website**: Client's website URL (optional but recommended)
   - **Billing Plan**: Select plan (free, basic, pro, enterprise)
   - **LLM Provider**: Choose AI model (ollama, claude, openai)
   - **Model Name**: Specific model (e.g., "claude-3-5-sonnet-20241022")
   - **System Prompt** (optional): Custom instructions for this client's AI
   - **Status**: Set to "active"

3. **Submit and Capture API Key**
   - Click "Create Client"
   - **IMPORTANT**: Copy the generated API key immediately
   - Save it securely - you'll need it for widget integration
   - API key format: `csai_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

4. **Verify Client Creation**
   - Client should appear in the clients list
   - Note the Client ID for reference

**✅ Outcome**: Client account created with unique API key

---

## Phase 2: Configure Tools for Client

**Location**: Admin Dashboard → Client Detail Page

### Steps:

1. **Open Client Detail Page**
   - From Clients list, click on the client name
   - You'll see tabs: Overview, Tools, Integrations, Invoices, Usage

2. **Review Available Tools**
   - Click "Tools" tab
   - See list of all global tools in the system
   - Examples: get_order_status, book_appointment, check_inventory

3. **Enable Tools**
   - Click "Enable Tool" for each tool the client needs
   - **For each enabled tool, configure**:
     - **Webhook URL**: n8n webhook endpoint (format: `http://localhost:5678/webhook/tool_name`)
     - **Enabled**: Toggle on
     - Click "Save"

4. **Edit Tool Configuration** (if needed)
   - Click "Edit" on any enabled tool
   - Update webhook URL
   - Click "Save Changes"

5. **Test Tool** (optional at this stage)
   - Click "Test" button
   - Verify connectivity to n8n

**✅ Outcome**: Client has specific tools enabled with n8n webhook URLs configured

**⚠️ MISSING FEATURE IDENTIFIED**:
- No way to customize tool parameters per client (uses global schema only)
- No bulk enable/disable for tools

---

## Phase 3: Set Up Client Integrations

**Location**: Admin Dashboard → Integrations Page

### Steps:

1. **Navigate to Integrations**
   - Click "Integrations" in the sidebar
   - Select your client from the dropdown at the top

2. **Add Integration**
   - Click "Add Integration" button
   - Fill in integration details:

   **Example: Shopify Integration**
   - **Integration Type**: Shopify
   - **Name**: "Client's Shopify Store"
   - **API Key**: Shopify API key (get from client)
   - **API Secret**: Shopify API secret (get from client)
   - **Webhook URL**: n8n webhook for Shopify events (optional)
   - **Additional Config**: JSON with shop domain, etc.
   ```json
   {
     "shop_domain": "client-store.myshopify.com",
     "api_version": "2024-01"
   }
   ```

3. **Save Integration**
   - Click "Add Integration"
   - Integration appears in the list with status "active"

4. **Test Integration**
   - Click "Test" button
   - Verify connection successful
   - Status badge should show "Connected" if successful

5. **Repeat for All Integrations**
   - Gmail, Google Calendar, Stripe, WooCommerce, etc.
   - Each integration needs its own credentials

**✅ Outcome**: Client's external systems connected and tested

**⚠️ MISSING FEATURES IDENTIFIED**:
- No validation of credentials before saving
- No integration templates (pre-filled common configs)
- No OAuth flow for integrations that support it

---

## Phase 4: Configure n8n Workflows

**Location**: n8n Web Interface (http://localhost:5678)

### Steps:

1. **Access n8n**
   - Open http://localhost:5678
   - Login with n8n credentials (from .env file)

2. **Import Workflows**
   - Click "Import from File"
   - Select workflow files from `n8n-workflows/` directory:
     - `get_order_status.json`
     - `book_appointment.json`
     - `check_inventory.json`
     - Any custom workflows for this client

3. **Configure Each Workflow**
   - Open imported workflow
   - Click on the **Webhook node**:
     - Set webhook path (e.g., `/webhook/get_order_status`)
     - Set HTTP Method to POST
     - Enable "Respond Immediately" if needed

   - Configure **Integration nodes** (Shopify, HTTP Request, etc.):
     - Add credentials (API keys from Phase 3)
     - Set up authentication
     - Configure request parameters

4. **Test Webhook**
   - Click "Execute Workflow"
   - Send test POST request to webhook URL
   - Verify data flows through correctly
   - Check response format matches expected schema

5. **Activate Workflows**
   - Toggle "Active" switch on each workflow
   - Verify webhook URLs are accessible

**✅ Outcome**: n8n workflows configured and active for client's tools

**⚠️ MISSING FEATURES IDENTIFIED**:
- No n8n workflow management from admin dashboard
- No webhook URL auto-generation or validation
- No workflow versioning or rollback

---

## Phase 5: Test Chat Functionality

**Location**: Admin Dashboard → Test Chat

### Steps:

1. **Navigate to Test Chat**
   - Click "Test Chat" in sidebar (or Dashboard page)
   - Select your client from the dropdown

2. **Start Test Conversation**
   - Type a test message: "Hello, can you help me?"
   - Verify AI responds with appropriate greeting
   - Check response time (should be < 3 seconds)

3. **Test Tool Execution**
   - Ask a question that triggers a tool:
     - "What's the status of order 12345?"
     - "Check if product SKU-001 is in stock"
     - "Book an appointment for tomorrow at 2pm"

   - **Verify**:
     - AI correctly identifies the intent
     - Tool is called (check n8n execution history)
     - Response includes data from the tool
     - Response is natural and helpful

4. **Test Multi-Turn Conversation**
   - Ask follow-up questions
   - Verify context is maintained
   - Check conversation flows naturally

5. **Test Error Handling**
   - Ask for invalid order number
   - Request unavailable product
   - Verify AI handles errors gracefully

**✅ Outcome**: Chat functionality verified working end-to-end

**⚠️ MISSING FEATURES IDENTIFIED**:
- No conversation transcript export from test chat
- No ability to simulate different user scenarios
- No tool execution debugging view in admin panel

---

## Phase 6: Widget Customization & Embed Code

**Location**: Admin Dashboard → Client Detail Page → Widget Customization Section

### Steps:

1. **Open Client Detail Page**
   - From Clients list, click on the client name
   - Scroll down to "Widget Customization" card

2. **Customize Widget Appearance**

   **Basic Settings:**
   - **Widget Position**: Choose from bottom-right, bottom-left, top-right, top-left
   - **Chat Title**: Header title text (e.g., "Chat Support")
   - **Chat Subtitle**: Subtitle text (e.g., "We typically reply instantly")
   - **Greeting Message**: Initial message shown to users

   **Color Customization (14 options):**
   - **Primary Color**: Main brand color for buttons and accents
   - **Background**: Overall widget background
   - **Header Background**: Top header section color
   - **Body Background**: Chat area background
   - **Footer Background**: Input area background
   - **AI Bubble Color**: Background of AI message bubbles
   - **User Bubble Color**: Background of user message bubbles
   - **Header Text**: Header title/subtitle text color
   - **AI Text**: AI message text color
   - **User Text**: User message text color
   - **Input Background**: Message input field background
   - **Input Text**: Text color in input field
   - **Button Text**: Send button text color

3. **Preview Widget (Optional)**
   - Click "Show Preview" button to see live preview
   - Preview shows widget with current settings
   - Adjust colors and settings until satisfied

4. **Save Configuration**
   - Click "Save Configuration" button
   - Configuration is stored in the database
   - Widget will use these settings automatically

5. **Copy Embed Code**
   - Embed code is auto-generated in the right panel
   - Click the copy button to copy to clipboard
   - Code includes all customization options as data attributes

6. **Provide to Client**
   - Send embed code via email
   - Include installation instructions (shown below the embed code)
   - Provide support contact information

**✅ Outcome**: Customized embed code ready for client website integration

**Note**: Widget configuration is saved to the database and synced with the widget automatically. No manual code editing required!

---

## Phase 7: Client Website Integration

**Location**: Client's Website

### Steps:

1. **Send Instructions to Client**
   - Provide the embed code from Phase 6
   - Include placement instructions:
     - Add just before closing `</body>` tag
     - Works on any page (Wix, Shopify, WordPress, custom HTML)

2. **Client Implementation**
   - Client adds script tag to their website
   - No developer knowledge required
   - Widget auto-initializes on page load

3. **Verify Installation**
   - Visit client's website
   - Look for chat bubble in bottom-right corner
   - Click to open chat window
   - Send test message

4. **Test on Client's Site**
   - Verify widget loads correctly
   - Check styling doesn't conflict
   - Test tool execution in production context
   - Verify conversations are tracked in database

5. **Monitor First Conversations**
   - Go to Admin Dashboard → Conversations
   - Filter by client
   - Review first real user conversations
   - Check for any issues

**✅ Outcome**: Widget live on client's website and functional

**Note**: Widget installation can be verified by visiting the client's website and checking for the chat bubble. Future improvements may include automatic installation verification.

---

## Phase 8: Set Up Billing (Optional)

**Location**: Admin Dashboard → Billing

### Steps:

1. **Review Client's Plan**
   - Go to Client Detail → Overview
   - Verify billing plan is set correctly

2. **Generate First Invoice**
   - Go to Billing page
   - Click "Generate Invoice"
   - Select client
   - Choose billing period
   - Review calculated usage:
     - Messages sent
     - Tokens used
     - Tool executions
     - Total cost

3. **Send Invoice to Client**
   - Click on invoice to view details
   - Export as PDF (if feature available)
   - Send to client via email

4. **Track Payments**
   - Mark invoice as "Paid" when payment received
   - Or use "Charge Invoice" for automated billing (if Stripe connected)

**✅ Outcome**: Billing configured and first invoice sent

**⚠️ MISSING FEATURES IDENTIFIED**:
- No automated invoice generation schedule
- No payment gateway integration in admin panel
- No invoice email automation
- No usage alerts when client approaches limits

---

## Phase 9: Ongoing Monitoring

**Location**: Admin Dashboard → Multiple Pages

### Daily/Weekly Tasks:

1. **Monitor Usage** (Usage Reports page)
   - Check API usage trends
   - Identify spikes or unusual patterns
   - Verify costs align with client's plan

2. **Review Conversations** (Conversations page)
   - Read sample conversations
   - Identify common questions
   - Look for AI response quality issues
   - Export conversations for analysis

3. **Check Tool Performance** (Dashboard → Tool Stats)
   - Review tool execution success rates
   - Identify failing tools
   - Monitor response times

4. **Integration Health** (Integrations page)
   - Test integrations periodically
   - Update credentials when they expire
   - Monitor last tested timestamps

5. **Optimize System Prompts**
   - Based on conversation quality
   - Update client's system prompt
   - Test improvements in Test Chat

**✅ Outcome**: Proactive monitoring ensures high-quality service

---

## Complete Onboarding Checklist

Use this checklist to ensure nothing is missed:

### Account Setup
- [ ] Client created in admin dashboard
- [ ] API key generated and saved securely
- [ ] Billing plan configured
- [ ] LLM provider and model selected
- [ ] System prompt customized (if needed)

### Tool Configuration
- [ ] Required tools identified
- [ ] Tools enabled for client
- [ ] n8n webhook URLs configured for each tool
- [ ] Tools tested successfully

### Integrations
- [ ] All required integrations added
- [ ] API credentials configured
- [ ] Integrations tested and connected
- [ ] Integration webhooks set up (if applicable)

### n8n Workflows
- [ ] Workflows imported into n8n
- [ ] Webhook paths configured
- [ ] Integration credentials added to workflows
- [ ] Workflows tested with sample data
- [ ] Workflows activated

### Testing
- [ ] Test chat conversation completed
- [ ] All tools tested via chat
- [ ] Multi-turn conversation verified
- [ ] Error handling verified
- [ ] Response quality acceptable

### Widget Deployment
- [ ] Widget customization completed (colors, text, position)
- [ ] Widget preview checked (looks good)
- [ ] Widget configuration saved to database
- [ ] Embed code copied from Client Detail page
- [ ] Embed code sent to client
- [ ] Installation instructions provided (shown in admin)
- [ ] Widget verified on client's website
- [ ] First real conversation tested

### Billing (if applicable)
- [ ] Billing plan confirmed
- [ ] First invoice generated
- [ ] Invoice sent to client
- [ ] Payment tracking set up

### Documentation
- [ ] Client onboarding notes saved
- [ ] Custom configurations documented
- [ ] Client contact information recorded
- [ ] Support escalation path established

---

## Missing Features Analysis

Based on this onboarding process, here are features that would improve the experience:

### ✅ Recently Implemented (December 11, 2025)

1. ~~**Embed Code Generator**~~ → ✅ **IMPLEMENTED**
   - Auto-generates customized embed code in Client Detail page
   - Copy-to-clipboard functionality
   - Includes all customization options

2. ~~**Widget Customization Interface**~~ → ✅ **IMPLEMENTED**
   - Full visual editor with 14 color options
   - Position, title, subtitle, greeting customization
   - Configuration saved to database

3. ~~**Widget Preview**~~ → ✅ **IMPLEMENTED**
   - Live preview button in Client Detail page
   - Shows widget with current settings

### Remaining Missing Features

**Medium Priority:**

1. **Webhook URL Validation**
   - **Impact**: MEDIUM
   - **Current**: No validation when saving webhook URLs
   - **Needed**: Test connectivity before saving
   - **Location**: Tool configuration, Integration setup

2. **n8n Workflow Management**
   - **Impact**: MEDIUM
   - **Current**: Must use separate n8n interface
   - **Needed**: View/manage workflows from admin panel
   - **Location**: New "Workflows" page or Client Detail tab

3. **Integration Credential Testing**
   - **Impact**: MEDIUM
   - **Current**: Can only test after saving
   - **Needed**: Validate credentials before saving
   - **Location**: Integration creation modal

4. **Widget Installation Verification**
   - **Impact**: MEDIUM
   - **Current**: Manual verification
   - **Needed**: Automatic detection of widget on client site
   - **Location**: Client Detail → Widget tab

**Low Priority:**

5. **System Prompt Templates**
   - **Impact**: LOW-MEDIUM
   - **Current**: Must write from scratch
   - **Needed**: Library of pre-built prompts by industry
   - **Location**: Client creation/edit

6. **Bulk Tool Management**
   - **Impact**: LOW-MEDIUM
   - **Current**: Enable tools one by one
   - **Needed**: Enable multiple tools at once, tool packages
   - **Location**: Client Detail → Tools tab

### Nice-to-Have Features

7. **Client Portal**
   - **Impact**: LOW (but valuable for scale)
   - **Current**: Admins manage everything
   - **Needed**: Self-service portal for clients
   - **Features**: View usage, update settings, see invoices

8. **Automated Billing**
    - **Impact**: LOW-MEDIUM
    - **Current**: Manual invoice generation
    - **Needed**: Scheduled invoice generation and email
    - **Integration**: Stripe/payment gateway

9. **Usage Alerts**
    - **Impact**: LOW-MEDIUM
    - **Current**: No proactive notifications
    - **Needed**: Email alerts when approaching limits
    - **Location**: Client settings

10. **Conversation Tagging**
    - **Impact**: LOW
    - **Current**: No categorization
    - **Needed**: Tag conversations by topic/intent
    - **Location**: Conversations page

11. **Tool Parameter Customization**
    - **Impact**: LOW-MEDIUM
    - **Current**: Uses global schema only
    - **Needed**: Override parameters per client
    - **Location**: Client Detail → Tools

12. **OAuth Integration Flows**
    - **Impact**: MEDIUM (for specific integrations)
    - **Current**: Manual API key entry
    - **Needed**: OAuth2 authorization for Google, Shopify, etc.
    - **Location**: Integration setup

---

## Estimated Time to Full Onboarding

**Current (After December 11, 2025 Updates)**:
- Simple client (1-2 tools): **20-30 minutes** ⬇️ Improved!
- Medium complexity (3-5 tools, 2-3 integrations): **1-2 hours** ⬇️ Improved!
- Complex client (10+ tools, 5+ integrations): **2-4 hours** ⬇️ Improved!

**Key Improvements**:
- Widget customization UI eliminates manual code editing
- Embed code generator with one-click copy
- Live preview saves deployment cycles

**With All Remaining Features Implemented** (estimated):
- Simple client: **10-15 minutes**
- Medium complexity: **30-45 minutes**
- Complex client: **60-90 minutes**

**Total Time Savings So Far**: ~50% reduction from original estimates

---

## Support and Troubleshooting

**Common Issues**:

1. **Widget doesn't appear on client site**
   - Check API key is correct
   - Verify backend URL is accessible from client's domain
   - Check browser console for errors
   - Verify CORS is enabled on backend

2. **Tools not executing**
   - Verify n8n workflows are active
   - Check webhook URLs are correct
   - Test webhook directly with curl/Postman
   - Review n8n execution history for errors

3. **Integrations failing**
   - Verify API credentials are current
   - Check API rate limits
   - Test integration connection
   - Review error logs in admin panel

4. **AI responses not relevant**
   - Review system prompt
   - Check if correct tools are enabled
   - Verify tool descriptions are clear
   - Test with different prompts

**Need Help?**
Check `CLAUDE.md` for development documentation and `BUG_FIXES.md` for known issues and solutions.

---

## Conclusion

This guide provides a complete walkthrough of client onboarding. The process has been significantly improved with the December 11, 2025 updates:

**✅ Recently Implemented:**
1. **Embed code generator** - Auto-generates customized script tags with copy-to-clipboard
2. **Widget customization UI** - Full visual editor with 14 color options
3. **Widget preview** - Live preview before deployment

**Remaining Improvements (for future development):**
1. **Webhook validation** - Test connectivity before saving
2. **n8n workflow management** - View/manage from admin panel
3. **Integration credential testing** - Validate before saving

The platform is now **production-ready** with a streamlined onboarding process. Average onboarding time has been reduced by ~50% from initial estimates.
