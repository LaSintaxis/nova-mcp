import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "backend"
  });
});

app.post("/chat", async (req, res) => {
  const { message, context = {} } = req.body;

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
        context
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
});