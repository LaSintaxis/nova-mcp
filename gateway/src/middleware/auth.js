// gateway/src/middleware/auth.js
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import https from 'https';
import dotenv from 'dotenv';
dotenv.config(); // ← cargar variables antes de usarlas

const client = jwksClient({
    jwksUri: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/discovery/v2.0/keys`,
    cache: true,
    rateLimit: true,
    requestAgent: new https.Agent({ rejectUnauthorized: false }),
});

function getKey(header, callback) {
    client.getSigningKey(header.kid, (err, key) => {
        if (err) {
            console.warn('[auth] Error obteniendo clave pública:', err.message);
            return callback(err);
        }
        callback(null, key.getPublicKey());
    });
}

export function authMiddleware(req, res, next) {
    // Allow health checks and CORS preflight through
    if (req.path === '/health' || req.method === 'OPTIONS') return next();

    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) {
        return res.status(401).json({ type: 'error', message: 'Unauthorized: missing Bearer token' });
    }

    const token = auth.slice(7);

    // Log temporal para diagnóstico
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    } catch (e) { console.warn('[auth] no se pudo leer el payload del token'); }

    jwt.verify(token, getKey, {
        // Allow multiple possible audiences and issuers (Azure may emit different variants)
        audience: [
            `api://${process.env.AZURE_CLIENT_ID}`,
            process.env.AZURE_CLIENT_ID
        ],
        issuer: [
            `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0`, // v2.0 issuer
            `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/`,     // v1 issuer format
            `https://sts.windows.net/${process.env.AZURE_TENANT_ID}/`               // older STS issuer
        ],
        algorithms: ['RS256'],
    }, (err, decoded) => {
        if (err) {
            console.warn('[auth] Token inválido:', err.message);
            return res.status(401).json({ type: 'error', message: 'Unauthorized: invalid token' });
        }
        req.user = {
            oid: decoded.oid,
            email: decoded.preferred_username || decoded.upn,
            name: decoded.name,
        };
        next();
    });
}