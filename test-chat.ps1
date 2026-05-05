# Test Script para IA Chat Local - PowerShell
# Sin autenticación, sin SQL — solo IA

Write-Host "🧪 Iniciando tests para IA Chat..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Checks
Write-Host "📍 Test 1: Health Checks" -ForegroundColor Green

Write-Host "├─ Backend health..."
try {
  $backendHealth = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing
  Write-Host "✅ Backend: $($backendHealth.StatusCode)"
} catch {
  Write-Host "❌ Backend no responde" -ForegroundColor Red
}

Write-Host ""
Write-Host "├─ Gateway health..."
try {
  $gatewayHealth = Invoke-WebRequest -Uri "http://localhost:4000/health" -UseBasicParsing
  Write-Host "✅ Gateway: $($gatewayHealth.StatusCode)"
} catch {
  Write-Host "❌ Gateway no responde" -ForegroundColor Red
}

Write-Host ""

# Test 2: Chat Directo (Gateway)
Write-Host "📍 Test 2: Chat Directo en Gateway" -ForegroundColor Green
Write-Host "├─ Pregunta: 'Hola, ¿quién eres?'"

try {
  $chatPayload = @{
    message = "Hola, ¿quién eres?"
  } | ConvertTo-Json

  $chatResponse = Invoke-WebRequest -Uri "http://localhost:4000/chat-direct" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body $chatPayload `
    -UseBasicParsing

  $responseData = $chatResponse.Content | ConvertFrom-Json
  Write-Host "✅ Response:" -ForegroundColor Green
  Write-Host "   Type: $($responseData.type)"
  Write-Host "   Source: $($responseData.source)"
  Write-Host "   Message: $($responseData.response.Substring(0, [Math]::Min(100, $responseData.response.Length)))..."
} catch {
  Write-Host "❌ Gateway /chat-direct no responde: $_" -ForegroundColor Red
}

Write-Host ""

# Test 3: Chat Backend
Write-Host "📍 Test 3: Chat Backend (pasa a Gateway)" -ForegroundColor Green
Write-Host "├─ Pregunta: 'Cuéntame sobre Novasoft'"

try {
  $backendPayload = @{
    message = "Cuéntame sobre Novasoft"
    context = @{}
  } | ConvertTo-Json

  $backendResponse = Invoke-WebRequest -Uri "http://localhost:3000/chat" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body $backendPayload `
    -UseBasicParsing

  $responseData = $backendResponse.Content | ConvertFrom-Json
  Write-Host "✅ Response:" -ForegroundColor Green
  Write-Host "   Type: $($responseData.type)"
  Write-Host "   Source: $($responseData.source)"
  Write-Host "   Message: $($responseData.response.Substring(0, [Math]::Min(100, $responseData.response.Length)))..."
} catch {
  Write-Host "❌ Backend /chat no responde: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "✅ Tests completados" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 Accede a http://localhost:5173 para probar el chat en la UI" -ForegroundColor Yellow
