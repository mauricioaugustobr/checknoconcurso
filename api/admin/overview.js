import { handleOverview } from '../../lib/admin-api.js';

export function GET(request) {
  return handleOverview(request);
}
