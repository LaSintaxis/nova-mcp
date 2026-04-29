import dotenv from "dotenv";
dotenv.config();

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4.1-mini";
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";

async function testAzureOpenAI() {
  console.log("=== Probando conexión con Azure OpenAI ===\n");
  console.log("Endpoint:", AZURE_OPENAI_ENDPOINT);
  console.log("Deployment:", AZURE_OPENAI_DEPLOYMENT);
  console.log("API Version:", AZURE_OPENAI_API_VERSION);
  console.log("API Key:", AZURE_OPENAI_API_KEY ? "✓ Configurada" : "❌ FALTA");
  
  if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
    console.error("\n❌ Error: Faltan variables de entorno");
    return;
  }
  
  const url = `${AZURE_OPENAI_ENDPOINT.replace(/\/$/, "")}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "api-key": AZURE_OPENAI_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Responde SOLO con la palabra 'OK'" }],
        temperature: 0
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log("\n✅ Azure OpenAI RESPONDE CORRECTAMENTE");
      console.log("Respuesta:", data.choices[0].message.content);
    } else {
      console.error("\n❌ Error de Azure OpenAI:", data.error?.message || "Error desconocido");
    }
  } catch (error) {
    console.error("\n❌ Error de conexión:", error.message);
  }
}

testAzureOpenAI();