import express from "express";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "mcp-sql"
  });
});

app.post("/query", async (req, res) => {
  const { query, connection = {} } = req.body;

  if (!query || typeof query !== "string") {
    return res.status(400).json({
      success: false,
      message: "El campo 'query' es obligatorio"
    });
  }

  console.log("SQL recibido:", query);
  console.log("Conexión objetivo:", connection);

  // ⚠️ Simulación por ahora
  const fakeResult = [
    { month: "Jan", sales: 100 },
    { month: "Feb", sales: 200 }
  ];

  res.json({
    success: true,
    connection,
    data: fakeResult
  });
});

app.listen(5000, () => {
  console.log("MCP SQL corriendo en puerto 5000");
});