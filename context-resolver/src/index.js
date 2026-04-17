import express from "express";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "context-resolver"
  });
});

// 🔥 Simulación de metadata (luego lo movemos a DB o Azure DevOps)
const metadata = [
  {
    client: "empresaA",
    server: "sql-01",
    database: "ventas",
    tables: ["ventas", "clientes"]
  },
  {
    client: "empresaA",
    server: "sql-02",
    database: "crm",
    tables: ["clientes", "contactos"]
  }
];

app.post("/resolve", (req, res) => {
  const { message = "", context = {} } = req.body;

  if (typeof message !== "string") {
    return res.status(400).json({
      resolved: false,
      message: "El campo 'message' debe ser string"
    });
  }

  const normalizedMessage = message.toLowerCase();

  // 🔹 1. Filtrar por cliente si viene
  let candidates = metadata;

  if (context?.client) {
    candidates = candidates.filter(c => c.client === context.client);
  }

  if (context?.server) {
    candidates = candidates.filter(c => c.server === context.server);
  }

  if (context?.database) {
    candidates = candidates.filter(c => c.database === context.database);
  }

  // 🔹 2. Buscar coincidencias por texto
  const matches = candidates.filter(c =>
    c.tables.some(t => normalizedMessage.includes(t.toLowerCase()))
  );

  const hasDirectContext = Boolean(context?.server && context?.database);

  if (matches.length === 0 && hasDirectContext) {
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

  // 🔹 3. Resolver casos
  if (matches.length === 1) {
    const selected = matches[0];
    const matchedTable = selected.tables.find(t => normalizedMessage.includes(t.toLowerCase())) || null;

    return res.json({
      resolved: true,
      target: {
        client: selected.client,
        server: selected.server,
        database: selected.database,
        table: context?.table || matchedTable
      }
    });
  }

  if (matches.length > 1) {
    return res.json({
      resolved: false,
      ambiguity: true,
      options: matches.map(m => ({
        client: m.client,
        database: m.database,
        server: m.server,
        tables: m.tables
      })),
      message: "Se encontraron múltiples destinos posibles"
    });
  }

  return res.json({
    resolved: false,
    message: "No se encontró contexto claro"
  });
});

app.listen(6000, () => {
  console.log("Context Resolver corriendo en puerto 6000");
});