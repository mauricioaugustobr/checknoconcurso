import { handleSession } from '../../lib/auth.js';

export function GET(request) {
  return handleSession(request);
}
