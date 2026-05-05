import express from "express";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "context-resolver" });
});

// ============================================
// METADATA CON TUS BASES DE DATOS REALES
// ============================================
// Aquí pones los servidores y bases de datos que tienes en tu SQL Server local
const metadata = [
  {
    client: "novasoft",
    server: "sql-01",
    database: "prueba_mcp",
    tables: ["Clientes", "PedidoDetalle", "Pedidos", "Productos"]
  },
  {
    client: "novasoft",
    server: "sql-01",
    database: "Northwind",
    tables: ["Customers", "Orders", "Products", "Employees"]
  },
  {
    client: "novasoft",
    server: "sql-01",
    database: "AdventureWorks",
    tables: ["Person", "Sales", "Product"]
  }
  // Agrega aquí todas las bases de datos que quieras consultar
];

console.log("═════════════════════════════════════════════");
console.log("🔧 Context Resolver");
console.log(`📊 Bases de datos configuradas: ${metadata.length}`);
metadata.forEach(m => console.log(`   - ${m.database} (${m.tables.length} tablas)`));
console.log("═════════════════════════════════════════════");

app.post("/resolve", (req, res) => {
  const { message = "", context = {} } = req.body;

  if (typeof message !== "string") {
    return res.status(400).json({
      resolved: false,
      message: "El campo 'message' debe ser string"
    });
  }

  const normalizedMessage = message.toLowerCase();

  // Filtrar por cliente (por defecto "novasoft" para pruebas)
  let candidates = metadata;
  const client = context?.client || "novasoft";
  candidates = candidates.filter(c => c.client === client);

  // Si se especifica servidor en contexto
  if (context?.server) {
    candidates = candidates.filter(c => c.server === context.server);
  }

  // Si se especifica base de datos en contexto
  if (context?.database) {
    candidates = candidates.filter(c => c.database === context.database);
  }

  // Buscar coincidencias por texto (nombre de base de datos o tabla)
  const matches = candidates.filter(c =>
    normalizedMessage.includes(c.database.toLowerCase()) ||
    c.tables.some(t => normalizedMessage.includes(t.toLowerCase()))
  );

  // Si hay contexto directo (servidor y BD especificados)
  const hasDirectContext = Boolean(context?.server && context?.database);
  if (matches.length === 0 && hasDirectContext && candidates.length > 0) {
    const directTarget = candidates[0];
    if (directTarget) {
      return res.json({
        resolved: true,
        target: {
          client: directTarget.client,
          server: directTarget.server,
          database: directTarget.database,
          table: context?.table || null
        }
      });
    }
  }

  // Caso: una coincidencia exacta
  if (matches.length === 1) {
    const selected = matches[0];
    const matchedTable = selected.tables.find(t => normalizedMessage.includes(t.toLowerCase())) || null;

    return res.json({
      resolved: true,
      target: {
        client: selected.client,
        server: selected.server,
        database: selected.database,
        table: matchedTable
      }
    });
  }

  // Caso: múltiples coincidencias
  if (matches.length > 1) {
    return res.json({
      resolved: false,
      ambiguity: true,
      options: matches.map(m => ({
        database: m.database,
        server: m.server,
        tables: m.tables
      })),
      message: "Se encontraron múltiples bases de datos posibles. ¿Cuál quieres consultar?"
    });
  }

  // No se encontró contexto
  return res.json({
    resolved: false,
    message: "No se encontró una base de datos clara. Por favor especifica: 'en la base de datos X, muéstrame...'"
  });
});

app.listen(6000, () => {
  console.log("Context Resolver corriendo en puerto 6000");
});