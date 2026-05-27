// Servicio de autenticación - Novasoft
//
// ESTADO ACTUAL: Modo stub — devuelve tokens mock para desarrollo local.
// Para activar autenticación real, descomenta los bloques
// [AUTH-SSO] (colaboradores) y [AUTH-AD] (clientes).
//
// REQUISITOS PARA PRODUCCIÓN:
//   [AUTH-SSO] App Registration en Azure Entra ID + tenant ID
//   [AUTH-AD]  IP del AD del cliente + acceso LDAPS (puerto 636)

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
// [AUTH-AD]  import ldap from 'ldapjs';
// [AUTH-SSO] import { ConfidentialClientApplication } from '@azure/msal-node';

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'secreto-fuerte';
const AZURE_TENANT = process.env.AZURE_TENANT_ID;
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;

import jwksRsa from 'jwks-rsa';

if (!AZURE_TENANT || !AZURE_CLIENT_ID) {
  console.warn('[backend] AZURE_TENANT_ID or AZURE_CLIENT_ID not set — MS token validation may fail');
}

// JWKS client using jwks-rsa
const jwksClient = jwksRsa({
  jwksUri: `https://login.microsoftonline.com/${AZURE_TENANT}/discovery/v2.0/keys`,
});

function getKey(header, callback) {
  if (!header || !header.kid) return callback(new Error('Token header missing kid'));
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const pubkey = key.getPublicKey ? key.getPublicKey() : key.rsaPublicKey;
    callback(null, pubkey);
  });
}

function verifyMicrosoftAccessToken(token) {
  return new Promise((resolve, reject) => {
    const options = {
      audience: [
        AZURE_CLIENT_ID,                          // access token para tu API
        `api://${AZURE_CLIENT_ID}`               // formato alternativo común
      ],
      issuer: [
        `https://login.microsoftonline.com/${AZURE_TENANT}/v2.0`,
        `https://sts.windows.net/${AZURE_TENANT}/`   // issuer v1 como fallback
      ],
      algorithms: ['RS256']
    };

    jwt.verify(token, getKey, options, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

// ─────────────────────────────────────────
// [AUTH-SSO] CONFIGURACIÓN MSAL (Empleados)
// Descomentar cuando tengas la App Registration
// ─────────────────────────────────────────
/*
const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,         // App Registration Client ID
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
  },
};
const msalClient = new ConfidentialClientApplication(msalConfig);
*/

// ─────────────────────────────────────────
// [AUTH-AD] HELPER LDAP (Clientes)
// Descomentar cuando tengas IP del AD del cliente
// ─────────────────────────────────────────
/*
function authenticateWithAD(username, password, adServer) {
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({
      url: `ldaps://${adServer}:636`,
      tlsOptions: { rejectUnauthorized: false }, // true en producción con cert válido
    });

    const dn = username.includes('\\')
      ? username                          // dominio\\usuario
      : `${username}@${adServer}`;        // usuario@dominio.com

    client.bind(dn, password, (err) => {
      client.destroy();
      if (err) reject(new Error('Credenciales inválidas'));
      else resolve(true);
    });
  });
}
*/

// ─────────────────────────────────────────
// AUTH EMPLEADOS (SSO Microsoft)
// POST /auth/employee
// En producción: valida el access token de MSAL que llega del frontend
// ─────────────────────────────────────────
app.post('/auth/employee', async (req, res) => {
  const { accessToken } = req.body;

  if (!accessToken) return res.status(400).json({ message: 'accessToken requerido en el body' });

  try {
    const claims = await verifyMicrosoftAccessToken(accessToken);

    // Construir usuario a partir de claims
    const user = {
      id: claims.oid || claims.sub || `emp-${Date.now()}`,
      name: claims.name || claims.preferred_username || claims.upn || 'Empleado MS',
      email: claims.preferred_username || claims.upn || '',
      type: 'employee',
    };

    // Firmar JWT interno para sesión en nuestra API
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
    res.json({ token, user });

  } catch (err) {
    console.error('[backend] Error validando accessToken MS:', err.message || err);
    return res.status(401).json({ message: 'Access token inválido' });
  }
});

// ─────────────────────────────────────────
// AUTH CLIENTES (usuario/contraseña de dominio)
// POST /auth/client
// En producción: valida contra el AD del cliente vía LDAPS:636
// ─────────────────────────────────────────
app.post('/auth/client', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña requeridos' });
  }

  try {
    // [AUTH-AD] const adServer = resolveClientAD(username); // mapear dominio → IP del AD
    // [AUTH-AD] await authenticateWithAD(username, password, adServer);

    // ── MODO STUB ────────────────────────────
    // En producción eliminar este bloque y descomentar [AUTH-AD]
    if (password.length < 4) {
      return res.status(401).json({ message: 'Credenciales inválidas (stub: password muy corta)' });
    }

    const stubUser = {
      id: `client-${Date.now()}`,
      name: username,
      email: `${username.replace(/\\/g, '.')}@cliente.com`,
      type: 'client',
      domain: username.includes('\\') ? username.split('\\')[0] : 'unknown',
      // permissions: [...], // vendrán del AD del cliente
    };

    const token = jwt.sign(stubUser, JWT_SECRET, { expiresIn: '4h' });
    res.json({ token, user: stubUser });

  } catch (err) {
    console.error('[backend] Error en auth/client:', err.message);
    res.status(401).json({ message: err.message || 'Autenticación fallida' });
  }
});

// ─────────────────────────────────────────
// MIDDLEWARE: Verificar JWT
// Para usar en rutas protegidas del backend
// ─────────────────────────────────────────
export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token requerido' });
  }
  try {
    const token = authHeader.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (_) {
    res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

// ─────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'backend',
    authMode: 'stub', // cambiar a 'sso+ad' cuando esté en producción
  });
});

const PORT = process.env.BACKEND_PORT || 3001;
app.listen(PORT, () => {
  console.log(`[backend] Corriendo en http://localhost:${PORT}`);
  console.log(`[backend] Modo: STUB — sin validación real de AD`);
});