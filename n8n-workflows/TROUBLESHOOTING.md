# n8n Webhook Troubleshooting Guide

## Issue: Webhook Returns 404 "Not Registered"

If you get an error like:
```
{"code":404,"message":"This webhook is not registered for POST requests"}
```

**Common Causes & Solutions:**

### 1. Workflow Not Active ⚠️ MOST COMMON

**Problem**: The workflow is imported but not activated.

**Solution**:
1. Open n8n (http://localhost:5678)
2. Open each workflow
3. Check the toggle in the top-right corner
4. Make sure it's **GREEN/ON** (not gray/off)
5. If it's off, click it to turn it on
6. Save the workflow

### 2. Workflow Never Executed

**Problem**: n8n webhooks don't register until the workflow runs at least once.

**Solution**:
1. Open the workflow in n8n
2. Click the "Execute Workflow" button (play icon at bottom)
3. Wait for it to complete
4. The webhook should now be registered

### 3. Wrong HTTP Method

**Problem**: The webhook node is configured for GET instead of POST.

**Solution**:
1. Open the workflow in n8n
2. Click on the "Webhook" node
3. Check "HTTP Method" setting
4. Should be set to "POST" (or "ALL")
5. Save and reactivate the workflow

### 4. Webhook Path Mismatch

**Problem**: The path in n8n doesn't match what's in the database.

**Expected Paths** (n8n production mode):
- `get_order_status`
- `book_appointment`
- `check_inventory`

**Full URLs**:
- `http://localhost:5678/webhook/get_order_status`
- `http://localhost:5678/webhook/book_appointment`
- `http://localhost:5678/webhook/check_inventory`

**Note**: n8n automatically adds `/webhook/` prefix to your path, so just use the tool name as the path.

**Solution**:
1. Open each workflow
2. Click the Webhook node
3. Check the "Path" field
4. It should be: `get_order_status` (not `webhook/get_order_status` or `/webhook/get_order_status`)
5. Save and reactivate

### 5. n8n Restart Needed

**Problem**: Sometimes n8n needs a restart to register webhooks.

**Solution**:
```powershell
docker restart docker-n8n-1
```

Wait 10-15 seconds for n8n to start up, then test again.

### 6. Database URLs Don't Match

**Problem**: The URLs in your database don't match n8n's actual webhook URLs.

**Solution**:
Run the setup script again to update URLs:
```powershell
docker exec -i docker-postgres-1 psql -U aiuser -d aiclient < n8n-workflows/setup_tools.sql
```

---

## How to Check Webhook Configuration in n8n

1. Open http://localhost:5678
2. Go to **Workflows** (left sidebar)
3. Open each workflow (Get Order Status, Book Appointment, Check Inventory)
4. For each workflow, verify:
   - ✅ Toggle is **GREEN/ON** (top right)
   - ✅ Webhook node path is set correctly
   - ✅ HTTP Method is "POST" or "ALL"
   - ✅ "Respond" node is set to "JSON"

---

## Manual Webhook Test

Test each webhook URL directly:

### Test get_order_status:
```powershell
curl -X POST http://localhost:5678/webhook/get_order_status `
  -H "Content-Type: application/json" `
  -d '{"orderNumber": "12345"}'
```

Expected: JSON response with order status

### Test check_inventory:
```powershell
curl -X POST http://localhost:5678/webhook/check_inventory `
  -H "Content-Type: application/json" `
  -d '{"productName": "pepperoni-pizza"}'
```

Expected: JSON response with stock info

### Test book_appointment:
```powershell
curl -X POST http://localhost:5678/webhook/book_appointment `
  -H "Content-Type: application/json" `
  -d '{
    "date": "2025-01-20",
    "time": "14:00",
    "serviceType": "consultation",
    "customerName": "Test User",
    "customerEmail": "test@example.com"
  }'
```

Expected: JSON response with appointment confirmation

---

## Common n8n Configuration Mistakes

### ❌ WRONG: Test Mode URLs
```
http://localhost:5678/webhook-test/get_order_status
```
Test webhooks only work for one call after clicking "Execute Workflow"

### ✅ CORRECT: Production URLs
```
http://localhost:5678/webhook/get_order_status
```
Production webhooks work all the time when workflow is active

---

## Webhook Node Configuration Checklist

For each workflow's Webhook node:

```
Path: get_order_status (just the tool name, n8n adds /webhook/ automatically)
HTTP Method: POST (or ALL)
Authentication: None
Response Mode: Using 'Respond to Webhook' Node
Response Code: 200
```

---

## Quick Fix: Re-import Workflows

If nothing works, try reimporting:

1. **Delete existing workflows** in n8n
2. **Re-import** each JSON file from `n8n-workflows/`
3. **Configure** webhook nodes if needed:
   - Path: `webhook/<tool_name>`
   - Method: POST
4. **Activate** workflows (green toggle)
5. **Execute** each workflow once
6. **Test** with curl

---

## Still Not Working?

### Check n8n Logs:
```powershell
docker logs docker-n8n-1 --tail 50
```

Look for errors related to webhooks or workflow activation.

### Restart Everything:
```powershell
# Stop services
npm run dockerdown

# Start services
npm run dockerup

# Wait 30 seconds for everything to start

# Re-run setup
docker exec -i docker-postgres-1 psql -U aiuser -d aiclient < n8n-workflows/setup_tools.sql
```

### Verify n8n is Running:
```powershell
curl http://localhost:5678/healthz
```

Should return: `{"status":"ok"}`

---

## Contact/Help

If you're still having issues:
1. Check n8n logs for specific errors
2. Verify workflows are active (green toggle)
3. Make sure you clicked "Execute Workflow" at least once
4. Restart n8n container
5. Check the PHASE_3_QUICKSTART.md for step-by-step setup

Most webhook issues are solved by:
- ✅ Activating the workflow (green toggle)
- ✅ Executing the workflow once (click Execute button)
- ✅ Using production URLs (not test URLs)
