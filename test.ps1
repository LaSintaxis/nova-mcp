# Test script para validar toda la arquitectura

Write-Host "`n🚀 INICIANDO TESTS DEL SISTEMA MCP-NOVASOFT" -ForegroundColor Green

# Test 1: Health Checks
Write-Host "`n--- 1. HEALTH CHECKS ---" -ForegroundColor Cyan

try {
    $backend = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ Backend: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend: OFFLINE" -ForegroundColor Red
}

try {
    $gateway = Invoke-WebRequest -Uri "http://localhost:4000/health" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ Gateway: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Gateway: OFFLINE" -ForegroundColor Red
}

try {
    $sql = Invoke-WebRequest -Uri "http://localhost:5000/health" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ SQL Connector: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ SQL Connector: OFFLINE" -ForegroundColor Red
}

try {
    $resolver = Invoke-WebRequest -Uri "http://localhost:6000/health" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ Context Resolver: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Context Resolver: OFFLINE" -ForegroundColor Red
}

# Test 2: SQL Connector Admin
Write-Host "`n--- 2. SQL CONNECTOR ADMIN ---" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/databases/all" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ List all databases: OK" -ForegroundColor Green
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host "❌ List all databases: FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Test 3: Fast-Path Router
Write-Host "`n--- 3. FAST-PATH ROUTER (Gateway) ---" -ForegroundColor Cyan

try {
    $payload = @{
        message = "¿Cuáles son las bases de datos disponibles?"
        context = @{}
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "http://localhost:4000/execute" `
        -Method POST `
        -ContentType "application/json" `
        -Body $payload `
        -TimeoutSec 10 `
        -ErrorAction Stop

    Write-Host "✅ Fast-path (list databases): OK" -ForegroundColor Green
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host "❌ Fast-path: FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Test 4: SQL Query
Write-Host "`n--- 4. SQL QUERY ---" -ForegroundColor Cyan

try {
    $payload = @{
        message = "¿Cuántos clientes hay?"
        context = @{
            history = @()
        }
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "http://localhost:4000/execute" `
        -Method POST `
        -ContentType "application/json" `
        -Body $payload `
        -TimeoutSec 10 `
        -ErrorAction Stop

    Write-Host "✅ SQL Query: OK" -ForegroundColor Green
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host "❌ SQL Query: FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Test 5: Chat (General)
Write-Host "`n--- 5. CHAT (General) ---" -ForegroundColor Cyan

try {
    $payload = @{
        message = "Hola, ¿cómo estás?"
        context = @{
            history = @()
        }
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "http://localhost:4000/execute" `
        -Method POST `
        -ContentType "application/json" `
        -Body $payload `
        -TimeoutSec 10 `
        -ErrorAction Stop

    Write-Host "✅ Chat: OK" -ForegroundColor Green
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host "❌ Chat: FAILED" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n✅ TESTS COMPLETADOS" -ForegroundColor Green
