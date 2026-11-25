// Pagamentos Stripe: /api/stripe/:acao → /api/stripe?acao=:acao (vercel.json). Uma só função (limite do plano Hobby).
import { handleCheckout, handleConfirm, handlePortal, handleWebhook } from '../lib/stripe.js';
import { authJson as json } from '../lib/auth.js';

import { handlePix } from '../lib/pix.js';
const ACOES = { pix: handlePix, checkout: handleCheckout, confirm: handleConfirm, portal: handlePortal, webhook: handleWebhook };

export async function POST(request) {
  const handler = ACOES[new URL(request.url).searchParams.get('acao')];
  if (!handler) return json({ error: 'Rota de pagamento não encontrada' }, 404);
  try {
    return await handler(request);
  } catch (err) {
    console.error('[api/stripe] erro:', err.message);
    return json({ error: 'Não foi possível falar com a Stripe agora. Tente de novo.' }, 502);
  }
}
