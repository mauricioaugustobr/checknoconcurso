import { handleAuthConfig } from '../../lib/auth.js';

export function GET() {
  return handleAuthConfig();
}
