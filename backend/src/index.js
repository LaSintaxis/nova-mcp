// import express from "express";
// import session from "express-session";
// import cors from "cors";
// import dotenv from "dotenv";
// import { ConfidentialClientApplication } from "@azure/msal-node";
// import ldap from "ldapjs";

// dotenv.config();

// const app = express();

// app.use(cors({
//   origin: "http://localhost:5173",
//   credentials: true,
// }));
// app.use(express.json());
// app.use(session({
//   secret: process.env.SESSION_SECRET,
//   resave: false,
//   saveUninitialized: false,
//   cookie: { secure: false, httpOnly: true, maxAge: 8 * 60 * 60 * 1000 }, // 8h
// }));

// // MSAL para validar tokens SSO y llamar a Graph
// const msalClient = new ConfidentialClientApplication({
//   auth: {
//     clientId: process.env.AZURE_CLIENT_ID,
//     authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
//     clientSecret: process.env.AZURE_CLIENT_SECRET,
//   },
// });

// // ─── Helper: obtener grupos del usuario desde Graph ───────────────────────────
// async function getUserGroups(accessToken) {
//   const res = await fetch("https://graph.microsoft.com/v1.0/me/memberOf", {
//     headers: { Authorization: `Bearer ${accessToken}` },
//   });
//   const data = await res.json();
//   return data.value?.map((g) => g.displayName) ?? [];
// }

// // ─── Middleware: validar token SSO (empleados) ────────────────────────────────
// export async function requireSSOAuth(req, res, next) {
//   const authHeader = req.headers.authorization;
//   if (!authHeader?.startsWith("Bearer ")) {
//     return res.status(401).json({ message: "Token SSO requerido" });
//   }
//   try {
//     // Validamos el token con MSAL (on-behalf-of flow para llamar a Graph)
//     const oboResult = await msalClient.acquireTokenOnBehalfOf({
//       oboAssertion: authHeader.split(" ")[1],
//       scopes: ["User.Read", "GroupMember.Read.All"],
//     });
//     const groups = await getUserGroups(oboResult.accessToken);
//     req.user = {
//       type: "sso",
//       username: oboResult.account?.username,
//       displayName: oboResult.account?.name,
//       groups,
//       accessToken: oboResult.accessToken,
//     };
//     next();
//   } catch (err) {
//     console.error("SSO validation error:", err);
//     res.status(401).json({ message: "Token SSO inválido" });
//   }
// }

// // ─── Middleware: validar sesión de dominio (clientes) ─────────────────────────
// export function requireDomainAuth(req, res, next) {
//   if (!req.session?.domainUser) {
//     return res.status(401).json({ message: "Sesión de dominio requerida" });
//   }
//   req.user = req.session.domainUser;
//   next();
// }

// // ─── Middleware: acepta cualquiera de los dos tipos de auth ───────────────────
// export async function requireAnyAuth(req, res, next) {
//   if (req.headers.authorization?.startsWith("Bearer ")) {
//     return requireSSOAuth(req, res, next);
//   }
//   if (req.session?.domainUser) {
//     return requireDomainAuth(req, res, next);
//   }
//   return res.status(401).json({ message: "Autenticación requerida" });
// }


// // ─── Ruta: obtener info del usuario actual ────────────────────────────────────
// app.get("/auth/me", requireAnyAuth, (req, res) => {
//   res.json(req.user);
// });

// app.get("/auth/logout", (req, res) => {
//   req.session.destroy();
//   res.json({ success: true });
// });

// app.listen(process.env.BACKEND_PORT || 3001, () => {
//   console.log(`Backend corriendo en puerto ${process.env.BACKEND_PORT || 3001}`);
// });