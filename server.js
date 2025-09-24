import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";

const server = new McpServer({
  name: "estimate-api",
  version: "1.0.0"
});

async function getAllEst() {
  const res = await axios.get(
    "https://api-platform.functionpoint.com/estimates?page=1&itemsPerPage=20",
    {
      headers: {
        accept: "application/ld+json",
        Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTg3ODM4NTAsImF1ZCI6WyJoZWxpdW0uZnVuY3Rpb25wb2ludC5jb20iLCJuZXh0ZnAuZnVuY3Rpb25wb2ludC5jb20iLCJob3N0ZWQuZnVuY3Rpb25wb2ludC5jb20iLCJiZXRhLmZ1bmN0aW9ucG9pbnQuY29tIiwiZGVtby5mdW5jdGlvbnBvaW50LmNvbSIsImhlbGl1bTcuZnVuY3Rpb25wb2ludC5jb20iLCJuZXh0ZnA3LmZ1bmN0aW9ucG9pbnQuY29tIiwiaG9zdGVkNy5mdW5jdGlvbnBvaW50LmNvbSIsImJldGE3LmZ1bmN0aW9ucG9pbnQuY29tIiwiZGVtbzcuZnVuY3Rpb25wb2ludC5jb20iXSwiaXNzIjoiaHR0cDovL2ZwYXV0aC5mdW5jdGlvbnBvaW50LmNvbSIsInRpbWVzdGFtcCI6MTc1ODE3OTA1MC44MzYsInVzZXIiOnsiaWQiOjI5LCJuYW1lIjoiQ2Fyc29uIERlYW4iLCJlbWFpbCI6ImNkZWFuQGJyYW5kMzMuY29tIiwidGl0bGUiOiJDYXJzb24gRGVhbiIsImlzUG9ydGFsVXNlciI6ZmFsc2V9LCJjb21wYW55Ijp7ImlkIjo4MDAzOTM5LCJuYW1lIjoiYnJhbmQzMyIsInRpdGxlIjoiQlJBTkQzMyIsImxvZ29VcmwiOiIiLCJkZXBsb3lEaXIiOiJmcHhfcDMiLCJkYkxvY2F0aW9uIjoiaGVsaXVtNy5mdW5jdGlvbnBvaW50LmNvbSIsImRhdGVGb3JtYXQiOiJNIGQgWSJ9LCJvZmZpY2UiOnsidGltZXpvbmUiOiJVUy9QYWNpZmljIiwiY3VycmVuY3lTeW1ib2wiOiIkIiwidGhvdXNhbmRTZXBhcmF0b3IiOiIsIiwiZGVjaW1hbFNlcGFyYXRvciI6Ii4ifSwiYWRkb25zIjp7ImJpciI6InByZW1pdW0iLCJxYm9lIjoiZW5hYmxlZCJ9LCJzZXNzaW9uSW5mbyI6IllwRFlnVzhDdElKVVBsRXd5VmZzMTd1RjVXaUNMUGRtSVpRRERWWVBJWmFpME5wYnR0RXlaV014SUx2cFgyRDhsTHlYRXJibkJvKzFWZHVEd0YxcWtiSFZuZTNUbm9KTzFuR2NLcDRHeDV1WEU0YzhQUnh4VXc9PSIsImlhdCI6MTc1ODE3OTA1MH0.vsRe180N-00bsiWFGOV6O2WEZEQyeIkeqQ2LHBLW8IA"
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

(async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
})();