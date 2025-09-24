import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// Create the MCP server (still used for tool registration)
const server = new McpServer(
  {
    name: "FunctionPoint-Estimates-API-Server",
    version: "1.0.0",
    description: "MCP server for retrieving estimates from FunctionPoint API with filtering capabilities"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Function to build URL with filters
function buildEstimatesUrl(filters) {
  const baseUrl = `${process.env.FUNCTIONPOINT_BASE_URL}/estimates`;
  const params = new URLSearchParams();

  // Default pagination
  params.append("page", "1");
  params.append("itemsPerPage", "20");

  if (filters && typeof filters === "object") {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, value.toString());
      }
    });
  }

  return `${baseUrl}?${params.toString()}`;
}

// Function to fetch estimates
async function fetchAllEstimates(filters = {}) {
  try {
    const url = buildEstimatesUrl(filters);

    const response = await axios.get(url, {
      headers: {
        Accept: "application/ld+json",
        Authorization: `Bearer ${process.env.FUNCTIONPOINT_API_KEY}`,
        "Content-Type": "application/ld+json"
      },
      timeout: 10000
    });

    return { success: true, data: response.data, url };
  } catch (error) {
    console.error("Error fetching estimates:", error.message);
    return {
      success: false,
      error: {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      }
    };
  }
}

// Register the GetAllEstimates tool
server.registerTool(
  "GetAllEstimates",
  {
    title: "Get All Estimates",
    description: "Retrieve all estimates from FunctionPoint API with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        filters: {
          type: "object",
          description: "Optional filters for estimates",
          additionalProperties: true
        }
      },
      additionalProperties: false
    }
  },
  async ({ filters }) => {
    const result = await fetchAllEstimates(filters || {});
    if (result.success) {
      return {
        content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }]
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Failed to fetch estimates",
                details: result.error,
                url_attempted: buildEstimatesUrl(filters || {})
              },
              null,
              2
            )
          }
        ],
        isError: true
      };
    }
  }
);

// Vercel handler (serverless-safe)
export default async function handler(req, res) {
  try {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, mcp-session-id");

    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }

    // Health check
    if (req.method === "GET") {
      if (req.url === "/test") {
        const testResult = await fetchAllEstimates({});
        res.status(200).json({
          status: "success",
          message: "API connection test successful",
          data: testResult
        });
        return;
      }

      res.status(200).json({
        status: "healthy",
        server: "FunctionPoint-Estimates-API-Server",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        endpoints: { mcp: "POST /", health: "GET /", test: "GET /test" },
        tools: ["GetAllEstimates"]
      });
      return;
    }

    // Handle MCP JSON-RPC requests
    if (req.method === "POST") {
      const { method, params, id } = req.body;

      if (method === "initialize") {
        res.status(200).json({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "FunctionPoint-Estimates-API-Server", version: "1.0.0" }
          }
        });
        return;
      }

      if (method === "tools/list") {
        res.status(200).json({
          jsonrpc: "2.0",
          id,
          result: {
            tools: [server.getTool("GetAllEstimates")]
          }
        });
        return;
      }

      if (method === "tools/call" && params.name === "GetAllEstimates") {
        const filters = params.arguments?.filters || {};
        const result = await fetchAllEstimates(filters);

        if (result.success) {
          res.status(200).json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }]
            }
          });
        } else {
          res.status(200).json({
            jsonrpc: "2.0",
            id,
            error: { code: -1, message: "Failed to fetch estimates", data: result.error }
          });
        }
        return;
      }

      res.status(400).json({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Unknown method ${method}` }
      });
      return;
    }

    // Method not allowed
    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Handler error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Server error", message: error.message });
    }
  }
}
