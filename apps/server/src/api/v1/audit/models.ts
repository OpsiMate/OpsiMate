import { z } from 'zod';

// Mirrors AlertListQueryParamsSchema (apps/server/src/api/v1/alerts/models.ts) — same
// coercion + bounds pattern, capped at 100 since audit pages are rendered in a UI table,
// not consumed as a bulk export.
export const AuditListQueryParamsSchema = z.object({
	page: z.coerce.number().int().min(1).optional().default(1),
	pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});
