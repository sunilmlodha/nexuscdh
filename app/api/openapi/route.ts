/**
 * /api/openapi — machine-readable OpenAPI 3.1 spec for the public Stratcheck API.
 * Powers SDK generation, Postman import, and the API Reference page.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const base = req.nextUrl.origin;
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Stratcheck Decision API',
      version: '1.0.0',
      description: 'Real-time next-best-action decisioning, Pega CDH-compatible. Authenticate external calls with the `X-API-Key` header (create keys in Settings → API Keys). Rate limited to 120 req/min per key; responses carry `X-RateLimit-*` headers and 429s include `Retry-After`.',
    },
    servers: [{ url: base }],
    components: {
      securitySchemes: { ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' } },
      schemas: {
        Action: {
          type: 'object',
          properties: {
            id: { type: 'string' }, name: { type: 'string' }, headline: { type: 'string' },
            offerCode: { type: 'string' }, channel: { type: 'string' }, propensity: { type: 'number' },
          },
        },
        Arbitration: {
          type: 'object',
          description: 'Pega-style P×C×V×L explainability for the winning action and the full ranked set.',
          properties: { formula: { type: 'string' }, winner: { type: 'object' }, ranked: { type: 'array', items: { type: 'object' } } },
        },
        DecisionResponse: {
          type: 'object',
          properties: {
            served: { type: 'boolean' }, decisionId: { type: 'string' },
            action: { $ref: '#/components/schemas/Action' }, arbitration: { $ref: '#/components/schemas/Arbitration' },
            suppressionReason: { type: 'string', nullable: true }, latencyMs: { type: 'number' },
          },
        },
        Error: { type: 'object', properties: { error: { type: 'string' }, hint: { type: 'string' } } },
      },
    },
    security: [{ ApiKeyAuth: [] }],
    paths: {
      '/api/decide': {
        post: {
          operationId: 'decideStrategy', summary: 'Single-strategy decision',
          description: 'Evaluate one strategy for a customer and return the arbitrated best action.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object', required: ['customerId', 'strategyId'],
              properties: {
                customerId: { type: 'string' }, strategyId: { type: 'string' },
                tenantId: { type: 'string' }, attributes: { type: 'object', additionalProperties: true },
              },
            } } },
          },
          responses: {
            '200': { description: 'Decision', content: { 'application/json': { schema: { $ref: '#/components/schemas/DecisionResponse' } } } },
            '400': { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '429': { description: 'Rate limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
        get: {
          operationId: 'decideGlobalNBA', summary: 'Global next-best-action',
          description: 'Evaluate ALL active strategies and return the single best action across the customer.',
          parameters: [
            { name: 'customerId', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'tenantId', in: 'query', schema: { type: 'string' } },
            { name: 'attributes', in: 'query', description: 'URL-encoded JSON of customer attributes', schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Decision', content: { 'application/json': { schema: { $ref: '#/components/schemas/DecisionResponse' } } } },
            '400': { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '429': { description: 'Rate limit exceeded' },
          },
        },
      },
      '/api/v4/containers/{name}': {
        post: {
          operationId: 'v4Container', summary: 'Pega V4 Real-Time Container',
          description: 'Pega CDH-compatible container API. Returns ranked actions in V4 format.',
          parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string', enum: ['PrimaryContainer', 'SalesContainer', 'RetentionContainer', 'OnboardingContainer'] } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: {
              type: 'object',
              properties: { context: { type: 'object' }, channel: { type: 'string' }, tenantId: { type: 'string' }, maxActions: { type: 'integer' } },
            } } },
          },
          responses: { '200': { description: 'Ranked container actions' } },
        },
      },
      '/api/identity': {
        get: {
          operationId: 'resolveIdentity', summary: 'Resolve / list identities',
          parameters: [
            { name: 'resolve', in: 'query', schema: { type: 'string' }, description: 'Alias value to resolve to a customer' },
            { name: 'type', in: 'query', schema: { type: 'string', enum: ['email', 'phone', 'device', 'external', 'cookie'] } },
            { name: 'customerId', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Aliases or resolved customer' } },
        },
        post: {
          operationId: 'linkIdentity', summary: 'Link an identifier or merge profiles',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
          responses: { '200': { description: 'Linked / merged' }, '401': { description: 'Unauthorized' } },
        },
      },
      '/api/consent': {
        get: { operationId: 'consentHistory', summary: 'Consent ledger for a customer', responses: { '200': { description: 'Consent records' } } },
        post: { operationId: 'recordConsent', summary: 'Record grant/withdraw', responses: { '200': { description: 'Recorded' } } },
      },
    },
  };
  return NextResponse.json(spec, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
