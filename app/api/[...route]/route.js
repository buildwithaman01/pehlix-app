import serverless from 'serverless-http';
import { app } from '../../../src/app.js';
import { connectDB } from '../../../src/utils/db.js';

// Wrap the Express app with serverless-http
const handler = serverless(app);

async function handleRequest(nextRequest) {
  // Ensure the MongoDB connection is active
  await connectDB();

  // Parse URL and search parameters
  const url = new URL(nextRequest.url);
  
  // Extract and clone request headers
  const headers = {};
  nextRequest.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // Extract body and handle base64 encoding for binary/multipart payloads if needed
  let body = '';
  let isBase64Encoded = false;
  
  if (nextRequest.body) {
    const contentType = nextRequest.headers.get('content-type') || '';
    if (
      contentType.includes('multipart/form-data') || 
      contentType.includes('image/') || 
      contentType.includes('application/octet-stream')
    ) {
      const buffer = Buffer.from(await nextRequest.arrayBuffer());
      body = buffer.toString('base64');
      isBase64Encoded = true;
    } else {
      body = await nextRequest.text();
    }
  }

  // Construct standard Lambda API Gateway proxy event
  const event = {
    path: url.pathname,
    httpMethod: nextRequest.method,
    headers,
    queryStringParameters: Object.fromEntries(url.searchParams.entries()),
    body,
    isBase64Encoded,
    requestContext: {},
    multiValueHeaders: {}
  };

  // Process the request through the Express stack
  const result = await handler(event, {});

  // Construct response headers from the lambda execution result
  const responseHeaders = new Headers();
  if (result.headers) {
    Object.entries(result.headers).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });
  }
  
  if (result.multiValueHeaders) {
    Object.entries(result.multiValueHeaders).forEach(([key, values]) => {
      values.forEach(val => responseHeaders.append(key, val));
    });
  }

  // Decode base64 response body if returned by serverless-http
  const responseBody = result.isBase64Encoded 
    ? Buffer.from(result.body, 'base64') 
    : result.body;

  return new Response(responseBody, {
    status: result.statusCode,
    headers: responseHeaders
  });
}

// Export catch-all endpoint methods mapped to the handler
export async function GET(req) { return handleRequest(req); }
export async function POST(req) { return handleRequest(req); }
export async function PUT(req) { return handleRequest(req); }
export async function DELETE(req) { return handleRequest(req); }
export async function PATCH(req) { return handleRequest(req); }
export async function OPTIONS(req) { return handleRequest(req); }
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
