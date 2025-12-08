# Check Webhook Configuration
# This script tests n8n webhooks and shows configured URLs

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Checking Webhook Configuration" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Get webhook URLs from database
$query = @"
SELECT
    t.tool_name,
    ct.n8n_webhook_url,
    ct.enabled
FROM client_tools ct
JOIN tools t ON ct.tool_id = t.id
JOIN clients c ON ct.client_id = c.id
WHERE c.name LIKE '%Bob%'
ORDER BY t.tool_name;
"@

Write-Host "Configured Webhooks:" -ForegroundColor Green
Write-Host "====================" -ForegroundColor Green
Write-Host ""

$result = docker exec -i docker-postgres-1 psql -U aiuser -d aiclient -t -A -F"|" -c $query

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to connect to database" -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrWhiteSpace($result)) {
    Write-Host "No webhooks configured." -ForegroundColor Yellow
    Write-Host "Run the setup script first." -ForegroundColor Yellow
    exit 1
}

$lines = $result -split "`n"
foreach ($line in $lines) {
    if (![string]::IsNullOrWhiteSpace($line)) {
        $parts = $line -split "\|"
        if ($parts.Count -ge 3) {
            $toolName = $parts[0].Trim()
            $webhookUrl = $parts[1].Trim()
            $enabled = $parts[2].Trim()

            Write-Host "Tool: " -NoNewline -ForegroundColor White
            Write-Host $toolName -ForegroundColor Cyan
            Write-Host "URL:  " -NoNewline -ForegroundColor White
            Write-Host $webhookUrl -ForegroundColor Yellow
            Write-Host "Enabled: " -NoNewline -ForegroundColor White
            if ($enabled -eq "t") {
                Write-Host "Yes" -ForegroundColor Green
            } else {
                Write-Host "No" -ForegroundColor Red
            }
            Write-Host ""
        }
    }
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Testing Webhooks" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Test get_order_status webhook
Write-Host "Testing: get_order_status..." -ForegroundColor Yellow

$testUrl = "http://localhost:5678/webhook/get_order_status"
$testBody = '{"orderNumber": "12345"}'

try {
    $response = Invoke-RestMethod -Uri $testUrl -Method Post -Body $testBody -ContentType "application/json" -TimeoutSec 10
    Write-Host "  Status: " -NoNewline
    Write-Host "SUCCESS" -ForegroundColor Green
    Write-Host "  Response: " -NoNewline
    Write-Host ($response | ConvertTo-Json -Compress) -ForegroundColor Gray
} catch {
    Write-Host "  Status: " -NoNewline
    Write-Host "FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test check_inventory webhook
Write-Host "Testing: check_inventory..." -ForegroundColor Yellow

$testUrl = "http://localhost:5678/webhook/check_inventory"
$testBody = '{"productName": "pepperoni-pizza"}'

try {
    $response = Invoke-RestMethod -Uri $testUrl -Method Post -Body $testBody -ContentType "application/json" -TimeoutSec 10
    Write-Host "  Status: " -NoNewline
    Write-Host "SUCCESS" -ForegroundColor Green
    Write-Host "  Response: " -NoNewline
    Write-Host ($response | ConvertTo-Json -Compress) -ForegroundColor Gray
} catch {
    Write-Host "  Status: " -NoNewline
    Write-Host "FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Note: If webhooks fail, check:" -ForegroundColor Cyan
Write-Host "  1. n8n is running (http://localhost:5678)" -ForegroundColor White
Write-Host "  2. Workflows are imported and ACTIVE (green toggle)" -ForegroundColor White
Write-Host "  3. Webhook URLs match the database configuration" -ForegroundColor White
Write-Host ""
