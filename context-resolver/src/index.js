// import express from "express";
// import dotenv from "dotenv";
// dotenv.config();

// const app = express();
// app.use(express.json());

// app.get("/health", (_req, res) => {
//   res.status(200).json({ ok: true, service: "context-resolver" });
// });

// // ============================================
// // METADATA (TEMPORAL - LUEGO SERÁ DINÁMICA)
// // ============================================
// // TODO: Reemplazar por BD de configuración
// const metadata = [
//   {
//     service: "sql",
//     client: "novasoft",
//     server: "sql-01",
//     database: "prueba_mcp",
//     tables: ["Clientes", "PedidoDetalle", "Productos", "Pedidos"]
//   },
//   {
//     service: "sql",
//     client: "novasoft",
//     server: "E-23YP6S2",
//     database: "Northwind",
//     tables: ["Customers", "Orders", "Products", "Employees", "Categories"]
//   }
// ];

// console.log("═════════════════════════════════════════════");
// console.log("🔧 Context Resolver - Versión Dinámica");
// console.log(`📊 Bases de datos configuradas: ${metadata.length}`);
// metadata.forEach(m => console.log(`   - ${m.database} (${m.tables.length} tablas)`));
// console.log("═════════════════════════════════════════════");

// // ============================================
// // RESOLVER CONTEXTO
// // ============================================
// app.post("/resolve", (req, res) => {
//   const { message = "", context = {} } = req.body;

//   if (typeof message !== "string") {
//     return res.status(400).json({
//       resolved: false,
//       message: "El campo 'message' debe ser string"
//     });
//   }

//   const normalizedMessage = message.toLowerCase();
  
//   // Filtrar por cliente (si viene en contexto)
//   let candidates = metadata;
//   if (context?.client) {
//     candidates = candidates.filter(c => c.client === context.client);
//   }
  
//   // Filtrar por servidor (si viene en contexto)
//   if (context?.server) {
//     candidates = candidates.filter(c => c.server === context.server);
//   }
  
//   // Filtrar por base de datos (si viene en contexto)
//   if (context?.database) {
//     candidates = candidates.filter(c => c.database === context.database);
//   }

//   // Buscar coincidencias por nombre de base de datos o tabla
//   const matches = candidates.filter(c => {
//     const databaseMatch = normalizedMessage.includes(c.database.toLowerCase());
//     const tableMatch = c.tables.some(t => normalizedMessage.includes(t.toLowerCase()));
//     return databaseMatch || tableMatch;
//   });

//   // Si hay contexto directo (servidor y BD especificados en contexto)
//   const hasDirectContext = Boolean(context?.server && context?.database);
//   if (matches.length === 0 && hasDirectContext && candidates.length > 0) {
//     const directTarget = candidates[0];
//     if (directTarget) {
//       return res.json({
//         resolved: true,
//         target: {
//           service: directTarget.service,
//           client: directTarget.client,
//           server: directTarget.server,
//           database: directTarget.database,
//           table: context?.table || null
//         }
//       });
//     }
//   }

//   // Una sola coincidencia
//   if (matches.length === 1) {
//     const selected = matches[0];
//     const matchedTable = selected.tables.find(t => normalizedMessage.includes(t.toLowerCase())) || null;
    
//     return res.json({
//       resolved: true,
//       target: {
//         service: selected.service,
//         client: selected.client,
//         server: selected.server,
//         database: selected.database,
//         table: matchedTable
//       }
//     });
//   }

//   // Múltiples coincidencias
//   if (matches.length > 1) {
//     return res.json({
//       resolved: false,
//       ambiguity: true,
//       options: matches.map(m => ({
//         service: m.service,
//         database: m.database,
//         server: m.server,
//         tables: m.tables
//       })),
//       message: "Se encontraron múltiples bases de datos posibles. Por favor especifica cuál quieres consultar."
//     });
//   }

//   // No se encontró contexto
//   return res.json({
//     resolved: false,
//     message: "No se encontró una base de datos clara. Por favor menciona el nombre de la base de datos o tabla que quieres consultar."
//   });
// });

// app.listen(6000, () => {
//   console.log("\n🚀 Context Resolver corriendo en puerto 6000");
//   console.log("📋 Endpoint:");
//   console.log("   POST /resolve - Resolver contexto\n");
// });