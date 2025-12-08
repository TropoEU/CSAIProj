# Phase 5: Admin Dashboard - Kickoff Prompt

## Context

**Phases 1-4 Complete and Operational:**

- ✅ **Phase 1**: Database schema (9 tables), models, migrations, Redis caching
- ✅ **Phase 2**: AI engine with Ollama/Claude support, conversation management
- ✅ **Phase 3**: Tool execution system, n8n integration, chat API endpoints
- ✅ **Phase 4**: Embeddable chat widget with Shadow DOM, mobile responsive

**Current Stack:**

- Backend: Node.js/Express on port 3000
- Database: PostgreSQL + Redis
- LLM: Hermes-2-Pro-Mistral-7B (Ollama) - working perfectly with tool execution
- Tools: n8n webhooks (3 demo tools: get_order_status, book_appointment, check_inventory)
- Widget: Vanilla JS with Vite, served on port 3001

**Demo Client**: Bob's Pizza Shop (API key: `bobs_pizza_api_key_123`)

## Phase 5 Goal

Build an **Admin Dashboard** to manage clients, configure tools, monitor conversations, and test the AI system. This is the control center for the platform.

## Technical Requirements

**Platform**: Windows PowerShell
**Tech Stack**:

- **Frontend**: React 18 with Vite (fast, modern, well-documented)
- **State Management**: React Context API (no Redux needed for this scale)
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **UI Components**: Tailwind CSS (utility-first, fast development)
- **Forms**: React Hook Form (validation, easy to use)
- **Charts**: Recharts (for analytics dashboard)
- **Auth**: JWT tokens stored in localStorage

**Why React?**

- Component reusability
- Large ecosystem
- Easy to find developers later
- Good TypeScript support if needed
- Matches widget development patterns (component-based)

## Implementation Tasks

### Task 1: Project Setup (1 hour)

**Directory Structure:**

```
frontend/admin/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── Layout.jsx
│   │   ├── clients/
│   │   │   ├── ClientList.jsx
│   │   │   ├── ClientForm.jsx
│   │   │   └── ClientCard.jsx
│   │   ├── tools/
│   │   │   ├── ToolList.jsx
│   │   │   ├── ToolForm.jsx
│   │   │   └── ToolTest.jsx
│   │   ├── conversations/
│   │   │   ├── ConversationList.jsx
│   │   │   ├── ConversationView.jsx
│   │   │   └── MessageBubble.jsx
│   │   ├── integrations/
│   │   │   ├── IntegrationList.jsx
│   │   │   └── IntegrationForm.jsx
│   │   └── common/
│   │       ├── Button.jsx
│   │       ├── Input.jsx
│   │       ├── Modal.jsx
│   │       └── LoadingSpinner.jsx
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Clients.jsx
│   │   ├── ClientDetail.jsx
│   │   ├── Tools.jsx
│   │   ├── Conversations.jsx
│   │   ├── Integrations.jsx
│   │   └── TestChat.jsx
│   ├── services/
│   │   ├── api.js
│   │   ├── auth.js
│   │   └── websocket.js
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── utils/
│   │   ├── formatters.js
│   │   └── validators.js
│   ├── App.jsx
│   └── main.jsx
├── public/
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

**Setup Steps:**

1. Create `frontend/admin/` directory
2. Initialize React + Vite project: `npm create vite@latest . -- --template react`
3. Install dependencies:
   ```bash
   npm install react-router-dom axios react-hook-form recharts
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```
4. Configure Tailwind CSS
5. Set up dev server on port 3002

### Task 2: Backend API Endpoints (2-3 hours)

Create new backend routes for admin operations:

**Auth Routes** (`backend/src/routes/admin.js`):

```javascript
POST / admin / login; // Login with username/password, return JWT
POST / admin / logout; // Invalidate token
GET / admin / verify; // Verify token is valid
```

**Client Management Routes**:

```javascript
GET    /admin/clients              // List all clients
GET    /admin/clients/:id          // Get client details
POST   /admin/clients              // Create new client (generate API key)
PUT    /admin/clients/:id          // Update client
DELETE /admin/clients/:id          // Deactivate client
POST   /admin/clients/:id/api-key  // Regenerate API key
```

**Tool Management Routes**:

```javascript
GET    /admin/clients/:clientId/tools       // List tools for client
POST   /admin/clients/:clientId/tools       // Add tool to client
PUT    /admin/clients/:clientId/tools/:id   // Update tool config
DELETE /admin/clients/:clientId/tools/:id   // Remove tool from client
POST   /admin/tools/:id/test                // Test tool execution
```

**Conversation Routes**:

```javascript
GET /admin/conversations                    // List all conversations (paginated)
GET /admin/conversations/:id                // Get conversation with messages
GET /admin/conversations/export             // Export conversations as CSV
GET /admin/stats/conversations              // Conversation analytics
```

**Integration Routes**:

```javascript
GET    /admin/clients/:clientId/integrations    // List integrations
POST   /admin/clients/:clientId/integrations    // Add integration
PUT    /admin/integrations/:id                  // Update integration
DELETE /admin/integrations/:id                  // Remove integration
POST   /admin/integrations/:id/test             // Test connection
```

**Analytics Routes**:

```javascript
GET /admin/stats/overview                   // Dashboard stats
GET /admin/stats/usage/:clientId            // Client usage stats
GET /admin/stats/tools                      // Tool execution stats
```

**Middleware:**

- Create `backend/src/middleware/adminAuth.js` for JWT verification
- Protect all `/admin/*` routes (except `/admin/login`)

### Task 3: Authentication System (1-2 hours)

**Backend:**

1. Create `Admin` model in `backend/src/models/Admin.js`
2. Migration for `admins` table:
   ```sql
   CREATE TABLE admins (
     id SERIAL PRIMARY KEY,
     username VARCHAR(255) UNIQUE NOT NULL,
     password_hash VARCHAR(255) NOT NULL,
     email VARCHAR(255),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```
3. Install `bcrypt` for password hashing: `npm install bcrypt jsonwebtoken`
4. Create login controller with JWT generation
5. Create auth middleware for protected routes

**Frontend:**

1. Create `AuthContext` for global auth state
2. Create `Login` page with username/password form
3. Store JWT in localStorage
4. Redirect to dashboard on successful login
5. Add logout functionality
6. Protected route wrapper component

**Default Admin Credentials:**

- Username: `admin`
- Password: `admin123` (change in production)

### Task 4: Dashboard Overview Page (2 hours)

**Components:**

- Header with user info and logout button
- Sidebar navigation menu
- Main dashboard with stats cards:
  - Total clients
  - Active conversations (today)
  - Total tool executions (today)
  - API usage (tokens this month)
- Charts:
  - Conversations over time (7 days)
  - Tool usage breakdown (pie chart)
  - Messages per hour (line chart)

**Data:**

- Create `/admin/stats/overview` endpoint
- Return aggregated stats from database
- Cache stats in Redis (5 min TTL)

### Task 5: Client Management Pages (3-4 hours)

**Clients List Page:**

- Table with columns: Name, Domain, API Key (masked), Plan, Status, Created
- Search/filter by name or domain
- Sort by name, created date
- Action buttons: View, Edit, Deactivate
- "Add New Client" button

**Client Form (Create/Edit):**

- Fields: Name, Domain, Plan Type, Contact Email
- Auto-generate API key on create
- Show/hide API key with copy button
- Validate domain format
- Save button with loading state

**Client Detail Page:**

- Tabs:
  1. **Overview**: Client info, API key, stats
  2. **Tools**: List of enabled tools (link to Tools page)
  3. **Integrations**: Connected services
  4. **Conversations**: Recent conversations
  5. **Usage**: API usage charts and billing info

### Task 6: Tool Configuration Page (3-4 hours)

**Tools List (per client):**

- Show all available tools from `tools` table
- Indicate which are enabled for this client
- Toggle switch to enable/disable
- Edit button to configure webhook URL
- Test button to manually trigger tool

**Tool Form:**

- Tool name (from master list or custom)
- Description
- n8n webhook URL
- Parameters schema (JSON editor)
- Save and test button

**Tool Test Interface:**

- Select tool to test
- Input form based on parameters schema
- "Execute" button
- Show response in formatted JSON
- Show execution time and status

### Task 7: Conversation Monitor (2-3 hours)

**Conversations List:**

- Table: Client, Session ID, Started, Ended, Messages, Status
- Filter by:
  - Client
  - Date range
  - Status (active/ended)
- Click row to view full conversation

**Conversation View:**

- Chat-style interface showing messages
- User messages (right, blue)
- AI messages (left, gray)
- Tool calls highlighted (yellow box)
- Show tool parameters and results
- Timestamps
- Export button (JSON/CSV)

### Task 8: Integration Manager (2-3 hours)

**Integrations Page:**

- List integrations for selected client
- Cards showing:
  - Integration type (Shopify, WooCommerce, Custom API)
  - Status (connected/disconnected)
  - Last test date
  - Connection status indicator
- "Add Integration" button

**Integration Form:**

- Select type: Shopify, WooCommerce, Custom API, Database
- Configuration fields (dynamic based on type):
  - Shopify: Store URL, API key, Access token
  - Custom API: Base URL, Auth type, Credentials
- Test connection button
- Save button

**Connection Test:**

- Make test API call
- Show response status
- Log test in database
- Display error details if failed

### Task 9: Test Chat Interface (2-3 hours)

**Purpose:** Test the AI as if you're a customer

**Features:**

- Select client to test
- Chat interface (similar to widget)
- Debug mode toggle:
  - Show raw LLM responses
  - Show tool call logs
  - Show token counts
  - Show execution times
- Clear conversation button
- Export conversation button

**Implementation:**

- Reuse chat components from widget
- Call same `/chat/message` endpoint
- Add debug overlay showing backend logs
- Show tool execution in real-time

### Task 10: Analytics & Reporting (Optional - 2 hours)

**Dashboard Enhancements:**

- More detailed charts
- Export reports as PDF
- Email daily summaries
- Cost tracking per client
- Performance metrics (response times)

## Development Commands

```bash
# Start backend (Terminal 1)
cd backend
npm start

# Start widget dev server (Terminal 2)
cd frontend/widget
npm run dev

# Start admin dashboard (Terminal 3)
cd frontend/admin
npm run dev

# Build admin for production
cd frontend/admin
npm run build
```

## Design Guidelines

**UI/UX:**

- Clean, modern interface (inspired by Vercel, Linear)
- Dark mode option
- Responsive (desktop-first, but works on tablet)
- Fast loading with skeleton loaders
- Toast notifications for actions (success/error)
- Keyboard shortcuts for power users

**Colors (Tailwind):**

- Primary: Blue (600)
- Success: Green (500)
- Warning: Yellow (500)
- Error: Red (500)
- Background: Gray (50 light, 900 dark)

**Navigation:**

- Sidebar with icons and labels
- Breadcrumbs for deep pages
- Search bar for global search

## Security Considerations

1. **JWT Tokens:**

   - Short expiration (1 hour)
   - Refresh token mechanism
   - Stored in httpOnly cookies (if possible) or localStorage

2. **API Validation:**

   - Validate all inputs
   - SQL injection prevention (use parameterized queries)
   - Rate limiting on admin endpoints

3. **CORS:**

   - Restrict admin API to `localhost:3002` (dev) or admin domain (prod)

4. **Password Security:**
   - Bcrypt with salt rounds = 10
   - Minimum 8 characters
   - Password reset flow (future)

## Success Criteria

✅ Admin can log in with username/password
✅ Admin can view all clients in a table
✅ Admin can create new client and auto-generate API key
✅ Admin can view and configure tools for each client
✅ Admin can view conversation transcripts
✅ Admin can test tools manually
✅ Admin can add/test integrations
✅ Dashboard shows real-time stats
✅ Test chat interface works like the widget
✅ All pages are responsive and fast
✅ JWT authentication works properly

## Testing Checklist

- [ ] Create a new client via admin
- [ ] Generate and copy API key
- [ ] Enable tools for the client
- [ ] Test a tool manually
- [ ] View conversations from widget usage
- [ ] Add a Shopify integration
- [ ] Test the integration connection
- [ ] Use test chat to verify client setup
- [ ] Export a conversation as JSON
- [ ] Dashboard stats update in real-time
- [ ] Logout and login again
- [ ] Try accessing protected routes without token (should fail)

## First Steps

1. Create `frontend/admin/` directory
2. Initialize React + Vite project
3. Install Tailwind CSS and dependencies
4. Set up project structure (components, pages, services)
5. Create basic Layout with Header and Sidebar
6. Implement login page and auth flow
7. Create admin API routes in backend
8. Build dashboard overview page
9. Implement client management (list + create)
10. Continue with tools, conversations, integrations

## Important Notes

- **Authentication First**: Build auth system before any other features
- **Reuse Components**: Extract common UI components (Button, Input, Modal)
- **Mock Data Initially**: Use mock data to build UI, then connect to API
- **Incremental Development**: Build one page at a time, test thoroughly
- **Mobile Later**: Focus on desktop experience first, make responsive after

## Phase 5 Deliverable

A fully functional admin dashboard where you can:

1. Manage multiple clients
2. Configure tools and integrations per client
3. Monitor all conversations
4. Test the AI system
5. View analytics and usage stats

**Estimated Time**: 20-25 hours (Week 6-7)

---

## Ready to Begin?

Once you're ready to start Phase 5, I'll help you:

1. Set up the React + Vite project
2. Install and configure Tailwind CSS
3. Create the authentication system
4. Build the admin API endpoints
5. Implement each page step-by-step

The admin dashboard will be the control center for your entire platform! 🎯

# Phase 5: Admin Dashboard - Implementation Request

## Context

Phases 1-4 of the AI Customer Service Agent platform are  
 **complete and operational**:

- ✅ **Phase 1**: Database schema (9 tables), models,  
  migrations, Redis caching
- ✅ **Phase 2**: AI engine with Ollama (Hermes-2-Pro)  
  and Claude support, conversation management
- ✅ **Phase 3**: Tool execution system, n8n
  integration, chat API endpoints
- ✅ **Phase 4**: Embeddable chat widget (Vanilla JS +  
  Vite), Shadow DOM, mobile responsive

**Current Stack:**

- Backend: Node.js/Express on port 3000
- Database: PostgreSQL + Redis (Docker)
- LLM: Hermes-2-Pro-Mistral-7B via Ollama (tool calling  
  working perfectly)
- Tools: n8n webhooks at port 5678 (3 demo tools
  implemented)
- Widget: Vanilla JS, served on port 3001 at
  http://localhost:3001/demo.html

**Demo Client**: Bob's Pizza Shop (API key:
`bobs_pizza_api_key_123`)

**Platform**: Windows PowerShell (NOT WSL)

## Phase 5 Goal

Build an **Admin Dashboard** (React + Tailwind) to
manage the entire platform:

- Manage clients (CRUD operations)
- Configure tools per client
- Monitor conversations
- Test integrations
- View analytics

## Technical Requirements

**Tech Stack for Admin Dashboard:**

- React 18 with Vite
- Tailwind CSS for styling
- React Router for navigation
- React Hook Form for forms
- Recharts for analytics
- JWT authentication
- Axios for HTTP requests

**Server Port**: 3002 (widget on 3001, admin on 3002)

## Key Features to Implement

### 1. Authentication System

- Admin login page (username/password)
- JWT token generation and verification
- Protected routes
- Logout functionality
- Migration for `admins` table
- Default credentials: admin/admin123

### 2. Client Management

- List all clients (table with search/filter)
- Create new client (auto-generate API key)
- Edit client details
- View client stats
- Deactivate client

### 3. Tool Configuration

- List tools for each client
- Enable/disable tools per client
- Configure n8n webhook URLs
- Test tool execution manually
- View tool execution logs

### 4. Conversation Monitor

- View all conversations (paginated, filterable)
- Read conversation transcripts
- See tool calls and results
- Export conversations (CSV/JSON)

### 5. Integration Manager

- Add/edit/test client integrations (Shopify,
  WooCommerce, etc.)
- Test connection to external APIs
- View integration logs
- Configure endpoints

### 6. Dashboard Overview

- Stats cards (total clients, conversations today, tool  
  calls, tokens used)
- Charts (conversations over time, tool usage breakdown)
- Recent activity feed

### 7. Test Chat Interface

- Test AI as a customer
- Select client to test
- Debug mode (show raw responses, tool logs, tokens)
- Export test conversations

## Backend API Endpoints Needed

Create new routes in `backend/src/routes/admin.js`:

**Auth:**

```javascript
POST /admin/login
POST /admin/logout
GET  /admin/verify

Clients:
GET    /admin/clients
GET    /admin/clients/:id
POST   /admin/clients
PUT    /admin/clients/:id
DELETE /admin/clients/:id
POST   /admin/clients/:id/api-key  // Regenerate API key

Tools:
GET    /admin/clients/:clientId/tools
POST   /admin/clients/:clientId/tools
PUT    /admin/clients/:clientId/tools/:id
DELETE /admin/clients/:clientId/tools/:id
POST   /admin/tools/:id/test

Conversations:
GET /admin/conversations
GET /admin/conversations/:id
GET /admin/conversations/export
GET /admin/stats/conversations

Integrations:
GET    /admin/clients/:clientId/integrations
POST   /admin/clients/:clientId/integrations
PUT    /admin/integrations/:id
DELETE /admin/integrations/:id
POST   /admin/integrations/:id/test

Analytics:
GET /admin/stats/overview
GET /admin/stats/usage/:clientId
GET /admin/stats/tools

Directory Structure

frontend/admin/
├── src/
│   ├── components/
│   │   ├── layout/       (Header, Sidebar, Layout)
│   │   ├── clients/      (ClientList, ClientForm,
ClientCard)
│   │   ├── tools/        (ToolList, ToolForm, ToolTest)
│   │   ├── conversations/(ConversationList,
ConversationView)
│   │   ├── integrations/ (IntegrationList,
IntegrationForm)
│   │   └── common/       (Button, Input, Modal,
LoadingSpinner)
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Clients.jsx
│   │   ├── ClientDetail.jsx
│   │   ├── Tools.jsx
│   │   ├── Conversations.jsx
│   │   ├── Integrations.jsx
│   │   └── TestChat.jsx
│   ├── services/
│   │   ├── api.js
│   │   └── auth.js
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── App.jsx
│   └── main.jsx
├── package.json
├── vite.config.js
└── tailwind.config.js

Implementation Steps

1. Create frontend/admin/ directory and initialize React
 + Vite
2. Install dependencies: react-router-dom, axios,
react-hook-form, recharts, tailwindcss
3. Set up Tailwind CSS configuration
4. Create backend admin routes and JWT auth middleware
5. Create admins table migration and Admin model
6. Build login page and AuthContext
7. Create Layout with Header and Sidebar
8. Build Dashboard page with stats
9. Implement Client Management pages
10. Build Tool Configuration interface
11. Create Conversation Monitor
12. Implement Integration Manager
13. Build Test Chat interface

Success Criteria

✅ Admin can log in with JWT authentication
✅ Admin can create/edit/view clients
✅ Admin can enable/disable tools per client
✅ Admin can view conversation transcripts
✅ Admin can test tools manually
✅ Dashboard shows real-time analytics
✅ Test chat works like the widget (with debug mode)
✅ All pages are responsive and styled with Tailwind
✅ Protected routes work properly

Important Files to Reference

- backend/src/routes/chat.js - Example of protected
routes with auth middleware
- backend/src/models/Client.js - Model pattern to follow
 for Admin model
- frontend/widget/src/api.js - API client pattern to
follow
- backend/src/services/conversationService.js - Service
layer pattern

First Steps

1. Create frontend/admin/ directory
2. Initialize React project: npm create vite@latest . --
 --template react
3. Install Tailwind: npm install -D tailwindcss postcss
autoprefixer && npx tailwindcss init -p
4. Install dependencies: npm install react-router-dom
axios react-hook-form recharts
5. Create basic Layout component with Header and Sidebar
6. Set up React Router with protected routes
7. Build login page
8. Create admin API routes in backend
9. Implement JWT authentication
10. Build dashboard one page at a time

Development Commands

# Start backend (Terminal 1)
cd backend && npm start

# Start widget (Terminal 2)
cd frontend/widget && npm run dev

# Start admin dashboard (Terminal 3)
cd frontend/admin && npm run dev

Please begin Phase 5 implementation. Start with project
setup and authentication, then work through each feature
 systematically. Let me know when major components are
complete for review and testing.
```
