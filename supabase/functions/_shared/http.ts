import { AppError } from './errors.ts';

const parseAllowedOrigins = () =>
  (Deno.env.get('CORS_ORIGIN') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

const allowedOrigins = parseAllowedOrigins();

const resolveOrigin = (request: Request) => {
  const origin = request.headers.get('origin');

  if (!origin) {
    return '*';
  }

  if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
    return origin;
  }

  return allowedOrigins[0] ?? '*';
};

export const getCorsHeaders = (request: Request) => ({
  'Access-Control-Allow-Origin': resolveOrigin(request),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
});

export const jsonResponse = (request: Request, status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...getCorsHeaders(request),
      'Content-Type': 'application/json',
    },
  });

export const sendSuccess = (
  request: Request,
  status: number,
  message: string,
  data: unknown = null,
) =>
  jsonResponse(request, status, {
    success: true,
    message,
    ...(data !== null ? { data } : {}),
  });

export const sendError = (request: Request, error: unknown) => {
  if (error instanceof AppError) {
    return jsonResponse(request, error.statusCode, {
      success: false,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }

  const message = error instanceof Error ? error.message : 'Internal server error';
  console.error(error);
  return jsonResponse(request, 500, {
    success: false,
    message,
  });
};

export const handleOptions = (request: Request) =>
  new Response('ok', {
    headers: getCorsHeaders(request),
  });
