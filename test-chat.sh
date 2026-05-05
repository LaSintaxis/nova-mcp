#!/bin/bash

# Test Script para IA Chat Local
# Sin autenticación, sin SQL — solo IA

echo "🧪 Iniciando tests para IA Chat..."
echo ""

# Test 1: Health Checks
echo "📍 Test 1: Health Checks"
echo "├─ Backend health..."
curl -s http://localhost:3000/health | jq . || echo "❌ Backend no responde"
echo ""
echo "├─ Gateway health..."
curl -s http://localhost:4000/health | jq . || echo "❌ Gateway no responde"
echo ""

# Test 2: Chat Directo (Gateway)
echo "📍 Test 2: Chat Directo en Gateway"
echo "├─ Pregunta: 'Hola, ¿quién eres?'"
curl -s -X POST http://localhost:4000/chat-direct \
  -H "Content-Type: application/json" \
  -d '{"message":"Hola, ¿quién eres?"}' | jq . || echo "❌ Gateway /chat-direct no responde"
echo ""

# Test 3: Chat Backend
echo "📍 Test 3: Chat Backend (pasa a Gateway)"
echo "├─ Pregunta: 'Cuéntame sobre Novasoft'"
curl -s -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Cuéntame sobre Novasoft", "context":{}}' | jq . || echo "❌ Backend /chat no responde"
echo ""

echo "✅ Tests completados"
echo ""
echo "Accede a http://localhost:5173 para probar el chat en la UI"
