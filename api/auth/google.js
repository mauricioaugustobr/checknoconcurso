import { handleGoogleLogin } from '../../lib/auth.js';

export function POST(request) {
  return handleGoogleLogin(request);
}
