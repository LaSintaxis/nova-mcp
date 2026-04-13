// backend/server.js - Versión actualizada
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// Función para llamar al Azure MCP Server oficial
async function callAzureMCP(toolName, args) {
  // El Azure MCP Server oficial se ejecuta como un proceso
  // y acepta comandos vía stdio [citation:10]
  const command = `npx -y @azure/mcp@latest tool run ${toolName} ${JSON.stringify(args)}`;
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      env: {
        ...process.env,
        AZURE_SUBSCRIPTION_ID: process.env.AZURE_SUBSCRIPTION_ID
      }
    });
    return JSON.parse(stdout);
  } catch (error) {
    console.error('Error calling Azure MCP:', error);
    throw error;
  }
}

// Ruta de chat mejorada
app.post('/api/chat', async (req, res) => {
  const { prompt, session_id, require_chart } = req.body;
  
  // 1. Usar Azure OpenAI o Claude para interpretar el prompt
  const intent = await interpretPrompt(prompt);
  
  let result;
  switch (intent.action) {
    case 'get_vm_metrics':
      // Para preguntas de rendimiento [citation:3]
      result = await callAzureMCP('azure_monitor_query_metrics', {
        resource_uri: intent.vm_id,
        metric_names: ['Percentage CPU', 'Available Memory'],
        timespan: 'P7D'  // últimos 7 días
      });
      break;
      
    case 'get_vm_disk':
      // Para preguntas de almacenamiento [citation:2]
      result = await callAzureMCP('azure_vm_get_disk_info', {
        resource_group: intent.resource_group,
        vm_name: intent.vm_name
      });
      break;
      
    case 'create_vm':
      // Para crear VMs [citation:2]
      result = await callAzureMCP('azure_vm_create_or_update', {
        resource_group: intent.resource_group,
        vm_name: intent.vm_name,
        location: intent.location,
        hardware: {
          vm_size: intent.vm_size  // 'Standard_D2s_v3' = 8GB RAM
        },
        os_profile: {
          computer_name: intent.computer_name,
          admin_username: intent.admin_username
        },
        storage_profile: {
          image_reference: {
            publisher: 'MicrosoftWindowsServer',
            offer: 'WindowsServer',
            sku: '2022-Datacenter',
            version: 'latest'
          }
        }
      });
      break;
      
    default:
      result = { text: "No entendí la acción. ¿Podrías reformular?" };
  }
  
  // 3. Generar respuesta con gráfica si es necesario
  const response = await generateResponse(intent, result, require_chart);
  
  res.json(response);
});