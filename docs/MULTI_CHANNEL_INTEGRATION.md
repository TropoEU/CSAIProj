# Multi-Channel Support Implementation Plan

## Overview

This document outlines the implementation plan for adding multi-channel support to the CSAIProj platform, starting with Gmail and WhatsApp integration. Multi-channel support allows the AI to handle customer inquiries across different communication platforms beyond the web widget.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Channel Sources                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐   │
│  │ Widget  │  │  Gmail  │  │WhatsApp │  │   Future    │   │
│  └────┬────┘  └────┬────┘  └────┬────┘  └──────┬──────┘   │
└───────┼───────────┼────────────┼───────────────┼──────────┘
        │           │            │               │
        └───────────┴────────────┴───────────────┘
                           ▼
        ┌──────────────────────────────────────────┐
        │      Channel Router Service              │
        │  - Normalize messages                    │
        │  - Route to AI Engine                    │
        │  - Track channel-specific metadata       │
        └──────────────┬───────────────────────────┘
                       ▼
        ┌──────────────────────────────────────────┐
        │      LLM Service (existing)              │
        │  - Generate responses                    │
        │  - Execute tools                         │
        └──────────────┬───────────────────────────┘
                       ▼
        ┌──────────────────────────────────────────┐
        │      Channel Response Service            │
        │  - Format for target channel             │
        │  - Send via appropriate API              │
        │  - Handle channel-specific features      │
        └──────────────────────────────────────────┘
```

---

## Database Schema Changes

### New Table: `email_channels`

Stores email integration configurations per client.

```sql
CREATE TABLE email_channels (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  channel_type VARCHAR(50) NOT NULL, -- 'gmail', 'outlook', etc.
  email_address VARCHAR(255) NOT NULL,
  connection_config JSONB NOT NULL, -- OAuth tokens, refresh tokens
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, error, authenticating
  last_checked_at TIMESTAMP,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_client_email UNIQUE(client_id, email_address)
);

CREATE INDEX idx_email_channels_client ON email_channels(client_id);
CREATE INDEX idx_email_channels_status ON email_channels(status);
CREATE INDEX idx_email_channels_last_checked ON email_channels(last_checked_at);
```

### New Table: `whatsapp_channels`

Stores WhatsApp Business API configurations per client.

```sql
CREATE TABLE whatsapp_channels (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  phone_number_id VARCHAR(255) NOT NULL, -- WhatsApp Business Phone Number ID
  business_account_id VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  webhook_verify_token VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, error, pending_verification
  last_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_client_whatsapp UNIQUE(client_id, phone_number_id)
);

CREATE INDEX idx_whatsapp_channels_client ON whatsapp_channels(client_id);
CREATE INDEX idx_whatsapp_channels_status ON whatsapp_channels(status);
```

### New Table: `escalations`

Tracks human escalation requests.

```sql
CREATE TABLE escalations (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  reason VARCHAR(50) NOT NULL, -- 'user_requested', 'ai_stuck', 'low_confidence', 'explicit_trigger'
  trigger_message_id INTEGER REFERENCES messages(id),
  status VARCHAR(50) DEFAULT 'pending', -- pending, acknowledged, resolved, cancelled
  assigned_to VARCHAR(255), -- Email/phone of human agent
  notes TEXT,
  escalated_at TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  resolved_at TIMESTAMP,

  CONSTRAINT fk_escalation_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  CONSTRAINT fk_escalation_client FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE INDEX idx_escalations_conversation ON escalations(conversation_id);
CREATE INDEX idx_escalations_client ON escalations(client_id);
CREATE INDEX idx_escalations_status ON escalations(status);
CREATE INDEX idx_escalations_created ON escalations(escalated_at);
```

### Update Existing Tables

**`conversations` table:**
```sql
ALTER TABLE conversations
  ADD COLUMN channel VARCHAR(50) DEFAULT 'widget',
  ADD COLUMN channel_thread_id VARCHAR(255),
  ADD COLUMN channel_metadata JSONB;

-- Values for channel: 'widget', 'email', 'whatsapp'
-- channel_thread_id: Gmail thread ID, WhatsApp conversation ID, etc.
-- channel_metadata: Channel-specific data (sender email, phone number, etc.)

CREATE INDEX idx_conversations_channel ON conversations(channel);
CREATE INDEX idx_conversations_thread ON conversations(channel_thread_id);
```

**`messages` table:**
```sql
ALTER TABLE messages
  ADD COLUMN external_message_id VARCHAR(255),
  ADD COLUMN channel_metadata JSONB;

-- external_message_id: Gmail message ID, WhatsApp message ID, etc.
-- channel_metadata: Attachments, reactions, read receipts, etc.

CREATE INDEX idx_messages_external ON messages(external_message_id);
```

**`clients` table - Add escalation config:**
```sql
ALTER TABLE clients
  ADD COLUMN escalation_config JSONB DEFAULT '{
    "enabled": true,
    "notification_email": null,
    "notification_phone": null,
    "auto_detect_stuck": true,
    "confidence_threshold": 0.6,
    "show_button": true
  }'::jsonb;
```

---

## Part 1: Gmail Integration

### Overview

Gmail integration allows clients to use their business Gmail accounts to receive and respond to customer inquiries. The AI monitors the inbox, generates responses, and sends emails while maintaining thread context.

### Prerequisites

Before implementation, you need:

1. **Google Cloud Console Setup** (15 minutes):
   - Go to https://console.cloud.google.com/
   - Create a new project (e.g., "CSAIProj-Email-Integration")
   - Enable Gmail API for the project
   - Go to "APIs & Services" > "Credentials"
   - Create OAuth 2.0 credentials:
     - Application type: "Web application"
     - Name: "CSAIProj Gmail Integration"
     - Authorized redirect URIs:
       - `http://localhost:3000/api/email/oauth/callback` (development)
       - `https://yourdomain.com/api/email/oauth/callback` (production)
   - Save the Client ID and Client Secret

2. **Environment Variables**:
   Add to `backend/.env`:
   ```env
   # Gmail OAuth2
   GMAIL_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
   GMAIL_CLIENT_SECRET=your_client_secret_here
   GMAIL_REDIRECT_URI=http://localhost:3000/api/email/oauth/callback
   ```

3. **Gmail Account Preparation**:
   - Use a dedicated business Gmail account (or throwaway for testing)
   - Create labels for organization (optional):
     - "AI Handled"
     - "Needs Review"
     - "Escalated"

### Gmail API Scopes Required

```javascript
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',  // Read emails
  'https://www.googleapis.com/auth/gmail.send',      // Send emails
  'https://www.googleapis.com/auth/gmail.modify',    // Mark as read/unread
  'https://www.googleapis.com/auth/gmail.labels'     // Create/manage labels
];
```

### Implementation Phases

#### Phase A: Database & Models (2-3 hours)

**Files to create:**
- `db/migrations/YYYYMMDDHHMMSS_add_email_channels.sql`
- `db/migrations/YYYYMMDDHHMMSS_update_conversations_for_multichannel.sql`
- `backend/src/models/EmailChannel.js`

**Updates needed:**
- `backend/src/models/Conversation.js` - Add channel fields
- `backend/src/models/Message.js` - Add external_message_id field

#### Phase B: Gmail OAuth2 Flow (3-4 hours)

**Files to create:**
- `backend/src/services/gmailService.js` - Gmail API wrapper
- `backend/src/controllers/emailController.js` - OAuth flow handlers
- `backend/src/routes/email.js` - Email-related routes

**OAuth Flow:**
1. Admin clicks "Connect Gmail" in dashboard
2. Redirects to Google OAuth consent screen
3. User authorizes the app
4. Google redirects back with authorization code
5. Backend exchanges code for access/refresh tokens
6. Store tokens in `email_channels` table
7. Start monitoring inbox

**Key Functions:**
```javascript
// backend/src/services/gmailService.js
class GmailService {
  async authenticateClient(clientId) { }
  async getUnreadEmails(emailChannelId) { }
  async sendEmail(emailChannelId, to, subject, body, threadId) { }
  async markAsRead(emailChannelId, messageId) { }
  async refreshAccessToken(emailChannelId) { }
}
```

#### Phase C: Email Monitor Service (4-5 hours)

**Files to create:**
- `backend/src/services/emailMonitor.js` - Background job to check inboxes

**Monitoring Logic:**
```javascript
// Check all active email channels every 60 seconds
setInterval(async () => {
  const activeChannels = await EmailChannel.getActive();

  for (const channel of activeChannels) {
    try {
      // Get unread emails
      const emails = await gmailService.getUnreadEmails(channel.id);

      for (const email of emails) {
        // Check if conversation exists (thread)
        let conversation = await Conversation.findByChannelThread(
          email.threadId,
          'email'
        );

        if (!conversation) {
          // Create new conversation
          conversation = await Conversation.create({
            client_id: channel.client_id,
            session_id: `email-${email.threadId}`,
            channel: 'email',
            channel_thread_id: email.threadId,
            channel_metadata: {
              from: email.from,
              subject: email.subject
            },
            status: 'active'
          });
        }

        // Save customer message
        await Message.create({
          conversation_id: conversation.id,
          role: 'user',
          content: email.body,
          external_message_id: email.id
        });

        // Generate AI response
        const aiResponse = await conversationService.processMessage(
          conversation.session_id,
          email.body,
          channel.client_id
        );

        // Send email reply
        await gmailService.sendEmail(
          channel.id,
          email.from,
          `Re: ${email.subject}`,
          aiResponse,
          email.threadId
        );

        // Mark as read
        await gmailService.markAsRead(channel.id, email.id);
      }

      // Update last checked timestamp
      await EmailChannel.updateLastChecked(channel.id);

    } catch (error) {
      console.error(`Email monitoring error for channel ${channel.id}:`, error);
      await EmailChannel.updateStatus(channel.id, 'error', error.message);
    }
  }
}, 60000); // Every 60 seconds
```

#### Phase D: Email Reply Service (3-4 hours)

**Updates needed:**
- `backend/src/services/conversationService.js` - Add email formatting
- `backend/src/services/gmailService.js` - Email sending with templates

**Email Formatting:**
```javascript
function formatEmailResponse(aiResponse, clientConfig) {
  const signature = clientConfig.emailSignature || `
---
This response was generated by AI-powered customer service.
If you need further assistance, please reply to this email.
  `;

  return `
${aiResponse}

${signature}
  `;
}
```

**Email Templates:**
```javascript
// Welcome email for new threads
const WELCOME_EMAIL_TEMPLATE = `
Hello,

Thank you for contacting {businessName}. I'm the AI assistant and I'm here to help you.

{aiResponse}

Best regards,
{businessName} Support Team
`;

// Standard reply template
const REPLY_TEMPLATE = `
{aiResponse}

---
{signature}
`;
```

#### Phase E: Admin Dashboard Integration (2-3 hours)

**Files to create:**
- `frontend/admin/src/pages/EmailChannels.jsx` - Email configuration page
- `frontend/admin/src/services/api.js` - Add email API methods

**Admin UI Features:**
1. **Email Channels List**:
   - Table showing connected email accounts
   - Status indicators (active, error, authenticating)
   - Last checked timestamp
   - Disconnect button

2. **Connect Gmail Flow**:
   - "Connect Gmail" button
   - Opens OAuth popup
   - Shows success/error message
   - Automatically starts monitoring

3. **Email Channel Card**:
   ```jsx
   <div className="email-channel-card">
     <div className="status-indicator" />
     <div className="email-address">{channel.email_address}</div>
     <div className="last-checked">Last checked: {formatTime(channel.last_checked_at)}</div>
     <div className="actions">
       <button onClick={testConnection}>Test</button>
       <button onClick={disconnect}>Disconnect</button>
     </div>
   </div>
   ```

4. **Email Settings**:
   - Email signature configuration
   - Auto-reply settings
   - Monitoring frequency
   - Email filters (which emails to respond to)

**Routes to add:**
```javascript
// backend/src/routes/email.js
router.get('/oauth/authorize/:clientId', emailController.initiateOAuth);
router.get('/oauth/callback', emailController.handleOAuthCallback);
router.get('/channels/:clientId', emailController.getChannels);
router.delete('/channels/:channelId', emailController.disconnectChannel);
router.post('/channels/:channelId/test', emailController.testConnection);
```

### Gmail Integration Testing

**Test Checklist:**
1. ✅ OAuth flow completes successfully
2. ✅ Tokens stored in database
3. ✅ Inbox monitoring starts automatically
4. ✅ Unread emails detected
5. ✅ AI generates appropriate response
6. ✅ Reply sent successfully
7. ✅ Thread context maintained
8. ✅ Email marked as read
9. ✅ Conversation visible in admin dashboard
10. ✅ Error handling (invalid tokens, API limits)

### Gmail Rate Limits & Best Practices

- **API Quota**: 1 billion quota units/day (generous)
- **Rate Limit**: 250 quota units per user per second
- **Best Practice**: Poll every 60 seconds (configurable)
- **Token Refresh**: Refresh tokens every 55 minutes (expires at 60)
- **Error Handling**: Exponential backoff on rate limit errors

---

## Part 2: WhatsApp Integration

### Overview

WhatsApp Business API integration allows clients to receive and respond to customer messages on WhatsApp. This is critical for the Israeli market where WhatsApp is the dominant messaging platform.

### Prerequisites

Before implementation, you need:

1. **WhatsApp Business Account**:
   - Sign up at https://business.whatsapp.com/
   - Verify your business
   - Get approved for WhatsApp Business API access

2. **Facebook Developer Account**:
   - Go to https://developers.facebook.com/
   - Create a new app (type: Business)
   - Add "WhatsApp" product to your app
   - Configure webhook URL

3. **WhatsApp Business Phone Number**:
   - Add a phone number to your WhatsApp Business account
   - Verify the phone number
   - Get the Phone Number ID from the dashboard

4. **Environment Variables**:
   Add to `backend/.env`:
   ```env
   # WhatsApp Business API
   WHATSAPP_API_URL=https://graph.facebook.com/v18.0
   WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_random_secure_token_here
   ```

### WhatsApp API Setup

**1. Webhook Configuration**:
- Webhook URL: `https://yourdomain.com/api/whatsapp/webhook`
- Verify Token: Random secure string (stored in .env)
- Subscribe to: `messages` events

**2. Required Permissions**:
- `whatsapp_business_messaging` - Send and receive messages
- `whatsapp_business_management` - Manage business profile

### Implementation Phases

#### Phase A: Database & Models (1-2 hours)

**Files to create:**
- `db/migrations/YYYYMMDDHHMMSS_add_whatsapp_channels.sql`
- `backend/src/models/WhatsAppChannel.js`

#### Phase B: WhatsApp Service (4-5 hours)

**Files to create:**
- `backend/src/services/whatsappService.js` - WhatsApp API wrapper
- `backend/src/controllers/whatsappController.js` - Webhook handlers
- `backend/src/routes/whatsapp.js` - WhatsApp-related routes

**Key Functions:**
```javascript
// backend/src/services/whatsappService.js
class WhatsAppService {
  async sendMessage(phoneNumberId, to, message) {
    // Send text message via WhatsApp API
  }

  async sendTemplateMessage(phoneNumberId, to, templateName, params) {
    // Send pre-approved template message
  }

  async markAsRead(phoneNumberId, messageId) {
    // Mark message as read
  }

  async sendReaction(phoneNumberId, messageId, emoji) {
    // React to message with emoji
  }
}
```

#### Phase C: Webhook Handler (3-4 hours)

**Webhook Flow:**
```javascript
// backend/src/controllers/whatsappController.js

// Webhook verification (GET request from Facebook)
async verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
}

// Webhook message handler (POST request from Facebook)
async handleWebhook(req, res) {
  const { entry } = req.body;

  // Respond immediately to Facebook
  res.sendStatus(200);

  // Process message asynchronously
  for (const change of entry[0].changes) {
    if (change.field === 'messages') {
      const message = change.value.messages?.[0];
      if (!message) continue;

      // Get WhatsApp channel configuration
      const channel = await WhatsAppChannel.findByPhoneNumberId(
        change.value.metadata.phone_number_id
      );

      if (!channel) {
        console.error('WhatsApp channel not found');
        continue;
      }

      // Check if conversation exists
      let conversation = await Conversation.findByChannelThread(
        message.from,
        'whatsapp'
      );

      if (!conversation) {
        // Create new conversation
        conversation = await Conversation.create({
          client_id: channel.client_id,
          session_id: `whatsapp-${message.from}`,
          channel: 'whatsapp',
          channel_thread_id: message.from, // WhatsApp phone number
          channel_metadata: {
            phone_number: message.from,
            contact_name: change.value.contacts?.[0]?.profile?.name
          },
          status: 'active'
        });
      }

      // Save customer message
      await Message.create({
        conversation_id: conversation.id,
        role: 'user',
        content: message.text?.body || '[Media]',
        external_message_id: message.id,
        channel_metadata: {
          type: message.type,
          timestamp: message.timestamp
        }
      });

      // Mark as read immediately
      await whatsappService.markAsRead(
        channel.phone_number_id,
        message.id
      );

      // Generate AI response
      const aiResponse = await conversationService.processMessage(
        conversation.session_id,
        message.text?.body,
        channel.client_id
      );

      // Send WhatsApp reply
      await whatsappService.sendMessage(
        channel.phone_number_id,
        message.from,
        aiResponse
      );
    }
  }
}
```

#### Phase D: Admin Dashboard Integration (2-3 hours)

**Add to Email Channels page or create new "Communication Channels" page:**

**WhatsApp Configuration UI:**
1. **Add WhatsApp Channel Form**:
   ```jsx
   <form onSubmit={handleAddWhatsApp}>
     <input
       type="text"
       placeholder="Phone Number ID"
       value={phoneNumberId}
     />
     <input
       type="text"
       placeholder="Business Account ID"
       value={businessAccountId}
     />
     <input
       type="text"
       placeholder="Access Token"
       value={accessToken}
     />
     <button type="submit">Connect WhatsApp</button>
   </form>
   ```

2. **WhatsApp Channel Card**:
   ```jsx
   <div className="whatsapp-channel-card">
     <div className="whatsapp-icon" />
     <div className="phone-number">{channel.phone_number_id}</div>
     <div className="status">{channel.status}</div>
     <div className="actions">
       <button onClick={testConnection}>Send Test Message</button>
       <button onClick={disconnect}>Disconnect</button>
     </div>
   </div>
   ```

**Routes to add:**
```javascript
// backend/src/routes/whatsapp.js
router.get('/webhook', whatsappController.verifyWebhook);
router.post('/webhook', whatsappController.handleWebhook);
router.post('/channels', whatsappController.createChannel);
router.get('/channels/:clientId', whatsappController.getChannels);
router.delete('/channels/:channelId', whatsappController.deleteChannel);
router.post('/channels/:channelId/test', whatsappController.sendTestMessage);
```

### WhatsApp Message Templates

WhatsApp requires pre-approved templates for the first message to a user (24-hour window rule):

**Template Examples:**
```javascript
const WHATSAPP_TEMPLATES = {
  welcome: {
    name: 'customer_service_greeting',
    language: 'en',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: '{customerName}' },
          { type: 'text', text: '{businessName}' }
        ]
      }
    ]
  }
};
```

**Template Approval Process:**
1. Create template in WhatsApp Business Manager
2. Submit for approval (usually 1-2 business days)
3. Once approved, use in first message

### WhatsApp Integration Testing

**Test Checklist:**
1. ✅ Webhook verification succeeds
2. ✅ Channel configuration saved in database
3. ✅ Receive message webhook triggered
4. ✅ Message parsed correctly
5. ✅ Conversation created/retrieved
6. ✅ AI generates response
7. ✅ Reply sent via WhatsApp API
8. ✅ Message marked as read
9. ✅ Conversation visible in admin dashboard
10. ✅ Media messages handled (images, documents)

### WhatsApp Rate Limits & Best Practices

- **Rate Limit**: 80 messages per second per phone number
- **Message Window**: 24-hour window after user message (free-form replies)
- **Template Messages**: Required outside 24-hour window
- **Media Support**: Images, videos, documents, audio, stickers
- **Message Length**: Up to 4096 characters
- **Delivery Status**: Webhook events for sent, delivered, read

### WhatsApp-Specific Features

**1. Quick Replies**:
```javascript
{
  type: 'button',
  body: {
    text: 'How can I help you?'
  },
  action: {
    buttons: [
      { type: 'reply', reply: { id: 'order_status', title: 'Order Status' } },
      { type: 'reply', reply: { id: 'book_appointment', title: 'Book Now' } },
      { type: 'reply', reply: { id: 'talk_to_human', title: 'Talk to Human' } }
    ]
  }
}
```

**2. Rich Media**:
- Send images with captions
- Send PDFs (invoices, receipts)
- Send location (business address)

**3. Read Receipts**:
- Mark messages as read automatically
- Show typing indicator (via API)

---

## Shared Channel Infrastructure

### Channel Router Service

**File**: `backend/src/services/channelRouter.js`

Handles message normalization and routing across all channels:

```javascript
class ChannelRouter {
  async routeIncomingMessage(channel, rawMessage) {
    // Normalize message format
    const normalizedMessage = this.normalizeMessage(channel, rawMessage);

    // Get or create conversation
    const conversation = await this.getOrCreateConversation(
      normalizedMessage.clientId,
      normalizedMessage.channelThreadId,
      channel,
      normalizedMessage.metadata
    );

    // Save user message
    await Message.create({
      conversation_id: conversation.id,
      role: 'user',
      content: normalizedMessage.content,
      external_message_id: normalizedMessage.externalId,
      channel_metadata: normalizedMessage.metadata
    });

    // Process with AI
    const aiResponse = await conversationService.processMessage(
      conversation.session_id,
      normalizedMessage.content,
      normalizedMessage.clientId
    );

    // Route response back to channel
    await this.sendResponse(channel, normalizedMessage, aiResponse);

    return aiResponse;
  }

  normalizeMessage(channel, rawMessage) {
    switch (channel) {
      case 'email':
        return {
          content: rawMessage.body,
          clientId: rawMessage.clientId,
          channelThreadId: rawMessage.threadId,
          externalId: rawMessage.id,
          metadata: {
            from: rawMessage.from,
            subject: rawMessage.subject
          }
        };

      case 'whatsapp':
        return {
          content: rawMessage.text?.body,
          clientId: rawMessage.clientId,
          channelThreadId: rawMessage.from,
          externalId: rawMessage.id,
          metadata: {
            phone_number: rawMessage.from,
            type: rawMessage.type
          }
        };

      case 'widget':
        return {
          content: rawMessage.message,
          clientId: rawMessage.clientId,
          channelThreadId: rawMessage.sessionId,
          externalId: null,
          metadata: {}
        };

      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }

  async sendResponse(channel, incomingMessage, aiResponse) {
    switch (channel) {
      case 'email':
        await emailService.sendReply(
          incomingMessage.externalId,
          incomingMessage.metadata.from,
          aiResponse
        );
        break;

      case 'whatsapp':
        await whatsappService.sendMessage(
          incomingMessage.phoneNumberId,
          incomingMessage.metadata.phone_number,
          aiResponse
        );
        break;

      case 'widget':
        // Widget uses real-time response, no additional sending needed
        break;
    }
  }
}
```

### Unified Admin UI

Create a single "Communication Channels" page in the admin dashboard:

**Route**: `/channels`

**Tabs**:
1. Widget (existing configuration)
2. Email (Gmail, Outlook)
3. WhatsApp
4. SMS (future)

---

## Testing Strategy

### Unit Tests

```javascript
// backend/tests/services/gmailService.test.js
describe('GmailService', () => {
  it('should authenticate and get access token', async () => { });
  it('should fetch unread emails', async () => { });
  it('should send email reply', async () => { });
  it('should refresh expired token', async () => { });
});

// backend/tests/services/whatsappService.test.js
describe('WhatsAppService', () => {
  it('should send text message', async () => { });
  it('should send template message', async () => { });
  it('should handle webhook verification', async () => { });
  it('should process incoming message', async () => { });
});
```

### Integration Tests

```javascript
// backend/tests/integration/multichannel.test.js
describe('Multi-Channel Integration', () => {
  it('should route email to AI and send reply', async () => { });
  it('should route WhatsApp message to AI and send reply', async () => { });
  it('should maintain conversation across channels', async () => { });
  it('should handle concurrent messages', async () => { });
});
```

### Manual Testing Checklist

**Gmail:**
- [ ] Send email to connected Gmail account
- [ ] Verify AI receives and processes message
- [ ] Verify reply is sent correctly
- [ ] Verify thread is maintained
- [ ] Test with multiple emails in thread
- [ ] Test with Hebrew email

**WhatsApp:**
- [ ] Send WhatsApp message to business number
- [ ] Verify webhook receives message
- [ ] Verify AI processes message
- [ ] Verify reply is sent
- [ ] Test quick replies
- [ ] Test Hebrew messages
- [ ] Test media messages (image, document)

---

## Deployment Considerations

### Environment Configuration

**Development:**
```env
GMAIL_REDIRECT_URI=http://localhost:3000/api/email/oauth/callback
WHATSAPP_WEBHOOK_URL=http://localhost:3000/api/whatsapp/webhook (use ngrok for testing)
```

**Production:**
```env
GMAIL_REDIRECT_URI=https://api.yourdomain.com/api/email/oauth/callback
WHATSAPP_WEBHOOK_URL=https://api.yourdomain.com/api/whatsapp/webhook
```

### Security Considerations

1. **Token Storage**: Encrypt OAuth tokens in database
2. **Webhook Verification**: Validate all incoming webhooks
3. **Rate Limiting**: Implement per-channel rate limits
4. **Error Handling**: Never expose API keys in error messages
5. **Access Control**: Admin-only access to channel configuration

### Monitoring & Alerts

**Metrics to track:**
- Email monitoring failures
- WhatsApp webhook failures
- API rate limit errors
- Token refresh failures
- Average response time per channel
- Message volume per channel

**Alerts to set up:**
- OAuth token expiration
- Channel disconnection
- Webhook verification failures
- API quota warnings

---

## Dependencies to Install

```bash
# Backend
npm install googleapis@^128.0.0      # Google APIs (Gmail)
npm install nodemailer@^6.9.7        # Email sending (backup)
npm install mailparser@^3.6.5        # Email parsing
npm install axios@^1.6.0             # HTTP client (WhatsApp API)
```

---

## Implementation Timeline

**Gmail Integration**: 12-16 hours
- Database & Models: 2-3 hours
- OAuth2 Flow: 3-4 hours
- Email Monitor: 4-5 hours
- Email Reply: 3-4 hours
- Admin UI: 2-3 hours

**WhatsApp Integration**: 10-14 hours
- Database & Models: 1-2 hours
- WhatsApp Service: 4-5 hours
- Webhook Handler: 3-4 hours
- Admin UI: 2-3 hours

**Testing & Polish**: 4-6 hours

**Total Estimated Time**: 26-36 hours

---

## Future Enhancements

1. **Facebook Messenger**: Similar to WhatsApp webhook pattern
2. **SMS via Twilio**: Simple REST API integration
3. **Slack Integration**: For internal support channels
4. **Telegram**: Growing in Israeli market
5. **Instagram DMs**: Part of Facebook Business Platform
6. **Email Attachments**: Handle and respond to attachments
7. **Rich Email Templates**: HTML emails with branding
8. **WhatsApp Catalog**: Product catalog integration
9. **WhatsApp Payments**: Payment links in messages

---

## Success Metrics

After implementation, track:
- Number of connected channels per client
- Message volume per channel type
- AI success rate per channel
- Response time per channel
- Human escalation rate per channel
- Customer satisfaction per channel

---

## References

**Gmail API:**
- Documentation: https://developers.google.com/gmail/api
- Node.js Quickstart: https://developers.google.com/gmail/api/quickstart/nodejs
- OAuth2: https://developers.google.com/identity/protocols/oauth2

**WhatsApp Business API:**
- Documentation: https://developers.facebook.com/docs/whatsapp
- Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api
- Webhooks: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks

**Best Practices:**
- Multi-channel customer service: https://www.zendesk.com/blog/omnichannel-customer-service/
- Email automation ethics: https://www.emailonacid.com/blog/article/email-development/email-automation-best-practices/
