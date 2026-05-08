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
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ type: "error", message: "Token no proporcionado" });
  }

  const validationOptions = {
    audience: allowedAudiences,
    issuer: AUTHORITY,
    algorithms: ["RS256"]
  };

  jwt.verify(token, getKey, validationOptions, (err, decoded) => {
    if (err) {
      console.error("Error validando token:", err);
      return res.status(403).json({ type: "error", message: "Token inválido o expirado", details: err.message });
    }

    const allowedTenants = process.env.ALLOWED_TENANTS
      ? process.env.ALLOWED_TENANTS.split(',').map(t => t.trim()).filter(Boolean)
      : [TENANT_ID];

    if (!allowedTenants.includes(decoded.tid)) {
      return res.status(403).json({ type: "error", message: "Acceso denegado." });
    }

    req.user = {
      email: decoded.email || decoded.upn || decoded.preferred_username,
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
  res.status(200).json({ ok: true, service: "backend" });
});

app.post("/chat", authenticateToken, async (req, res) => {
  // Versión sin autenticación

  const { message, context = {} } = req.body;

  const enrichedContext = {
    ...context,
    user: req.user,
    user: { email: "prueba@novasoft.com", name: "Usuario Prueba" }
  };

  if (!message || typeof message !== "string") {
    return res.status(400).json({
      type: "error",
      message: "El campo 'message' es obligatorio"
    });
  }

  try {
    // Luego cambiar a /execute cuando integres mcp-sql
    const response = await fetch("http://localhost:4000/execute", {
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
    const isValid = await validateClientCredentials(username, password);

    if (!isValid) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const token = jwt.sign(
      {
        sub: username,
        userType: 'client',
        name: username.split('\\').pop() || username
      },
      process.env.JWT_SECRET || 'tu-secreto-temporal',
      { expiresIn: '8h' }
    );

    res.json({ token, userType: 'client' });
  } catch (error) {
    console.error("Error en autenticación de cliente:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

async function validateClientCredentials(username, password) {
  console.log(`Validando cliente: ${username}`);
  return true;
}

app.listen(3000, () => {
  console.log("Backend corriendo en puerto 3000");
});