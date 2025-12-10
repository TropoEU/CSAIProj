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

## Phase 6: Generate Widget Embed Code

**Location**: Manual Process (No UI Yet)

### Steps:

1. **Retrieve Client API Key**
   - Go to Client Detail page
   - Copy the API key from the "Overview" tab
   - Or regenerate if needed (click "Regenerate API Key")

2. **Create Embed Code**
   - Manually construct the script tag with client's preferences:

   ```html
   <!-- CSAI Chat Widget -->
   <script
     src="http://localhost:3001/widget.js"
     data-api-key="csai_client_api_key_here"
     data-api-url="http://localhost:3000"
     data-position="bottom-right"
     data-primary-color="#667eea"
     data-title="Chat Support"
     data-subtitle="We typically reply instantly"
     data-greeting="Hi! How can I help you today?"
   ></script>
   ```

3. **Customize Widget Settings**
   - **data-api-key**: Client's unique API key (REQUIRED)
   - **data-api-url**: Backend URL (production: your domain)
   - **data-position**: "bottom-right" or "bottom-left"
   - **data-primary-color**: Hex color matching client's brand
   - **data-title**: Header title text
   - **data-subtitle**: Header subtitle text
   - **data-greeting**: Initial greeting message

4. **Provide to Client**
   - Send embed code via email
   - Include installation instructions
   - Provide support contact information

**✅ Outcome**: Embed code ready for client website integration

**⚠️ MISSING FEATURES IDENTIFIED**:
- **NO EMBED CODE GENERATOR IN ADMIN PANEL** - Currently manual process
- No widget customization UI (must edit code manually)
- No preview of widget appearance
- No version management for widget.js
- No CDN hosting for production

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

**⚠️ MISSING FEATURES IDENTIFIED**:
- No widget installation verification endpoint
- No real-time monitoring of widget status
- No client-side error reporting

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
- [ ] Embed code generated
- [ ] Widget customization applied
- [ ] Embed code sent to client
- [ ] Installation instructions provided
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

### Critical Missing Features

1. **Embed Code Generator**
   - **Impact**: HIGH
   - **Current**: Manual HTML construction
   - **Needed**: UI to generate customized embed code with preview
   - **Location**: Should be in Client Detail page

2. **Widget Customization Interface**
   - **Impact**: HIGH
   - **Current**: Must edit script tag manually
   - **Needed**: Visual customizer for colors, text, position
   - **Location**: Client Detail → Widget tab

3. **Webhook URL Validation**
   - **Impact**: MEDIUM
   - **Current**: No validation when saving webhook URLs
   - **Needed**: Test connectivity before saving
   - **Location**: Tool configuration, Integration setup

4. **n8n Workflow Management**
   - **Impact**: MEDIUM
   - **Current**: Must use separate n8n interface
   - **Needed**: View/manage workflows from admin panel
   - **Location**: New "Workflows" page or Client Detail tab

### High-Priority Missing Features

5. **Integration Credential Testing**
   - **Impact**: MEDIUM
   - **Current**: Can only test after saving
   - **Needed**: Validate credentials before saving
   - **Location**: Integration creation modal

6. **System Prompt Templates**
   - **Impact**: MEDIUM
   - **Current**: Must write from scratch
   - **Needed**: Library of pre-built prompts by industry
   - **Location**: Client creation/edit

7. **Bulk Tool Management**
   - **Impact**: LOW-MEDIUM
   - **Current**: Enable tools one by one
   - **Needed**: Enable multiple tools at once, tool packages
   - **Location**: Client Detail → Tools tab

8. **Widget Installation Verification**
   - **Impact**: MEDIUM
   - **Current**: Manual verification
   - **Needed**: Automatic detection of widget on client site
   - **Location**: Client Detail → Widget tab

### Nice-to-Have Features

9. **Client Portal**
   - **Impact**: LOW (but valuable for scale)
   - **Current**: Admins manage everything
   - **Needed**: Self-service portal for clients
   - **Features**: View usage, update settings, see invoices

10. **Automated Billing**
    - **Impact**: LOW-MEDIUM
    - **Current**: Manual invoice generation
    - **Needed**: Scheduled invoice generation and email
    - **Integration**: Stripe/payment gateway

11. **Usage Alerts**
    - **Impact**: LOW-MEDIUM
    - **Current**: No proactive notifications
    - **Needed**: Email alerts when approaching limits
    - **Location**: Client settings

12. **Conversation Tagging**
    - **Impact**: LOW
    - **Current**: No categorization
    - **Needed**: Tag conversations by topic/intent
    - **Location**: Conversations page

13. **Widget Preview**
    - **Impact**: MEDIUM
    - **Current**: Must deploy to see changes
    - **Needed**: Live preview in admin panel
    - **Location**: Widget customization UI

14. **Tool Parameter Customization**
    - **Impact**: LOW-MEDIUM
    - **Current**: Uses global schema only
    - **Needed**: Override parameters per client
    - **Location**: Client Detail → Tools

15. **OAuth Integration Flows**
    - **Impact**: MEDIUM (for specific integrations)
    - **Current**: Manual API key entry
    - **Needed**: OAuth2 authorization for Google, Shopify, etc.
    - **Location**: Integration setup

---

## Estimated Time to Full Onboarding

**With Current Features**:
- Simple client (1-2 tools): **45-60 minutes**
- Medium complexity (3-5 tools, 2-3 integrations): **2-3 hours**
- Complex client (10+ tools, 5+ integrations): **4-6 hours**

**With Missing Features Implemented** (estimated):
- Simple client: **15-20 minutes**
- Medium complexity: **45-60 minutes**
- Complex client: **90-120 minutes**

**Time savings**: ~60-70% reduction with automation and better UX

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

This guide provides a complete walkthrough of client onboarding. The process is functional but would benefit significantly from the missing features identified above, particularly:

1. **Embed code generator** (critical for streamlined deployment)
2. **Widget customization UI** (eliminate manual code editing)
3. **Webhook validation** (prevent configuration errors)

With these improvements, onboarding time could be reduced by 60-70%, making the platform more scalable and user-friendly.
