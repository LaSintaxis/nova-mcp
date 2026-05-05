# 🚀 Quick Start - IA Chat Local (5 minutos)

## 1️⃣ Prerequisitos
- ✅ Docker instalado
- ✅ `gateway/.env` con Azure OpenAI credentials
- ✅ Terminal (PowerShell en Windows)

## 2️⃣ Iniciar Servicios
```powershell
# En la raíz del proyecto
docker compose up -d

# Espera 15-20 segundos mientras se inician...
```

## 3️⃣ Verificar Estado
```powershell
# Ejecutar tests
.\test-chat.ps1

# Deberías ver:
# ✅ Backend: 200
# ✅ Gateway: 200
# ✅ Chat response con IA
```

## 4️⃣ Abrir Chat
Abre en navegador:
```
http://localhost:5173
```

## 5️⃣ Chatear
- Escribe un mensaje
- Presiona el botón Paper Plane ✈️
- La IA responde en 3-5 segundos

---

## ⚡ Atajos

### Para Desarrolladores (Sin Docker)
```powershell
# Terminal 1
cd frontend && npm run dev

# Terminal 2
cd backend && node src/index.js

# Terminal 3
cd gateway && node src/index.js
```

### Detener Todo
```powershell
docker compose down
```

### Ver Logs
```powershell
docker compose logs -f backend
docker compose logs -f gateway
```

---

## 🎯 Que Está Funcionando

✅ Frontend React en `http://localhost:5173`
✅ Backend Express en `http://localhost:3000`
✅ Gateway en `http://localhost:4000`
✅ Azure OpenAI conectado
✅ Chat UI completo

---

## 🔧 Variables de Entorno

Si los servicios no funcionan, verifica:

**`gateway/.env`**
```env
AZURE_OPENAI_ENDPOINT=https://[nombre].openai.azure.com/
AZURE_OPENAI_API_KEY=[tu-api-key]
AZURE_OPENAI_DEPLOYMENT=gpt-4.1-mini
AZURE_OPENAI_API_VERSION=2024-12-01-preview
```

---

## 📊 Estructura

```
Frontend (React) :5173
    ↓
Backend (Express) :3000
    ↓
Gateway (Express) :4000
    ↓
Azure OpenAI (API)
```

---

## ✅ Primeros Pasos

1. **Abre http://localhost:5173**
2. **Escribe:** "Hola, ¿quién eres?"
3. **Presiona:** ✈️
4. **Espera:** 3-5 segundos
5. **Verás:** Respuesta de la IA

---

## 🆘 Si Algo Falla

### Errores Comunes

**"Cannot connect to :3000"**
→ Backend no está corriendo
→ `docker compose logs backend`

**"Empty IA response"**
→ Azure OpenAI credentials incorrectos
→ Verifica `gateway/.env`

**"Docker images not found"**
→ Reconstruir: `docker compose build`

---

## 📖 Documentación Completa

- **SETUP_LOCAL_IA_CHAT.md** - Setup detallado
- **COMPLETION_SUMMARY.md** - Resumen técnico
- **test-chat.ps1** - Tests automatizados

---

## 🎉 ¡Listo!

Tu chat con IA debería estar corriendo. Si tienes preguntas:
1. Abre `SETUP_LOCAL_IA_CHAT.md`
2. Ejecuta `test-chat.ps1`
3. Revisa `COMPLETION_SUMMARY.md`

**¡A chatear! 🚀**
