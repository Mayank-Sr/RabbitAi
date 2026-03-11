const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sales Insight Automator API',
      version: '1.0.0',
      description: `
## Overview
The **Sales Insight Automator** is a secure REST API that ingests CSV/XLSX sales data,
generates a professional AI-powered executive summary via Google Gemini, and delivers
it directly to a specified email address.

## Authentication
All \`/api/*\` endpoints require an **API key** passed in the \`X-API-Key\` header.

\`\`\`
X-API-Key: your-secret-api-key
\`\`\`

## Rate Limits
- **Global**: 100 requests per 15-minute window per IP
- **Upload endpoint**: 5 requests per minute per IP
      `,
      contact: {
        name: 'Rabbitt AI Engineering',
        email: 'engineering@rabbittai.com',
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:3001',
        description: 'Primary server',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for endpoint authentication',
        },
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Sales insight summary sent to user@example.com' },
            requestId: { type: 'string', format: 'uuid' },
            stats: {
              type: 'object',
              properties: {
                totalRows: { type: 'integer', example: 42 },
                columns: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'A valid recipient email is required' },
          },
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
    tags: [
      { name: 'Upload', description: 'File upload and AI summary generation' },
      { name: 'System', description: 'Server health and status' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
