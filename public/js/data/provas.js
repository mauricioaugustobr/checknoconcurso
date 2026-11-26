/**
 * ============================================================================
 * Check no Concurso — Banco de provas anteriores (dados)
 * ============================================================================
 * Cada prova é identificada pelo id do concurso e pelo ano.
 *
 * {
 *   edicao: "PM-SP 2025",          // nome que aparece na tela
 *   ano: 2025,
 *   banca: "Fundação Vunesp",
 *   cargo: "Aluno-Soldado PM de 2ª Classe",
 *   totalQuestoes: 60,             // total da prova oficial
 *   fonte: "https://...",          // PDF oficial do caderno (opcional)
 *   gabaritoFonte: "https://...",  // PDF oficial do gabarito (opcional)
 *   status: "completa" | "amostra",
 *   questoes: [
 *     {
 *       numero: 1,
 *       disciplina: "Língua Portuguesa",
 *       enunciado: "texto da questão",
 *       alternativas: [{ letra: "A", texto: "..." }, ...],
 *       correta: "B",
 *       explicacao: "por que a correta é a correta e por que as outras não são",
 *       fonte: "Gabarito oficial — questão 1"   // opcional
 *     }
 *   ]
 * }
 *
 * Regra editorial: só entra questão com o caderno e o gabarito oficiais
 * conferidos. Enquanto a curadoria não entrega, a prova fica com
 * status: "amostra" e a tela avisa que é uma prévia de interface.
 */

export const PROVAS = {
  "pm-sp-soldado-2026": {
    2025: {
      edicao: "PM-SP 2025",
      ano: 2025,
      banca: "Fundação Vunesp",
      cargo: "Aluno-Soldado PM de 2ª Classe",
      totalQuestoes: 60,
      status: "amostra",
      fonte: null,
      gabaritoFonte: null,
      questoes: [
        {
          numero: 1,
          disciplina: "Língua Portuguesa",
          enunciado:
            "Assinale a alternativa em que a concordância verbal está de acordo com a norma-padrão da língua portuguesa.",
          alternativas: [
            { letra: "A", texto: "Fazem dois anos que o candidato se prepara para o concurso." },
            { letra: "B", texto: "Faz dois anos que o candidato se prepara para o concurso." },
            { letra: "C", texto: "Fazem dois anos que os candidatos se prepara para o concurso." },
            { letra: "D", texto: "Faz dois anos que os candidato se preparam para o concurso." },
            { letra: "E", texto: "Fazem dois ano que o candidato se prepara para o concurso." },
          ],
          correta: "B",
          explicacao:
            "O verbo fazer, quando indica tempo decorrido, é impessoal: fica sempre na 3ª pessoa do singular, sem concordar com o número de anos. Por isso o certo é “Faz dois anos”. As alternativas A e E flexionam o verbo indevidamente; C e D erram também a concordância do sujeito com o verbo “preparar”.",
          fonte: "Questão de demonstração — regra de concordância verbal",
        },
        {
          numero: 2,
          disciplina: "Língua Portuguesa",
          enunciado:
            "No trecho “O candidato estudou muito, portanto foi aprovado”, a palavra “portanto” estabelece entre as orações uma relação de",
          alternativas: [
            { letra: "A", texto: "oposição." },
            { letra: "B", texto: "conclusão." },
            { letra: "C", texto: "causa." },
            { letra: "D", texto: "condição." },
            { letra: "E", texto: "finalidade." },
          ],
          correta: "B",
          explicacao:
            "“Portanto” é uma conjunção coordenativa conclusiva: ela apresenta o resultado lógico do que foi dito antes. Oposição seria “mas”; causa, “porque”; condição, “se”; finalidade, “para que”.",
          fonte: "Questão de demonstração — conjunções",
        },
        {
          numero: 3,
          disciplina: "Matemática",
          enunciado:
            "Um candidato acertou 42 das 60 questões de uma prova. O percentual de acertos foi de",
          alternativas: [
            { letra: "A", texto: "60%" },
            { letra: "B", texto: "65%" },
            { letra: "C", texto: "70%" },
            { letra: "D", texto: "75%" },
            { letra: "E", texto: "80%" },
          ],
          correta: "C",
          explicacao:
            "Basta dividir os acertos pelo total e multiplicar por 100: 42 ÷ 60 = 0,70, ou seja, 70%. Outra conta possível: 10% de 60 são 6 questões; 42 correspondem a 7 grupos de 6, então 70%.",
          fonte: "Questão de demonstração — porcentagem",
        },
        {
          numero: 4,
          disciplina: "Matemática",
          enunciado:
            "Uma equipe de 4 policiais faz um levantamento em 12 dias. Mantendo o mesmo ritmo de trabalho, quantos dias 6 policiais levariam para fazer o mesmo levantamento?",
          alternativas: [
            { letra: "A", texto: "6 dias" },
            { letra: "B", texto: "8 dias" },
            { letra: "C", texto: "9 dias" },
            { letra: "D", texto: "10 dias" },
            { letra: "E", texto: "18 dias" },
          ],
          correta: "B",
          explicacao:
            "As grandezas são inversamente proporcionais: mais policiais, menos dias. O trabalho total é 4 × 12 = 48 pessoas-dia. Com 6 policiais: 48 ÷ 6 = 8 dias.",
          fonte: "Questão de demonstração — regra de três inversa",
        },
        {
          numero: 5,
          disciplina: "Conhecimentos Gerais",
          enunciado:
            "A Constituição Federal de 1988 define a segurança pública como dever do Estado, direito e responsabilidade de todos. Segundo o texto constitucional, a polícia militar destina-se",
          alternativas: [
            { letra: "A", texto: "ao patrulhamento ostensivo e à preservação da ordem pública." },
            { letra: "B", texto: "à investigação dos crimes contra a Administração Pública." },
            { letra: "C", texto: "à execução das penas privativas de liberdade." },
            { letra: "D", texto: "ao julgamento dos crimes militares." },
            { letra: "E", texto: "à defesa dos interesses da União em juízo." },
          ],
          correta: "A",
          explicacao:
            "A Constituição atribui às polícias militares a polícia ostensiva e a preservação da ordem pública. Investigação de crimes comuns é função da polícia civil; execução penal, dos órgãos penitenciários; julgamento, do Poder Judiciário; e a defesa da União em juízo cabe à Advocacia-Geral da União.",
          fonte: "Questão de demonstração — art. 144 da Constituição Federal",
        },
        {
          numero: 6,
          disciplina: "Conhecimentos Gerais",
          enunciado:
            "O estado de São Paulo faz parte de qual região brasileira?",
          alternativas: [
            { letra: "A", texto: "Centro-Oeste" },
            { letra: "B", texto: "Nordeste" },
            { letra: "C", texto: "Norte" },
            { letra: "D", texto: "Sudeste" },
            { letra: "E", texto: "Sul" },
          ],
          correta: "D",
          explicacao:
            "O Sudeste reúne quatro estados: São Paulo, Minas Gerais, Rio de Janeiro e Espírito Santo. São Paulo é o mais populoso do país e faz divisa com Minas Gerais, Rio de Janeiro e Paraná.",
          fonte: "Questão de demonstração — geografia do Brasil",
        },
      ],
    },
  },
};

export function getProva(concursoId, ano) {
  const porAno = PROVAS[concursoId];
  if (!porAno) return null;
  if (ano && porAno[ano]) return porAno[ano];
  const anos = Object.keys(porAno).map(Number).sort((a, b) => b - a);
  return anos.length ? porAno[anos[0]] : null;
}

export function temProva(concursoId) {
  return Boolean(PROVAS[concursoId]);
}
