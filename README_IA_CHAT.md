# 🤖 Nova Assistant - IA Chat Local

> Sistema de chat conectado a Azure OpenAI sin autenticación ni SQL. Listo para desarrollo y testing.

## 📌 Estado Actual

| Componente | Estado | Detalles |
|-----------|--------|----------|
| Frontend | ✅ Funcional | React 19 + Vite, UI completa |
| Backend | ✅ Funcional | Express, sin auth (comentada) |
| Gateway | ✅ Funcional | Express, /chat-direct operacional |
| Azure OpenAI | ✅ Conectado | gpt-4.1-mini disponible |
| SQL | 🟡 Preparado | Código listo, mcp-sql no activado |
| Entra ID SSO | 🟡 Comentada | Código disponible, auth deshabilitada |

## 🚀 Iniciar en 3 Comandos

```bash
docker compose up -d              # 1. Iniciar servicios
./test-chat.ps1                   # 2. Verificar (PowerShell)
# Abre http://localhost:5173      # 3. Chat en UI
```

## 📂 Estructura

```
mcp-novasoft/
├── frontend/                      # React 19 + Vite
│   └── src/
│       ├── pages/Chat.jsx         # ← Chat UI
│       └── components/
│           ├── MessageBubble.jsx  # ← Renderiza mensajes
│           ├── MessageList.jsx
│           ├── MessageInput.jsx
│           └── ChatHeader.jsx
├── backend/                       # Express (puerto 3000)
│   └── src/index.js              # ← POST /chat → gateway
├── gateway/                       # Express (puerto 4000)
│   └── src/index.js              # ← POST /chat-direct → OpenAI
├── context-resolver/              # Resolución de contexto (no usado)
├── mcp-sql/                        # Ejecución SQL (no usado)
├── docker-compose.yml
├── QUICK_START.md                 # ← Leer primero
├── SETUP_LOCAL_IA_CHAT.md
├── COMPLETION_SUMMARY.md
└── test-chat.ps1                  # Tests
```

## 🔗 Flujo de Mensajes

```
User escribe mensaje
    ↓
Chat.jsx: handleSend()
    ↓ POST /chat
Backend: /chat endpoint
    ↓ POST /chat-direct
Gateway: /chat-direct endpoint
    ↓ callAzureOpenAI()
Azure OpenAI API (gpt-4.1-mini)
    ↓ response text
Gateway: retorna {type, response, source: ai-direct}
    ↓
Chat.jsx: procesa data.response
    ↓
setMessages() → MessageBubble renderiza
    ↓
Usuario ve respuesta IA en el chat
```

## ⚙️ Configuración Mínima

Crear `gateway/.env`:
```env
AZURE_OPENAI_ENDPOINT=https://[nombre].openai.azure.com/
AZURE_OPENAI_API_KEY=[tu-api-key]
AZURE_OPENAI_DEPLOYMENT=gpt-4.1-mini
AZURE_OPENAI_API_VERSION=2024-12-01-preview
```

Backend y frontend tienen `.env` básicos ya configurados.

## 🧪 Testing

### Verificar Health
```bash
curl http://localhost:3000/health    # Backend
curl http://localhost:4000/health    # Gateway
```

### Test Chat Directo
```bash
curl -X POST http://localhost:4000/chat-direct \
  -H "Content-Type: application/json" \
  -d '{"message":"Hola"}'
```

### Ejecutar Script de Tests
```bash
./test-chat.ps1    # PowerShell (Windows)
./test-chat.sh     # Bash (Linux/Mac)
```

## 🎯 Cambios Clave Realizados

### 1. Backend (`backend/src/index.js`, línea 135)
Cambió de llamar `/execute` a `/chat-direct`:
```javascript
const response = await fetch("http://gateway:4000/chat-direct", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message, context: enrichedContext })
});
```

### 2. Frontend (`frontend/src/pages/Chat.jsx`, línea 110)
Ahora procesa respuestas de IA directa:
```javascript
if (data.source === 'ai-direct' && data.response) {
  assistantContent = data.response;
}
```

### 3. Gateway (`gateway/src/index.js`, línea 220)
Endpoint `/chat-direct` llama directamente Azure OpenAI:
```javascript
app.post("/chat-direct", async (req, res) => {
  const response = await callAzureOpenAIChatCompletion([
    { role: "user", content: prompt }
  ], 0.7);
  res.json({
    type: "success",
    response: response,
    source: "ai-direct"
  });
});
```

## 📚 Documentación

| Archivo | Propósito |
|---------|-----------|
| **QUICK_START.md** | Iniciar en 5 minutos |
| **SETUP_LOCAL_IA_CHAT.md** | Guía detallada + variables env |
| **COMPLETION_SUMMARY.md** | Resumen técnico completo |
| **test-chat.ps1** | Tests en PowerShell |
| **test-chat.sh** | Tests en Bash |

## 🔐 Seguridad

### Autenticación (Deshabilitada Temporalmente)
- MSAL/Entra ID: código comentado en `frontend/src/pages/Chat.jsx`
- JWT validation: código comentado en `backend/src/index.js`
- Mock user agregado para pruebas

**Para activar:** Descomentar código en ambos archivos

### SQL (No Activado)
- context-resolver: no usado en `/chat-direct`
- mcp-sql: no invocado

**Para activar:** Cambiar backend para llamar `/execute` en lugar de `/chat-direct`

## 🎨 UI Components

- **MessageBubble.jsx**: Renderiza mensajes con rol (user/assistant)
- **MessageList.jsx**: Contenedor + auto-scroll
- **MessageInput.jsx**: Paper plane button ✈️
- **ChatHeader.jsx**: Avatar user + logout dropdown
- **MetricsChart.jsx**: Gráficas (espera SQL)

Todas las clases CSS están en `frontend/src/styles/`

## 🛣️ Roadmap

### ✅ Completado
- UI chat completa
- Backend → Gateway → Azure OpenAI
- Renderizado de mensajes
- Error handling

### 🟡 Próximo (Fase 2: Auth)
- Descomentar MSAL/Entra ID
- Validar JWT en backend
- Incluir token en requests

### 🟡 Después (Fase 3: SQL)
- Cambiar a `/execute` endpoint
- Integrar context-resolver
- Implementar mcp-sql
- Retornar datos + gráficas

## 🆘 Troubleshooting

| Error | Solución |
|-------|----------|
| Connection refused :3000 | `docker compose logs backend` |
| Connection refused :4000 | `docker compose logs gateway` |
| Empty IA response | Verifica `gateway/.env` |
| Auth errors | Normal (comentada) |
| No frontend carga | Verifica http://localhost:5173 |

## 📞 Contacto / Desarrollo

Para agregar features:
1. Crear endpoint en gateway
2. Llamarlo desde backend
3. Procesar en Chat.jsx
4. Renderizar en UI

Ejemplo template en `COMPLETION_SUMMARY.md`

## 📝 Licencia

Novasoft ©2024

---

**¡Sistema listo para usar! Abre QUICK_START.md para comenzar.** 🚀
