import { db } from '../_shared/db.ts';
import { requireUser } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { handleOptions, sendError, sendSuccess } from '../_shared/http.ts';
import { readJsonBody, validate } from '../_shared/validation.ts';
import {
  addLedgerEntrySchema,
  createPartySchema,
  guestLoginSchema,
  importSalesSchema,
  ledgerEntryIdSchema,
  loginSchema,
  partyIdSchema,
  partyListSchema,
  registerSchema,
} from '../_shared/schemas.ts';
import { authService } from '../_shared/services/auth-service.ts';
import { dashboardService } from '../_shared/services/dashboard-service.ts';
import { partyService } from '../_shared/services/party-service.ts';

const apiPrefix = Deno.env.get('API_PREFIX') ?? '/api/v1';
const functionPrefix = '/functions/v1/api';

const normalizeRoutePath = (pathname: string) => {
  let routePath = pathname;

  if (routePath.startsWith(functionPrefix)) {
    routePath = routePath.slice(functionPrefix.length) || '/';
  }

  if (!routePath.startsWith('/')) {
    routePath = `/${routePath}`;
  }

  if (apiPrefix && apiPrefix !== '/' && routePath.startsWith(apiPrefix)) {
    routePath = routePath.slice(apiPrefix.length) || '/';
  }

  if (routePath === '/api' || routePath.startsWith('/api/')) {
    routePath = routePath.slice('/api'.length) || '/';
  }

  return routePath || '/';
};

const getQuery = (request: Request) => {
  const url = new URL(request.url);
  return Object.fromEntries(url.searchParams.entries());
};

const rootMessage = 'ZE Ledger Supabase API is running.';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }

  try {
    const routePath = normalizeRoutePath(new URL(request.url).pathname);

    if (request.method === 'GET' && routePath === '/') {
      return sendSuccess(request, 200, rootMessage, {
        docs: '/health',
        legacyDocsPath: `${apiPrefix}/health`,
      });
    }

    if (request.method === 'GET' && routePath === '/health') {
      await db.query('SELECT 1');
      return sendSuccess(request, 200, 'Service healthy', {
        databaseState: 'connected',
        timestamp: new Date().toISOString(),
      });
    }

    if (request.method === 'POST' && routePath === '/auth/register') {
      const body = await readJsonBody(request);
      const value = validate(registerSchema, { body });
      const result = await authService.register(db, value.body);
      return sendSuccess(request, 201, 'User registered successfully', result);
    }

    if (request.method === 'POST' && routePath === '/auth/login') {
      const body = await readJsonBody(request);
      const value = validate(loginSchema, { body });
      const result = await authService.login(db, value.body);
      return sendSuccess(request, 200, 'Login successful', result);
    }

    if (request.method === 'POST' && routePath === '/auth/guest') {
      const body = await readJsonBody(request);
      const value = validate(guestLoginSchema, { body });
      const result = await authService.loginAsGuest(db, value.body);
      return sendSuccess(request, 201, 'Guest session created', result);
    }

    if (request.method === 'GET' && routePath === '/auth/me') {
      const user = await requireUser(request, db);
      const result = await authService.getProfile(db, user.id);
      return sendSuccess(request, 200, 'Profile fetched successfully', result);
    }

    if (request.method === 'GET' && routePath === '/dashboard/summary') {
      const user = await requireUser(request, db);
      const result = await dashboardService.getSummary(db, user.id);
      return sendSuccess(request, 200, 'Dashboard summary fetched successfully', result);
    }

    if (request.method === 'GET' && routePath === '/dashboard/recent-activity') {
      const user = await requireUser(request, db);
      const result = await dashboardService.getRecentActivity(db, user.id);
      return sendSuccess(request, 200, 'Recent activity fetched successfully', result);
    }

    if (request.method === 'GET' && routePath === '/parties') {
      const user = await requireUser(request, db);
      const query = getQuery(request);
      const value = validate(partyListSchema, { query });
      const result = await partyService.listParties(db, user.id, value.query.search ?? '');
      return sendSuccess(request, 200, 'Parties fetched successfully', result);
    }

    if (request.method === 'POST' && routePath === '/parties') {
      const user = await requireUser(request, db);
      const body = await readJsonBody(request);
      const value = validate(createPartySchema, { body });
      const result = await partyService.createParty(user.id, value.body);
      return sendSuccess(request, 201, 'Party created successfully', result);
    }

    if (request.method === 'POST' && routePath === '/parties/import-sales') {
      const user = await requireUser(request, db);
      const body = await readJsonBody(request);
      const value = validate(importSalesSchema, { body });
      const result = await partyService.importSales(user.id, value.body);
      return sendSuccess(request, 201, 'Sales imported successfully', result);
    }

    const partySummaryMatch = routePath.match(/^\/parties\/(\d+)\/summary$/);
    if (request.method === 'GET' && partySummaryMatch) {
      const user = await requireUser(request, db);
      const value = validate(partyIdSchema, {
        params: {
          partyId: Number(partySummaryMatch[1]),
        },
      });
      const result = await dashboardService.getPartySummary(db, user.id, value.params.partyId);
      return sendSuccess(request, 200, 'Party summary fetched successfully', result);
    }

    const ledgerEntriesMatch = routePath.match(/^\/parties\/(\d+)\/ledger-entries$/);
    if (request.method === 'GET' && ledgerEntriesMatch) {
      const user = await requireUser(request, db);
      const value = validate(partyIdSchema, {
        params: {
          partyId: Number(ledgerEntriesMatch[1]),
        },
      });
      const result = await partyService.listLedgerEntries(db, user.id, value.params.partyId);
      return sendSuccess(request, 200, 'Ledger entries fetched successfully', result);
    }

    if (request.method === 'POST' && ledgerEntriesMatch) {
      const user = await requireUser(request, db);
      const body = await readJsonBody(request);
      const value = validate(addLedgerEntrySchema, {
        params: {
          partyId: Number(ledgerEntriesMatch[1]),
        },
        body,
      });
      const result = await partyService.addLedgerEntry(user.id, value.params.partyId, value.body);
      return sendSuccess(request, 201, 'Ledger entry created successfully', result);
    }

    const deleteLedgerEntryMatch = routePath.match(/^\/parties\/(\d+)\/ledger-entries\/(\d+)$/);
    if (request.method === 'DELETE' && deleteLedgerEntryMatch) {
      const user = await requireUser(request, db);
      const value = validate(ledgerEntryIdSchema, {
        params: {
          partyId: Number(deleteLedgerEntryMatch[1]),
          entryId: Number(deleteLedgerEntryMatch[2]),
        },
      });
      const result = await partyService.deleteLedgerEntry(
        user.id,
        value.params.partyId,
        value.params.entryId,
      );
      return sendSuccess(request, 200, 'Ledger entry deleted successfully', result);
    }

    const partyMatch = routePath.match(/^\/parties\/(\d+)$/);
    if (request.method === 'GET' && partyMatch) {
      const user = await requireUser(request, db);
      const value = validate(partyIdSchema, {
        params: {
          partyId: Number(partyMatch[1]),
        },
      });
      const result = await partyService.getPartyById(db, user.id, value.params.partyId);
      return sendSuccess(request, 200, 'Party fetched successfully', result);
    }

    return sendError(request, new AppError('Route not found', 404));
  } catch (error) {
    return sendError(request, error);
  }
});
