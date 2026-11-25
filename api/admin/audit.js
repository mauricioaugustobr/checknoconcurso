import { handleAudit } from '../../lib/admin-api.js';

export function GET(request) {
  return handleAudit(request);
}
