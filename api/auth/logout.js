import { handleLogout } from '../../lib/auth.js';

export function POST(request) {
  return handleLogout(request);
}
