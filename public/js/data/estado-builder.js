/**
 * Construtor modular para os maiores concursos de cada uma das 27 Unidades Federativas do Brasil.
 * Mantém compatibilidade 100% com o schema de public/js/data/concursos.js e smoke.test.mjs.
 */

export const ESTADOS_BRASIL = {
  AC: { nome: 'Acre', regiao: 'Norte' },
  AL: { nome: 'Alagoas', regiao: 'Nordeste' },
  AM: { nome: 'Amazonas', regiao: 'Norte' },
  AP: { nome: 'Amapá', regiao: 'Norte' },
  BA: { nome: 'Bahia', regiao: 'Nordeste' },
  CE: { nome: 'Ceará', regiao: 'Nordeste' },
  DF: { nome: 'Distrito Federal', regiao: 'Centro-Oeste' },
  ES: { nome: 'Espírito Santo', regiao: 'Sudeste' },
  GO: { nome: 'Goiás', regiao: 'Centro-Oeste' },
  MA: { nome: 'Maranhão', regiao: 'Nordeste' },
  MG: { nome: 'Minas Gerais', regiao: 'Sudeste' },
  MS: { nome: 'Mato Grosso do Sul', regiao: 'Centro-Oeste' },
  MT: { nome: 'Mato Grosso', regiao: 'Centro-Oeste' },
  PA: { nome: 'Pará', regiao: 'Norte' },
  PB: { nome: 'Paraíba', regiao: 'Nordeste' },
  PE: { nome: 'Pernambuco', regiao: 'Nordeste' },
  PI: { nome: 'Piauí', regiao: 'Nordeste' },
  PR: { nome: 'Paraná', regiao: 'Sul' },
  RJ: { nome: 'Rio de Janeiro', regiao: 'Sudeste' },
  RN: { nome: 'Rio Grande do Norte', regiao: 'Nordeste' },
  RO: { nome: 'Rondônia', regiao: 'Norte' },
  RR: { nome: 'Roraima', regiao: 'Norte' },
  RS: { nome: 'Rio Grande do Sul', regiao: 'Sul' },
  SC: { nome: 'Santa Catarina', regiao: 'Sul' },
  SE: { nome: 'Sergipe', regiao: 'Nordeste' },
  SP: { nome: 'São Paulo', regiao: 'Sudeste' },
  TO: { nome: 'Tocantins', regiao: 'Norte' }
};

const BANCA_URLS = {
  'Cebraspe': 'https://www.cebraspe.org.br/concursos',
  'FGV': 'https://conhecimento.fgv.br/concursos',
  'FCC': 'https://www.concursosfcc.com.br',
  'Fundação Carlos Chagas (FCC)': 'https://www.concursosfcc.com.br',
  'Fundação Vunesp': 'https://www.vunesp.com.br',
  'IDECAN': 'https://www.idecan.org.br',
  'Instituto AOCP': 'https://www.institutoaocp.org.br',
  'IBFC': 'https://www.ibfc.org.br',
  'IBADE': 'https://www.ibade.org.br',
  'Instituto Quadrix': 'https://www.quadrix.org.br',
  'Instituto Consulplan': 'https://www.institutoconsulplan.org.br',
  'Instituto Selecon': 'https://selecon.org.br',
  'Instituto Avalia': 'https://www.avalia.org.br',
  'Instituto ACCESS': 'https://www.access.org.br',
  'Fundação Cesgranrio': 'https://www.cesgranrio.org.br',
  'Fundatec': 'https://www.fundatec.org.br',
  'IADES': 'https://www.iades.com.br',
  'Instituto Verbena (UFG)': 'https://sistemas.institutoverbena.ufg.br',
  'IBGP': 'https://novo.ibgpconcursos.com.br',
  'IBAM': 'https://www.ibam-concursos.org.br',
  'IDCAP': 'https://www.idcap.org.br',
  'FAPEC': 'https://concurso.fapec.org',
  'Instituto Consulpam': 'https://www.consulpam.com.br',
  'Instituto Nazaré': 'https://www.institutonazare.com.br',
  'Objetiva Concursos': 'https://www.objetivas.com.br',
  'CETREDE': 'https://www.cetrede.com.br',
  'COTEC / Fadenor': 'https://cotec.fadenor.com.br',
  'UERR': 'https://cpc.uerr.edu.br'
};

function defaultDisciplinas(area, banca) {
  const b = banca && banca !== 'A definir' ? ` (${banca.replace(/^Fundação\s+/i, '')})` : '';
  switch (area) {
    case 'Policial':
      return [
        { nome: `Direito Penal, Processual Penal e Legislação Especial${b}`, questoes: 30, peso: 40 },
        { nome: 'Língua Portuguesa, Raciocínio Lógico e Informática', questoes: 25, peso: 30 },
        { nome: 'Direito Constitucional, Administrativo e Legislação Institucional', questoes: 25, peso: 30 }
      ];
    case 'Fiscal':
      return [
        { nome: `Direito Tributário, Legislação Tributária Estadual e Auditoria${b}`, questoes: 45, peso: 45 },
        { nome: 'Contabilidade Geral/Avançada, TI e Análise de Dados', questoes: 35, peso: 30 },
        { nome: 'Língua Portuguesa, Direito Const., Adm., Civil e Empresarial', questoes: 40, peso: 25 }
      ];
    case 'Tribunais':
      return [
        { nome: `Conhecimentos Específicos em Direito e Regimento Interno${b}`, questoes: 35, peso: 50 },
        { nome: 'Língua Portuguesa e Redação / Discursiva', questoes: 20, peso: 25 },
        { nome: 'Raciocínio Lógico, Informática e Noções de Sustentabilidade', questoes: 15, peso: 25 }
      ];
    case 'Educação':
      return [
        { nome: `Conhecimentos Pedagógicos, LDB, BNCC e Específicos da Área${b}`, questoes: 25, peso: 50 },
        { nome: 'Língua Portuguesa e Interpretação de Textos', questoes: 15, peso: 25 },
        { nome: 'Legislação Educacional, Estatuto e Conhecimentos Locais', questoes: 10, peso: 25 }
      ];
    case 'Saúde':
      return [
        { nome: `Conhecimentos Específicos da Área da Saúde${b}`, questoes: 25, peso: 50 },
        { nome: 'Legislação do SUS e Políticas Públicas de Saúde', questoes: 15, peso: 25 },
        { nome: 'Língua Portuguesa, Raciocínio Lógico e Ética no Serviço Público', questoes: 10, peso: 25 }
      ];
    case 'Legislativa':
      return [
        { nome: `Regimento Interno, Processo Legislativo e Direito Público${b}`, questoes: 30, peso: 45 },
        { nome: 'Língua Portuguesa e Redação Oficial', questoes: 20, peso: 30 },
        { nome: 'Raciocínio Lógico, Administração Pública e Informática', questoes: 20, peso: 25 }
      ];
    case 'TI e Engenharia':
      return [
        { nome: `Conhecimentos Específicos (TI, Dados, Engenharia e Governança)${b}`, questoes: 40, peso: 55 },
        { nome: 'Língua Portuguesa e Inglês Técnico', questoes: 15, peso: 20 },
        { nome: 'Direito Administrativo, Constitucional e Gestão Pública', questoes: 15, peso: 25 }
      ];
    default:
      return [
        { nome: `Conhecimentos Específicos do Cargo e Gestão Pública${b}`, questoes: 25, peso: 45 },
        { nome: 'Língua Portuguesa, Matemática e Raciocínio Lógico', questoes: 20, peso: 30 },
        { nome: 'Direito Constitucional, Administrativo e Legislação Local', questoes: 15, peso: 25 }
      ];
  }
}

function buildCourses({ sigla, area, esfera, banca, status }) {
  const fase = status === 'Previsto / Autorizado' ? 'Pré-Edital (Atualização Grátis)' : 'Pós-Edital Atualizado';
  const bancaTag = banca && banca !== 'A definir' ? banca.replace(/^Fundação\s+/i, '') : 'Base Oficial';

  if (area === 'Policial') {
    return [
      {
        plataformaId: 'estrategia',
        plataforma: 'Estratégia Concursos',
        titulo: `${sigla} ${fase} — Pacote Completo (${bancaTag})`,
        precoMensal: 59.9,
        precoTotal: 718.8,
        parcelas: '12x de R$ 59,90 (ref.)',
        formato: 'PDFs + Videoaulas + Passo Estratégico + Simulados',
        cargaHoraria: '410h',
        nota: 4.9,
        avaliacoes: 1840,
        destaque: 'Mais Completo',
        cupom: 'CHECK15',
        url: 'https://www.estrategiaconcursos.com.br'
      },
      {
        plataformaId: 'alfacon',
        plataforma: 'AlfaCon',
        titulo: `Carreiras Policiais ${sigla} — Foco ${bancaTag} + TAF`,
        precoMensal: 44.9,
        precoTotal: 538.8,
        parcelas: '12x de R$ 44,90 (ref.)',
        formato: 'Videoaulas + Cadernos + Simulados Policiais',
        cargaHoraria: '340h',
        nota: 4.8,
        avaliacoes: 1560,
        destaque: 'Especialista Policial',
        cupom: 'CHECKALFA15',
        url: 'https://www.alfaconcursos.com.br'
      },
      {
        plataformaId: 'gran',
        plataforma: 'Gran Cursos Online',
        titulo: `${sigla} — Videoaulas + Gran Questões (${bancaTag})`,
        precoMensal: 49.9,
        precoTotal: 598.8,
        parcelas: '12x de R$ 49,90 (ref.)',
        formato: 'Videoaulas + PDFs + Questões Comentadas',
        cargaHoraria: '380h',
        nota: 4.8,
        avaliacoes: 1710,
        destaque: 'Custo-Benefício',
        cupom: 'CHECKGRAN10',
        url: 'https://www.grancursosonline.com.br'
      }
    ];
  }

  if (area === 'Fiscal' || area === 'Tribunais' || area === 'Legislativa') {
    return [
      {
        plataformaId: 'estrategia',
        plataforma: 'Estratégia Concursos',
        titulo: `${sigla} ${fase} — Pacote Teórico + Discursiva (${bancaTag})`,
        precoMensal: 89.9,
        precoTotal: 1078.8,
        parcelas: '12x de R$ 89,90 (ref.)',
        formato: 'PDFs Completos + Videoaulas + Trilhas Estratégicas',
        cargaHoraria: '540h',
        nota: 4.9,
        avaliacoes: 1620,
        destaque: 'Referência na Área',
        cupom: 'CHECK15',
        url: 'https://www.estrategiaconcursos.com.br'
      },
      {
        plataformaId: 'direcao',
        plataforma: 'Direção Concursos',
        titulo: `${sigla} ${fase} — PDF 2.0 Interativo (${bancaTag})`,
        precoMensal: 74.9,
        precoTotal: 898.8,
        parcelas: '12x de R$ 74,90 (ref.)',
        formato: 'PDF 2.0 + Questões Comentadas + Revisão',
        cargaHoraria: '460h',
        nota: 4.9,
        avaliacoes: 1180,
        destaque: 'Melhor Custo-Benefício',
        cupom: 'CHECKDIR12',
        url: 'https://www.direcaoconcursos.com.br'
      },
      {
        plataformaId: 'qconcursos',
        plataforma: 'QConcursos',
        titulo: `Caderno de Questões ${sigla} — Filtro ${bancaTag}`,
        precoMensal: 29.9,
        precoTotal: 358.8,
        parcelas: '12x de R$ 29,90 (ref.)',
        formato: 'Banco de Questões + Comentários em Vídeo',
        cargaHoraria: '180h',
        nota: 4.8,
        avaliacoes: 2040,
        destaque: 'Treino Intensivo',
        cupom: 'CHECKQ15',
        url: 'https://www.qconcursos.com'
      }
    ];
  }

  if (esfera === 'Municipal' || area === 'Educação') {
    return [
      {
        plataformaId: 'nova',
        plataforma: 'Nova Concursos',
        titulo: `${sigla} ${fase} — Pacote Direcionado (${bancaTag})`,
        precoMensal: 24.9,
        precoTotal: 298.8,
        parcelas: '12x de R$ 24,90 (ref.)',
        formato: 'Videoaulas + Apostila Digital + Questões',
        cargaHoraria: '210h',
        nota: 4.7,
        avaliacoes: 1090,
        destaque: 'Mais Econômico',
        cupom: 'CHECKNOVA20',
        url: 'https://www.novaconcursos.com.br'
      },
      {
        plataformaId: 'gran',
        plataforma: 'Gran Cursos Online',
        titulo: `${sigla} — Preparatório Completo (${bancaTag})`,
        precoMensal: 39.9,
        precoTotal: 478.8,
        parcelas: '12x de R$ 39,90 (ref.)',
        formato: 'Videoaulas + PDFs + Gran Questões',
        cargaHoraria: '290h',
        nota: 4.8,
        avaliacoes: 1480,
        destaque: 'Mais Completo',
        cupom: 'CHECKGRAN10',
        url: 'https://www.grancursosonline.com.br'
      }
    ];
  }

  return [
    {
      plataformaId: 'gran',
      plataforma: 'Gran Cursos Online',
      titulo: `${sigla} ${fase} — Pacote Completo (${bancaTag})`,
      precoMensal: 44.9,
      precoTotal: 538.8,
      parcelas: '12x de R$ 44,90 (ref.)',
      formato: 'Videoaulas + PDFs + Questões Comentadas',
      cargaHoraria: '320h',
      nota: 4.8,
      avaliacoes: 1390,
      destaque: 'Mais Completo',
      cupom: 'CHECKGRAN10',
      url: 'https://www.grancursosonline.com.br'
    },
    {
      plataformaId: 'qconcursos',
      plataforma: 'QConcursos',
      titulo: `Trilha de Questões ${sigla} — ${bancaTag}`,
      precoMensal: 24.9,
      precoTotal: 298.8,
      parcelas: '12x de R$ 24,90 (ref.)',
      formato: 'Questões Comentadas + Simulados por Banca',
      cargaHoraria: '160h',
      nota: 4.8,
      avaliacoes: 1750,
      destaque: 'Melhor Preço',
      cupom: 'CHECKQ15',
      url: 'https://www.qconcursos.com'
    }
  ];
}

export function buildStateConcurso(d) {
  const ufMeta = ESTADOS_BRASIL[d.uf];
  if (!ufMeta) throw new Error(`UF inválida: ${d.uf}`);

  const salarioMin = Number(d.salarioMin);
  const salarioMax = Math.max(salarioMin, Number(d.salarioMax));
  const vagas = Number(d.vagas || 0);
  const vagasCR = Number(d.vagasCR || 0);
  const banca = d.banca || 'A definir';
  const urlPdf = d.urlPdf || BANCA_URLS[banca] || 'https://www.pciconcursos.com.br';
  const isPrevisto = d.status === 'Previsto / Autorizado';

  const cargos = (d.cargos && d.cargos.length > 0)
    ? d.cargos
    : [{ nome: d.titulo, vagas: vagas > 0 ? vagas : 0, salario: salarioMax, escolaridade: d.escolaridade }];

  const etapas = d.etapas || (isPrevisto
    ? [
        d.provaObservacao,
        'Etapas definitivas (objetiva, discursiva/títulos ou TAF) serão confirmadas na publicação do edital'
      ]
    : [
        d.dataProva ? `Prova Objetiva prevista para ${d.dataProva.split('-').reverse().join('/')}` : 'Avaliação conforme cronograma do edital',
        'Etapas complementares (títulos, discursiva ou TAF) conforme o cargo'
      ]);

  const requisitosChave = d.requisitosChave || (isPrevisto
    ? [
        `Órgão de destaque em ${ufMeta.nome} (${d.uf}) monitorado para o ciclo 2026–2027`,
        'Salve nos favoritos para receber alerta assim que o edital e a data da prova forem publicados'
      ]
    : [
        d.inscricaoFim ? `Inscrições abertas até ${d.inscricaoFim.split('-').reverse().join('/')} (${banca})` : `Acompanhe o cronograma oficial junto à banca ${banca}`,
        `Remuneração de referência até R$ ${salarioMax.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      ]);

  const editalNumero = d.editalNumero || (isPrevisto
    ? `Previsto / Autorizado — ${d.sigla} (Aguardando edital)`
    : `Edital ${d.sigla} 2026 — ${banca}`);

  return {
    id: d.id,
    sigla: d.sigla,
    orgao: d.orgao,
    titulo: d.titulo,
    uf: d.uf,
    regiao: ufMeta.regiao,
    esfera: d.esfera || 'Estadual',
    area: d.area,
    escolaridade: d.escolaridade,
    vagas: vagas === 0 && vagasCR === 0 ? 0 : vagas,
    vagasCR: vagas === 0 && vagasCR === 0 ? 100 : vagasCR,
    salarioMin,
    salarioMax,
    beneficiosResumo: d.beneficiosResumo || `Carreira pública de destaque no estado de ${ufMeta.nome} (${d.uf})`,
    banca,
    status: d.status,
    taxaInscricao: d.taxaInscricao ?? (isPrevisto ? 120.0 : 100.0),
    inscricaoInicio: d.inscricaoInicio ?? null,
    inscricaoFim: d.inscricaoFim ?? null,
    dataProva: d.dataProva ?? null,
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: d.provaObservacao,
    destaqueGratuito: false,
    atualizadoEm: '2026-11-24',
    fonteOficial: d.fonteOficial,
    anosAnteriores: d.anosAnteriores || [2024, 2022, 2019, 2016, 2013],
    questoesPadrao: d.questoesPadrao || (d.area === 'Fiscal' || d.area === 'Tribunais' ? 100 : 60),
    edital: {
      numero: editalNumero,
      publicadoEm: d.publicadoEm || (isPrevisto ? '2026-11-24' : '2026-11-10'),
      paginas: d.paginas ?? (isPrevisto ? 0 : 48),
      urlPdf,
      cargos,
      disciplinas: d.disciplinas || defaultDisciplinas(d.area, banca),
      etapas,
      requisitosChave
    },
    cursos: buildCourses({ sigla: d.sigla, area: d.area, esfera: d.esfera || 'Estadual', banca, status: d.status })
  };
}
