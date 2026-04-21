import express from "express";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

const app = express();
app.use(express.json());

// ============================================
// CONFIGURACIÓN ENTRADA ID
// ============================================
const TENANT_ID = process.env.TENANT_ID; // Tu Tenant ID de Azure
const CLIENT_ID = process.env.CLIENT_ID; // Client ID de tu app registration
const AUTHORITY = `https://login.microsoftonline.com/${TENANT_ID}/v2.0`;

// Cliente para obtener la clave pública de Microsoft
const client = jwksClient({
  jwksUri: `${AUTHORITY}/discovery/v2.0/keys`
});

// Función para obtener la clave pública
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
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      type: "error", 
      message: "Token no proporcionado" 
    });
  }

  // Configuración para validar el token
  const validationOptions = {
    audience: CLIENT_ID,           // Debe coincidir con el Client ID
    issuer: `${AUTHORITY}`,        // El emisor debe ser Microsoft
    algorithms: ["RS256"]
  };

  jwt.verify(token, getKey, validationOptions, (err, decoded) => {
    if (err) {
      console.error("Error validando token:", err);
      return res.status(403).json({ 
        type: "error", 
        message: "Token inválido o expirado",
        details: err.message
      });
    }

    // Verificar que el tenant sea el correcto (solo tu empresa)
    const allowedTenants = process.env.ALLOWED_TENANTS?.split(',') || [TENANT_ID];
    if (!allowedTenants.includes(decoded.tid)) {
      return res.status(403).json({
        type: "error",
        message: "Acceso denegado. Solo usuarios de la empresa autorizada."
      });
    }

    // Guardar información del usuario para logs
    req.user = {
      email: decoded.email || decoded.upn || decoded.unique_name,
      name: decoded.name,
      tenantId: decoded.tid,
      userId: decoded.oid
    };
    
    next();
  });
}

// ============================================
// RUTAS
// ============================================
app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "backend"
  });
});

// Ruta protegida con autenticación
app.post("/chat", authenticateToken, async (req, res) => {
  const { message, context = {} } = req.body;

  // Agregar información del usuario al contexto
  const enrichedContext = {
    ...context,
    user: req.user  // Para auditoría y logs
  };

  if (!message || typeof message !== "string") {
    return res.status(400).json({
      type: "error",
      message: "El campo 'message' es obligatorio"
    });
  }

  try {
    const response = await fetch("http://gateway:4000/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        context: enrichedContext
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        type: "error",
        message: data?.message || "Error al ejecutar consulta en gateway",
        details: data
      });
    }

    return res.json({
      message: data?.type === "success" ? "Resultado de la consulta" : "Se requiere aclaración",
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

app.listen(3000, () => {
  console.log("Backend corriendo en puerto 3000");
  console.log("🔐 Autenticación Entra ID activada");
});