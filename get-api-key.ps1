# Get API Key from Database
# This script retrieves the Bob's Pizza Shop API key for testing

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Retrieving API Key from Database" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$query = "SELECT name, api_key, status FROM clients WHERE name LIKE '%Bob%' OR name LIKE '%Pizza%';"

$result = docker exec -i docker-postgres-1 psql -U aiuser -d aiclient -t -A -F"," -c $query

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to connect to database" -ForegroundColor Red
    Write-Host "Make sure Docker containers are running: npm run dockerup" -ForegroundColor Yellow
    exit 1
}

if ([string]::IsNullOrWhiteSpace($result)) {
    Write-Host "No client found in database." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Run the setup script first:" -ForegroundColor Yellow
    Write-Host "  Get-Content n8n-workflows/setup_tools.sql | docker exec -i docker-postgres-1 psql -U aiuser -d aiclient" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "Client Information:" -ForegroundColor Green
Write-Host "==================" -ForegroundColor Green
Write-Host ""

$lines = $result -split "`n"
foreach ($line in $lines) {
    if (![string]::IsNullOrWhiteSpace($line)) {
        $parts = $line -split ","
        if ($parts.Count -ge 3) {
            Write-Host "Client Name: " -NoNewline -ForegroundColor White
            Write-Host $parts[0] -ForegroundColor Cyan
            Write-Host "API Key:     " -NoNewline -ForegroundColor White
            Write-Host $parts[1] -ForegroundColor Yellow
            Write-Host "Status:      " -NoNewline -ForegroundColor White
            Write-Host $parts[2] -ForegroundColor Green
            Write-Host ""
        }
    }
}

Write-Host "Use this API key in your curl commands:" -ForegroundColor Cyan
Write-Host '  -H "Authorization: Bearer <API_KEY>"' -ForegroundColor White
Write-Host ""
