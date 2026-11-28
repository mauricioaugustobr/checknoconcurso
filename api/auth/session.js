import { handleSession } from '../../lib/auth.js';

export function GET(request) {
  return handleSession(request);
}

// Entrar ou criar conta com e-mail e senha (mesma sessão do login com Google)
export function POST(request) {
  return handleSession(request);
}
