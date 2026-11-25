import { handleUsers } from '../../lib/admin-api.js';

export function GET(request) {
  return handleUsers(request);
}
