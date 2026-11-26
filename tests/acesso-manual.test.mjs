// Liberação e bloqueio manual do admin (lib/acesso-manual.js → aplicarRegraManual)
import assert from 'node:assert/strict';
import { aplicarRegraManual } from '../lib/acesso-manual.js';

const pago = (plan) => ({ email: 'a@b.com', role: 'user', plan, planMethod: 'Pix' });

// Bloqueado: perde o acesso mesmo tendo pago
let r = aplicarRegraManual(pago('completo-mensal'), { modo: 'bloqueado' });
assert.equal(r.plan, null); assert.equal(r.bloqueado, true);
// Liberado Completo sem pagamento
r = aplicarRegraManual(pago(null), { modo: 'liberado', tier: 'completo-mensal', ate: null });
assert.equal(r.plan, 'completo-mensal'); assert.equal(r.planMethod, 'Liberado pelo admin');
// Liberado Completo por cima do Essencial pago
assert.equal(aplicarRegraManual(pago('essencial'), { modo: 'liberado', tier: 'completo-mensal' }).plan, 'completo-mensal');
// Liberado Essencial não rebaixa quem pagou o Completo
r = aplicarRegraManual(pago('completo-anual'), { modo: 'liberado', tier: 'essencial' });
assert.equal(r.plan, 'completo-anual'); assert.equal(r.planMethod, 'Pix');
// Admin nunca é bloqueado
assert.equal(aplicarRegraManual({ email: 'x@y.com', role: 'admin', plan: null }, { modo: 'bloqueado' }).bloqueado, undefined);
// Sem regra: nada muda
assert.deepEqual(aplicarRegraManual(pago('essencial'), null), pago('essencial'));
console.log('OK: liberação e bloqueio manual do admin — bloqueio vence o pagamento, liberação nunca rebaixa plano pago, admin intocável.');
