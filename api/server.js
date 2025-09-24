import axios from "axios";

// Simple function to fetch estimates
async function fetchAllEstimates(filters = {}) {
  try {
    const baseUrl = process.env.FUNCTIONPOINT_BASE_URL;
    const apiKey = process.env.FUNCTIONPOINT_API_KEY;
    
    if (!baseUrl || !apiKey) {
      throw new Error('Missing environment variables: FUNCTIONPOINT_BASE_URL or FUNCTIONPOINT_API_KEY');
    }
    
    const params = new URLSearchParams();
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
    
    const url = `${baseUrl}/estimates?${params.toString()}`;
    
    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/ld+json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 8000 // 8 second timeout
    });
    
    return {
      success: true,
      data: response.data,
      url: url
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

// Handle MCP protocol requests
async function handleMCPRequest(body) {
  try {
    const { method, params = {}, id } = body;
    
    console.log(`MCP Request: ${method}`, params);
    
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {
                listChanged: false
              }
            },
            serverInfo: {
              name: "FunctionPoint-Estimates-API-Server",
              version: "1.0.0"
            }
          }
        };
      
      case 'tools/list':
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: [
              {
                name: "GetAllEstimates",
                description: "Retrieve all estimates from FunctionPoint API with optional filters",
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
            ]
          }
        };
      
      case 'tools/call':
        if (params.name === 'GetAllEstimates') {
          const filters = params.arguments?.filters || {};
          const result = await fetchAllEstimates(filters);
          
          if (result.success) {
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(result.data, null, 2)
                  }
                ]
              }
            };
          } else {
            return {
              jsonrpc: "2.0",
              id,
              error: {
                code: -1,
                message: "Failed to fetch estimates",
                data: result.error
              }
            };
          }
        } else {
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32601,
              message: `Tool '${params.name}' not found`
            }
          };
        }
      
      default:
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Method '${method}' not found`
          }
        };
    }
  } catch (error) {
    console.error('MCP Request handling error:', error);
    return {
      jsonrpc: "2.0",
      id: body.id || null,
      error: {
        code: -32603,
        message: "Internal error",
        data: error.message
      }
    };
  }
}

// Main Vercel serverless function handler
export default async function handler(req, res) {
  try {
    console.log(`${req.method} ${req.url}`);
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Environment variable check
    if (!process.env.FUNCTIONPOINT_BASE_URL || !process.env.FUNCTIONPOINT_API_KEY) {
      console.error('Missing environment variables');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Missing required environment variables'
      });
    }
    
    // Handle GET requests (health check)
    if (req.method === 'GET') {
      if (req.url === '/test') {
        try {
          const testResult = await fetchAllEstimates({});
          return res.status(200).json({
            status: 'success',
            message: 'API connection test successful',
            hasData: testResult.success,
            error: testResult.success ? null : testResult.error
          });
        } catch (error) {
          return res.status(500).json({
            status: 'error',
            message: 'API connection test failed',
            error: error.message
          });
        }
      }
      
      // Default health check
      return res.status(200).json({
        status: 'healthy',
        server: 'FunctionPoint-Estimates-API-Server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        tools: ['GetAllEstimates']
      });
    }
    
    // Handle POST requests (MCP protocol)
    if (req.method === 'POST') {
      const contentType = req.headers['content-type'];
      if (!contentType || !contentType.includes('application/json')) {
        return res.status(400).json({
          error: 'Invalid content type',
          message: 'Must use application/json'
        });
      }
      
      // Validate request body
      if (!req.body) {
        return res.status(400).json({
          error: 'Empty request body',
          message: 'JSON-RPC request required'
        });
      }
      
      const result = await handleMCPRequest(req.body);
      return res.status(200).json(result);
    }
    
    // Method not allowed
    return res.status(405).json({
      error: 'Method not allowed',
      allowed: ['GET', 'POST', 'OPTIONS']
    });
    
  } catch (error) {
    console.error('Handler error:', error);
    
    // Make sure we don't send response twice
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
}