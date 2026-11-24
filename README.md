# Check no Concurso — Site + App (PWA)

Protótipo oficial do **Check no Concurso** (`checknoconcurso.com.br`): plataforma web responsiva e aplicativo instalável (PWA) focada em divulgar **todos os concursos abertos do Brasil**, mantendo **datas de prova sempre atualizadas**, marcando certames **encerrados/terminados**, oferecendo editais com raio-x, comparador de cursos parceiros e — em breve — as **5 provas anteriores** de cada concurso.

## Como rodar localmente

1. Dê um duplo clique em `iniciar_check_no_concurso.bat`, **ou** rode no terminal:
   ```bash
   npm start
   ```
2. Abra `http://localhost:3400` no navegador.
3. Para rodar os testes automatizados:
   ```bash
   npm test
   ```

## Estrutura de Planos Implementada no Protótipo

| Plano | Valor | O que libera |
|---|---|---|
| **Visitante** | Grátis | Lista de concursos abertos e encerrados, datas de prova e 3 destaques completos (BB, PF e INSS) |
| **Check Essencial** | **R$ 6,99/mês** | 100% dos concursos ativos e encerrados, datas de prova atualizadas, editais completos + Raio-X, comparador de cursos com cupons e alertas no App |
| **Check Completo** | **R$ 17,99/mês** ou **R$ 199,90/ano** (mais barato: R$ 16,66/mês) | Tudo do Essencial **+ banco com as 5 provas anteriores e gabaritos oficiais** de todos os concursos abertos *(em breve — com prévia interativa no protótipo)* |

## Funcionalidades já testáveis

- **Calendário & Status Completos (28 concursos — 25 ativos + 3 encerrados)**:
  - Status diferenciados: **Inscrições Abertas**, **Edital Publicado**, **Prova Agendada**, **Previsto / Autorizado** e **Encerrado** (ex: TSE Unificado, PRF e IBGE com prova já realizada).
  - Faixa em destaque de **Data da Prova** em cada card, com contagem regressiva e aviso de retificação/encerramento.
  - Ordenação por **Data da prova mais próxima**, fim de inscrição, maior salário ou mais vagas.
- **Modal Completo em 4 Abas**:
  1. **Visão Geral**: cronograma atualizado, tabela de cargos/salários e etapas.
  2. **Edital & Raio-X**: distribuição das disciplinas por peso + botão funcional **Baixar Raio-X do Edital**.
  3. **Cursos Parceiros**: comparação lado a lado (Estratégia, Gran, Direção, QConcursos, AlfaCon, Nova) com cópia de cupom.
  4. **5 Provas Anteriores (Em breve)**: listagem das 5 últimas edições por concurso com gabarito e download de prévia para assinantes do Plano Completo.
- **Checkout Multi-Plano (Pix + Cartão)** e **Barra de Simulação** para testar instantaneamente os 3 níveis (Visitante, Essencial R$ 6,99 e Completo R$ 17,99 / R$ 199,90).
- **Site + App Mobile (PWA)**: botão **Prévia do App Mobile** no topo com simulador de smartphone + disparo de notificações push de alteração de data de prova e encerramento.
