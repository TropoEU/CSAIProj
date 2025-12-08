# n8n Demo Workflows

This directory contains demo n8n workflows for Phase 3 of the AI Customer Service Agent platform.

## Available Workflows

### 1. Get Order Status (`get_order_status.json`)
- **Purpose**: Check the status of a customer order
- **Webhook Path**: `/webhook/get_order_status`
- **Parameters**:
  - `orderNumber` (required): Order number to look up
- **Mock Data**: Contains 3 sample orders (12345, 12346, 12347)

### 2. Book Appointment (`book_appointment.json`)
- **Purpose**: Book an appointment for a customer
- **Webhook Path**: `/webhook/book_appointment`
- **Parameters**:
  - `date` (required): Appointment date (YYYY-MM-DD)
  - `time` (required): Appointment time (HH:MM)
  - `serviceType` (required): Type of service
  - `customerName` (required): Customer name
  - `customerEmail` (optional): Customer email
  - `customerPhone` (optional): Customer phone
- **Features**: Mock availability checking, generates confirmation IDs

### 3. Check Inventory (`check_inventory.json`)
- **Purpose**: Check product availability and stock levels
- **Webhook Path**: `/webhook/check_inventory`
- **Parameters**:
  - `productName` (optional): Product name
  - `productSku` (optional): Product SKU
  - `quantity` (optional): Quantity needed (default: 1)
- **Mock Data**: Contains sample pizza and side items

## Setup Instructions

### Step 1: Import Workflows into n8n

1. Make sure n8n is running:
   ```powershell
   npm run dockerup
   ```

2. Open n8n in your browser:
   ```
   http://localhost:5678
   ```

3. Log in with credentials from `.env`:
   - Username: `admin`
   - Password: `changeme`

4. Import each workflow:
   - Click "Add Workflow" or use the "+" button
   - Click the three dots menu (⋮) in the top right
   - Select "Import from File"
   - Choose one of the JSON files from this directory
   - Click "Save" to activate the workflow

5. Repeat for all three workflows

### Step 2: Verify Webhook URLs

After importing, verify that each workflow has the correct webhook path:
- Get Order Status: `http://localhost:5678/webhook/get_order_status`
- Book Appointment: `http://localhost:5678/webhook/book_appointment`
- Check Inventory: `http://localhost:5678/webhook/check_inventory`

### Step 3: Set Up Database

Run the SQL setup script to add tools to the database:

```powershell
# Connect to Postgres
docker exec -it docker-postgres-1 psql -U aiuser -d aiclient

# In psql, run:
\i /path/to/setup_tools.sql
```

Or pipe the file directly:

```powershell
Get-Content setup_tools.sql | docker exec -i docker-postgres-1 psql -U aiuser -d aiclient
```

### Step 4: Test Webhooks

Test each webhook manually with curl:

**Get Order Status:**
```powershell
curl -X POST http://localhost:5678/webhook/get_order_status `
  -H "Content-Type: application/json" `
  -d '{"orderNumber": "12345"}'
```

**Book Appointment:**
```powershell
curl -X POST http://localhost:5678/webhook/book_appointment `
  -H "Content-Type: application/json" `
  -d '{
    "date": "2025-01-20",
    "time": "14:00",
    "serviceType": "consultation",
    "customerName": "John Doe",
    "customerEmail": "john@example.com"
  }'
```

**Check Inventory:**
```powershell
curl -X POST http://localhost:5678/webhook/check_inventory `
  -H "Content-Type: application/json" `
  -d '{"productName": "pepperoni-pizza", "quantity": 2}'
```

## Testing with the AI Agent

Once setup is complete, you can test the full integration:

```powershell
# Start the backend
npm start

# In another terminal, send a message:
curl -X POST http://localhost:3000/chat/message `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer bobs_pizza_api_key_123" `
  -d '{
    "sessionId": "test-session-1",
    "message": "What is the status of my order 12345?"
  }'
```

The AI should:
1. Recognize the need to use `get_order_status`
2. Call the n8n webhook with `orderNumber: "12345"`
3. Receive the order status from the workflow
4. Format a natural language response for the user

## Customizing Workflows

### Adding Real API Integrations

To connect to real systems, replace the "Code" node with actual API calls:

1. **For Shopify**: Use the Shopify node
2. **For WooCommerce**: Use the HTTP Request node
3. **For Custom APIs**: Use the HTTP Request node with authentication

### Example: Replace Mock with Real API

In the Code node, replace:
```javascript
const orders = {
  '12345': { ... }
};
```

With an HTTP Request node:
- Method: GET
- URL: `https://yourstore.com/api/orders/{{ $json.orderNumber }}`
- Authentication: API Key / OAuth / Basic Auth

## Troubleshooting

### Workflow Not Responding

1. Check that workflow is active (toggle in top right should be green)
2. Verify webhook path matches database configuration
3. Check n8n logs: `docker logs docker-n8n-1`

### Tool Not Found Error

1. Verify tool exists in database: `SELECT * FROM tools;`
2. Check tool is enabled for client: `SELECT * FROM client_tools WHERE client_id = 1;`
3. Verify webhook URL is correct in `client_tools` table

### Timeout Errors

1. Check n8n is running: `npm run check:connections`
2. Increase timeout in `n8nService.js` (default: 30s)
3. Optimize workflow (remove delays, simplify logic)

## Next Steps

After Phase 3 is complete:

1. **Add More Tools**: Create workflows for common customer service tasks
2. **Real Integrations**: Replace mock data with actual API calls
3. **Error Handling**: Add error handling nodes in workflows
4. **Monitoring**: Set up n8n webhook error notifications
5. **Authentication**: Add API key verification in webhooks if needed

## Resources

- [n8n Documentation](https://docs.n8n.io/)
- [n8n Webhook Trigger](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [n8n Code Node](https://docs.n8n.io/code-examples/expressions/)
