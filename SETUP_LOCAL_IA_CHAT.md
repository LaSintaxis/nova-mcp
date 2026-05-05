# Setup de IA Chat Local - Sin Autenticación

## Estado Actual

✅ **Conectado y Funcional:**
- Backend `/chat` endpoint → Gateway `/chat-direct` (IA sin SQL)
- Frontend Chat.jsx → Backend (sin token)
- MessageBubble.jsx renderiza usuario + IA responses
- Azure OpenAI integration lista en gateway
- MessageList y MessageInput componentes funcionales

❌ **Temporalmente Deshabilitado:**
- Autenticación (MSAL/Entra ID) - Código comentado
- mcp-sql integration - Pasado por alto en `/chat-direct`
- Context-resolver - No usado en `/chat-direct`

---

## Arquitectura Actual (Modo Local)

```
Frontend (React/Vite)
    ↓ POST /chat
Backend (Express:3000)
    ↓ POST /chat-direct
Gateway (Express:4000)
    ↓ llamaAzureOpenAI()
Azure OpenAI (gpt-4.1-mini)
    ↓ response
Frontend MessageBubble
```

---

## Flujo del Chat

1. **Usuario escribe mensaje** en `MessageInput.jsx`
2. **Chat.jsx maneja envío:**
   - Agrega mensaje usuario a `messages[]`
   - Hace POST a `http://localhost:3000/chat`
   - Sin token (auth comentada)

3. **Backend recibe en `/chat`:**
   - Extrae `message` del request
   - Hace POST a `http://gateway:4000/chat-direct`
   - Devuelve response.json()

4. **Gateway en `/chat-direct`:**
   - Recibe mensaje
   - Llama a Azure OpenAI directamente
   - Retorna `{ type: "success", response: "IA response", source: "ai-direct" }`

5. **Chat.jsx procesa respuesta:**
   - Detecta `data.source === 'ai-direct'`
   - Usa `data.response` como contenido
   - Agrega mensaje assistant a `messages[]`

6. **MessageBubble renderiza:**
   - User messages con estilo user
   - Assistant messages con estilo assistant
   - Soporta saltos de línea

---

## Variables de Entorno Necesarias

### `gateway/.env`
```env
AZURE_OPENAI_ENDPOINT=https://...
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT=gpt-4.1-mini
AZURE_OPENAI_API_VERSION=2024-12-01-preview
MCP_SQL_URL=http://mcp-sql:5000
```

### `backend/.env`
```env
TENANT_ID=...
CLIENT_ID=...
JWT_SECRET=temporal-secret
```

### `frontend/.env`
```env
VITE_BACKEND_URL=http://localhost:3000
VITE_GATEWAY_URL=http://localhost:4000
```

---

## Cómo Ejecutar

### Opción 1: Docker Compose (Recomendado)
```bash
docker compose up -d
# Frontend: http://localhost:5173
# Backend: http://localhost:3000
# Gateway: http://localhost:4000
```

### Opción 2: Local Development
```bash
# Terminal 1 - Frontend
cd frontend
npm install
npm run dev

# Terminal 2 - Backend
cd backend
npm install
node src/index.js

# Terminal 3 - Gateway
cd gateway
npm install
node src/index.js

# Terminal 4 - mcp-sql (si quieres SQL después)
cd mcp-sql
npm install
node src/index.js
```

---

## Testing

### Test 1: Health Checks
```bash
curl http://localhost:3000/health     # Backend
curl http://localhost:4000/health     # Gateway
```

### Test 2: Chat Directo (sin Frontend)
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hola, ¿quién eres?", "context":{}}'
```

### Test 3: Chat Directo en Gateway
```bash
curl -X POST http://localhost:4000/chat-direct \
  -H "Content-Type: application/json" \
  -d '{"message":"Cuéntame sobre Novasoft"}'
```

### Test 4: UI Chat
1. Abre http://localhost:5173
2. Salta el login (código comentado)
3. Escribe mensaje en chat
4. Debería aparecer respuesta IA

---

## Archivos Modificados

### `backend/src/index.js`
- ✅ Auth comentada (líneas 45-84)
- ✅ Mock user agregado (línea 95)
- ✅ `/chat` endpoint actualizado a llamar `/chat-direct` (línea 130)

### `gateway/src/index.js`
- ✅ `/chat-direct` endpoint creado (línea 159-189)
- ✅ Usa `callAzureOpenAIChatCompletion()` existente
- ✅ Devuelve `{ type: "success", response, source: "ai-direct" }`

### `frontend/src/pages/Chat.jsx`
- ✅ `handleSend()` mejorado (línea 66-162)
- ✅ Detecta `data.source === 'ai-direct'`
- ✅ Usa `data.response` como contenido IA

### `frontend/src/components/MessageBubble.jsx`
- ✅ Ya renderiza user + assistant messages
- ✅ Soporta saltos de línea
- ✅ Metadata opcional

---

## Próximos Pasos (Cuando agregues Auth/SQL)

1. **Descomentar auth en `backend/src/index.js`**
   - Quitar comentarios del middleware `authenticateToken`
   - Agregar `authenticateToken` a la ruta `/chat`

2. **Agregar endpoint `/execute` completo en `gateway`**
   - Llamar a `context-resolver`
   - Generar SQL con Azure OpenAI
   - Ejecutar en mcp-sql

3. **Conectar mcp-sql**
   - Implementar query executor
   - Validar credenciales de BD
   - Retornar resultados formateados

4. **Descomentar MSAL en `frontend/src/pages/Chat.jsx`**
   - Activar `useMsal()`
   - Obtener token con `acquireTokenSilent()`
   - Incluir en Authorization header

---

## Notas Importantes

- El prompt de IA está en `gateway/src/index.js` línea 171
- Puedes modificar el prompt para cambiar comportamiento
- MessageBubble soporta `chartData` (cuando SQL esté listo)
- `MetricsChart.jsx` renderiza gráficas si `message.chartData` existe
- Auth está **comentada pero no eliminada** — lista para descomentar

---

## Troubleshooting

### "Error al comunicarse con el gateway"
→ Verifica que gateway esté corriendo en puerto 4000

### "No se pudo obtener token"
→ Normal en modo prueba (auth comentada)

### Respuesta vacía de IA
→ Verifica Azure OpenAI credentials en `gateway/.env`

### Docker no puede alcanzar gateway
→ Usa `docker compose config` para verificar servicios

