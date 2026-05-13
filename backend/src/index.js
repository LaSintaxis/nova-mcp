import express from "express";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// Responder preflight OPTIONS explícitamente
app.options("*", cors());

app.use(express.json());


// ============================================
// CONFIGURACIÓN ENTRADA ID - UNA SOLA APP
// ============================================
const TENANT_ID = process.env.TENANT_ID;
const CLIENT_ID = process.env.CLIENT_ID;  // El mismo para frontend y backend
const AUTHORITY = `https://login.microsoftonline.com/${TENANT_ID}/v2.0`;

// El audience puede ser el Client ID o api://{CLIENT_ID}
const allowedAudiences = [
  CLIENT_ID,
  `api://${CLIENT_ID}`
];

if (!TENANT_ID || !CLIENT_ID) {
  console.warn("⚠️ TENANT_ID o CLIENT_ID no están definidos en backend/.env");
}

// Cliente para obtener la clave pública de Microsoft
const client = jwksClient({
  jwksUri: `${AUTHORITY}/discovery/v2.0/keys`
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
    } else {
      callback(null, key.getPublicKey());
    }
  });
}

// ============================================
// MIDDLEWARE DE AUTENTICACIÓN
// ============================================
async function authenticateToken(req, res, next) {
  // COMENTADO: const authHeader = req.headers.authorization;
  // COMENTADO: const token = authHeader && authHeader.split(' ')[1];

  // COMENTADO: if (!token) {
  // COMENTADO:   return res.status(401).json({ 
  // COMENTADO:     type: "error", 
  // COMENTADO:     message: "Token no proporcionado" 
  // COMENTADO:   });
  // COMENTADO: }

  // COMENTADO: const validationOptions = {
  // COMENTADO:   audience: allowedAudiences,
  // COMENTADO:   issuer: `${AUTHORITY}`,
  // COMENTADO:   algorithms: ["RS256"]
  // COMENTADO: };

  // COMENTADO: jwt.verify(token, getKey, validationOptions, (err, decoded) => {
  // COMENTADO:   if (err) {
  // COMENTADO:     console.error("Error validando token:", err);
  // COMENTADO:     return res.status(403).json({ 
  // COMENTADO:       type: "error", 
  // COMENTADO:       message: "Token inválido o expirado",
  // COMENTADO:       details: err.message
  // COMENTADO:     });
  // COMENTADO:   }

  // COMENTADO:   // Verificar tenant
  // COMENTADO:   const allowedTenants = process.env.ALLOWED_TENANTS
  // COMENTADO:     ? process.env.ALLOWED_TENANTS.split(',').map(t => t.trim()).filter(Boolean)
  // COMENTADO:     : [TENANT_ID];

  // COMENTADO:   if (!allowedTenants.includes(decoded.tid)) {
  // COMENTADO:     return res.status(403).json({
  // COMENTADO:       type: "error",
  // COMENTADO:       message: "Acceso denegado. Solo usuarios de la empresa autorizada."
  // COMENTADO:     });
  // COMENTADO:   }

  // COMENTADO:   // Guardar información del usuario
  // COMENTADO:   req.user = {
  // COMENTADO:     email: decoded.email || decoded.upn || decoded.unique_name,
  // COMENTADO:     name: decoded.name,
  // COMENTADO:     tenantId: decoded.tid,
  // COMENTADO:     userId: decoded.oid
  // COMENTADO:   };

  // COMENTADO:   next();
  // COMENTADO: });

  // Usuario mock para pruebas sin autenticación
  req.user = {
    email: "prueba@novasoft.com",
    name: "Usuario Prueba",
    tenantId: TENANT_ID,
    userId: "mock-user-id"
  };

  next();
}

// ============================================
// RUTAS
// ============================================
//verificar que backend esté corriendo
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "backend" });
});



app.post("/chat", authenticateToken, async (req, res) => {
  const { message, context = {} } = req.body;

  const enrichedContext = {
    ...context,
    user: req.user,
  };

  if (!message || typeof message !== "string") {
    return res.status(400).json({
      type: "error",
      message: "El campo 'message' es obligatorio"
    });
  }

  try {
    const gatewayUrl = process.env.GATEWAY_URL || "http://localhost:4000";
    const response = await fetch(`${gatewayUrl}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, context: enrichedContext })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        type: "error",
        message: data?.message || "Error al comunicarse con el gateway",
        details: data
      });
    }

    return res.json({
      type: "success",
      message: data.response || data.message || "Respuesta procesada",
      ...data
    });
  } catch (error) {
    console.error("Error en backend /chat:", error);
    return res.status(500).json({
      type: "error",
      message: "No fue posible comunicarse con el gateway"
    });
  }
});

// ============================================
// AUTENTICACIÓN PARA CLIENTES (usuario/contraseña)
// ============================================
app.post("/auth/client", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Usuario y contraseña requeridos" });
  }

  try {
    //aquí iría la lógica real de validación contra el directorio activo
    const isValid = await validateClientCredentials(username, password);

    if (!isValid) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    //generar token JWT para el cliente
    const token = jwt.sign(
      {
        sub: username,
        userType: 'client',
        name: username.split('\\').pop() || username
      },
      process.env.JWT_SECRET || 'el-secreto-temporal',
      { expiresIn: '8h' }
    );

    res.json({ token, userType: 'client' });
  } catch (error) {
    console.error("Error en autenticación de cliente:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

//funcion para validar credenciales de cliente (en producción, esto debería consultar el directorio activo)
async function validateClientCredentials(username, password) {
  //Aquí va la lógica real de validación contra el directorio activo
  console.log(`Validando cliente: ${username}`);
  return true;
}

app.listen(3000, () => {
  console.log("Backend corriendo en puerto 3000");
  console.log(`🔓 MODO PRUEBA - Autenticación desactivada`);
});