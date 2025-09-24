import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// Create the MCP server with proper configuration
const server = new McpServer(
  {
    name: "FunctionPoint-Estimates-API-Server",
    version: "1.0.0",
    description: "MCP server for retrieving estimates from FunctionPoint API with filtering capabilities"
  },
  {
    capabilities: {
      tools: {
        GetAllEstimates: {
          description: "Retrieve all estimates from FunctionPoint API",
          inputSchema: {
            type: "object",
            properties: {
              filters: {
                type: "object",
                description: "Optional filters to apply to the estimates query",
                additionalProperties: true
              }
            },
            additionalProperties: false
          }
        }
      }
    }
  }
);

// Function to build URL with filters
function buildEstimatesUrl(filters) {
  const baseUrl = `${process.env.FUNCTIONPOINT_BASE_URL}/estimates`;
  const params = new URLSearchParams();

  // Default pagination
  params.append('page', '1');
  params.append('itemsPerPage', '20');

  // Add filters if provided
  if (filters && typeof filters === 'object') {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString());
      }
    });
  }

  return `${baseUrl}?${params.toString()}`;
}

// Function to fetch estimates with error handling
async function fetchAllEstimates(filters = {}) {
  try {
    const url = buildEstimatesUrl(filters);

    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/ld+json',
        'Authorization': `Bearer ${process.env.FUNCTIONPOINT_API_KEY}`,
        'Content-Type': 'application/ld+json'
      },
      timeout: 10000 // 10 second timeout
    });

    return {
      success: true,
      data: response.data,
      url: url // Include URL for debugging
    };

  } catch (error) {
    console.error('Error fetching estimates:', error.message);

    return {
      success: false,
      error: {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      }
    };
  }
}

// Register the GetAllEstimates tool
server.registerTool(
  {
    name: "GetAllEstimates",
    description: "Retrieve all estimates from FunctionPoint API. This tool fetches estimate data and can accept optional filters to narrow down results. Use this tool when users ask about estimates, project estimates, or need to see estimate information.",
    inputSchema: {
      type: "object",
      properties: {
        filters: {
          type: "object",
          description: "Optional filters to apply to the estimates query. Can include parameters like status, client_id, project_id, date_range, etc.",
          additionalProperties: true
        }
      },
      additionalProperties: false
    }
  },
  async (args) => {
    try {
      const filters = args.filters || {};
      const result = await fetchAllEstimates(filters);

      if (result.success) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result.data, null, 2)
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: "text", 
              text: JSON.stringify({
                error: "Failed to fetch estimates",
                details: result.error
              }, null, 2)
            }
          ],
          isError: true
        };
      }

    } catch (error) {
      console.error('Tool execution error:', error);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Internal server error",
              message: error.message
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }
);

// Vercel serverless function handler
export default async function handler(req, res) {
  try {
    // Set CORS headers for Copilot Studio
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // Validate environment variables
    if (!process.env.FUNCTIONPOINT_BASE_URL || !process.env.FUNCTIONPOINT_API_KEY) {
      res.status(500).json({
        error: 'Missing required environment variables',
        details: 'FUNCTIONPOINT_BASE_URL and FUNCTIONPOINT_API_KEY must be set'
      });
      return;
    }

    // Create transport and connect server
    const transport = new StreamableHTTPServerTransport({ req, res });
    await server.connect(transport);
    // Handle GET requests for testing/health check
    if (req.method === 'GET') {
      const healthCheck = {
        status: 'healthy',
        server: 'FunctionPoint-Estimates-API-Server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
          mcp: 'POST / (MCP protocol)',
          health: 'GET / (this endpoint)',
          test: 'GET /test (test API connection)'
        }
      };
      
      res.status(200).json(healthCheck);
      return;
    }
    
    // Handle test endpoint
    if (req.method === 'GET' && req.url === '/test') {
      try {
        const testResult = await fetchAllEstimates({});
        res.status(200).json({
          status: 'success',
          message: 'API connection test successful',
          data: testResult
        });
      } catch (error) {
        res.status(500).json({
          status: 'error',
          message: 'API connection test failed',
          error: error.message
        });
      }
      return;
    }
    
    // Handle MCP protocol requests (POST with JSON-RPC)
    if (req.method === 'POST') {
      // Check if it's a proper MCP request
      const contentType = req.headers['content-type'];
      if (!contentType || !contentType.includes('application/json')) {
        res.status(400).json({
          error: 'Invalid content type',
          message: 'MCP requests must use application/json content type',
          expected: 'application/json'
        });
        return;
      }
      
      // For MCP protocol, use streaming transport
      const transport = new StreamableHTTPServerTransport({ req, res });
      await server.connect(transport);
    } else {
      res.status(405).json({
        error: 'Method not allowed',
        allowed: ['GET', 'POST', 'OPTIONS']
      });
    }

  } catch (error) {
    console.error('Handler error:', error);

    // Only send response if headers haven't been sent
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Server initialization failed',
        error: 'Server error',
        message: error.message
      });
    }
  }
}