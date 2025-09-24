import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
//import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();



const server = new McpServer(
    {
  name: "estimate-api",
  version: "1.0.0"
},
{
    
        capabilities: {
          tools: {}, // must declare tools
        },
      
}
);

async function getAllEst() {
  const res = await axios.get(
    `${process.env.FUNCTIONPOINT_BASE_URL}/estimates?page=1&itemsPerPage=20`,
    {
      headers: {
        accept: "application/ld+json",
        Authorization: `Bearer ${process.env.FUNCTIONPOINT_API_KEY}`
      }
    }
  );
  return res.data;
}

server.registerTool(
  {
    name: "getAllEstimates",
    description: "Fetch estimates from FunctionPoint API",
    input: { type: "object", properties: {} },
    output: { type: "object" }
  },
  async () => {
    const data = await getAllEst();
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  }
);

export default async function handler(req, res) {
    const transport = new StreamableHTTPServerTransport({ req, res });
    await server.connect(transport);
  }
