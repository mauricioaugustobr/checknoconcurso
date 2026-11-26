import { ESTADOS_BRASIL } from './estado-builder.js';
import { ESTADOS_NORTE } from './estados-norte.js';
import { ESTADOS_NORDESTE } from './estados-nordeste.js';
import { ESTADOS_CENTRO_OESTE } from './estados-centro-oeste.js';
import { ESTADOS_SUDESTE } from './estados-sudeste.js';
import { ESTADOS_SUL } from './estados-sul.js';
import { ESTADOS_ATIVOS_2026_11 } from './estados-ativos-2026-11.js';

export { ESTADOS_BRASIL };

export { MARCA, PLANOS, PLATAFORMAS_PARCEIRAS, REGIOES_BRASIL } from './site-info.js';
import { MARCA, PLANOS, PLATAFORMAS_PARCEIRAS, REGIOES_BRASIL } from './site-info.js';

function buildFivePastExams(sigla, bancaAtual, cargoPrincipal, anos, questoesPadrao) {
  return anos.map((ano, idx) => ({
    edicao: `${sigla} ${ano}`,
    ano,
    banca: bancaAtual,
    cargo: cargoPrincipal,
    questoes: questoesPadrao,
    gabarito: 'Gabarito definitivo oficial (em curadoria)',
    disponibilidade: idx === 0 ? 'Prévia disponível' : 'Em breve no Plano Completo'
  }));
}

/**
 * Catálogo de 22 concursos reais verificados em 24/11/2026 junto às bancas oficiais
 * (Vunesp, FGV, Cebraspe, FCC, Instituto AOCP, Instituto Avalia, Instituto ACCESS,
 * CETREDE, Fadesp, INDEPAC, INBRAEDEM, CEV/UECE e EEAR).
 */
const RAW_CONCURSOS = [
  // =========================================================
  // 1. INSCRIÇÕES ABERTAS (HOJE: 24/11/2026)
  // =========================================================
  {
    id: 'pm-sp-soldado-2026',
    sigla: 'PM-SP',
    orgao: 'Polícia Militar do Estado de São Paulo',
    titulo: 'Aluno-Soldado PM de 2ª Classe (Quadro de Praças)',
    uf: 'SP',
    regiao: 'Sudeste',
    esfera: 'Estadual',
    area: 'Policial',
    escolaridade: 'Médio',
    vagas: 2000,
    vagasCR: 0,
    salarioMin: 5482.51,
    salarioMax: 5482.51,
    beneficiosResumo: 'Inclui padrão salarial, RETP (Regime Especial de Trabalho Policial) e adicional de insalubridade',
    banca: 'Fundação Vunesp',
    status: 'Inscrições Abertas',
    taxaInscricao: 110.0,
    inscricaoInicio: '2026-11-09',
    inscricaoFim: '2026-12-22',
    dataProva: '2027-02-28',
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Confirmada para 28/02/2027 (51 cidades: 37 em SP + 14 estados)',
    destaqueGratuito: true,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'Fundação Vunesp / DOE-SP (Edital DP-4/321/26)',
    anosAnteriores: [2025, 2024, 2023, 2022, 2021],
    questoesPadrao: 60,
    edital: {
      numero: 'Edital nº DP-4/321/26 — PM-SP',
      publicadoEm: '2026-11-06',
      paginas: 58,
      urlPdf: 'https://www.vunesp.com.br',
      cargos: [
        { nome: 'Aluno-Soldado PM de 2ª Classe (Ambos os sexos)', vagas: 2000, salario: 5482.51, escolaridade: 'Ensino Médio completo' }
      ],
      disciplinas: [
        { nome: 'Língua Portuguesa e Interpretação de Texto', questoes: 20, peso: 33 },
        { nome: 'Matemática', questoes: 15, peso: 25 },
        { nome: 'Conhecimentos Gerais (História, Geografia e Atualidades)', questoes: 15, peso: 25 },
        { nome: 'Noções Básicas de Informática', questoes: 5, peso: 9 },
        { nome: 'Noções de Administração Pública', questoes: 5, peso: 8 }
      ],
      etapas: [
        'Exames de Conhecimentos (Prova Objetiva + Redação em 28/02/2027)',
        'Exames de Aptidão Física (TAF), Exames de Saúde e Psicológicos',
        'Avaliação da Conduta Social, Reputação e Idoneidade + Análise de Documentos'
      ],
      requisitosChave: [
        'Ensino Médio completo e idade entre 17 e 30 anos na data de inscrição',
        'CNH válida entre as categorias "B" e "E"',
        'Altura mínima de 1,60m (homens) e 1,55m (mulheres)',
        'Provas aplicadas em 37 cidades de SP e 14 capitais/polos de outros estados'
      ]
    },
    cursos: [
      {
        plataformaId: 'estrategia',
        plataforma: 'Estratégia Concursos',
        titulo: 'Pacote Completo PM-SP Soldado (Pós-Edital Vunesp)',
        precoMensal: 49.9,
        precoTotal: 598.8,
        parcelas: '12x de R$ 49,90 (ref.)',
        formato: 'PDFs + Videoaulas + Simulados Vunesp',
        cargaHoraria: '320h',
        nota: 4.9,
        avaliacoes: 4820,
        destaque: 'Mais Procurado PM-SP',
        cupom: 'CHECK15',
        url: 'https://www.estrategiaconcursos.com.br/cursosPorConcurso/pm-sp/'
      },
      {
        plataformaId: 'gran',
        plataforma: 'Gran Cursos Online',
        titulo: 'PM-SP Aluno-Soldado — Edital DP-4/321/26',
        precoMensal: 39.9,
        precoTotal: 478.8,
        parcelas: '12x de R$ 39,90 (ref.)',
        formato: 'Videoaulas + PDFs + Gran Questões Vunesp',
        cargaHoraria: '295h',
        nota: 4.8,
        avaliacoes: 3650,
        destaque: 'Custo-Benefício',
        cupom: 'CHECKGRAN10',
        url: 'https://www.grancursosonline.com.br/cursos/por-concurso/pm-sp'
      },
      {
        plataformaId: 'alfacon',
        plataforma: 'AlfaCon',
        titulo: 'PM-SP Soldado Vunesp + Guia de Preparação TAF',
        precoMensal: 44.9,
        precoTotal: 538.8,
        parcelas: '12x de R$ 44,90 (ref.)',
        formato: 'Videoaulas + Apostilas + Simulados',
        cargaHoraria: '270h',
        nota: 4.8,
        avaliacoes: 2940,
        destaque: 'Foco Carreira Policial',
        cupom: 'CHECKALFA15',
        url: 'https://www.alfaconcursos.com.br/concursos/pm-sp'
      }
    ]
  },
  {
    id: 'tj-sp-2026',
    sigla: 'TJ-SP',
    orgao: 'Tribunal de Justiça de São Paulo',
    titulo: 'Oficial de Justiça (132 vagas) e Escrevente Técnico Judiciário (CR)',
    uf: 'SP',
    regiao: 'Sudeste',
    esfera: 'Estadual',
    area: 'Tribunais',
    escolaridade: 'Médio / Superior',
    vagas: 132,
    vagasCR: 1000,
    salarioMin: 6782.54,
    salarioMax: 9856.95,
    beneficiosResumo: 'Salário base acrescido de auxílios alimentação, saúde e transporte',
    banca: 'Fundação Vunesp',
    status: 'Inscrições Abertas',
    taxaInscricao: 96.0,
    inscricaoInicio: '2026-10-28',
    inscricaoFim: '2026-12-10',
    dataProva: '2027-03-14',
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Provas simultâneas confirmadas para 14/03/2027',
    destaqueGratuito: true,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'TJ-SP / Fundação Vunesp',
    anosAnteriores: [2024, 2023, 2021, 2018, 2017],
    questoesPadrao: 100,
    edital: {
      numero: 'Editais TJ-SP 2026 — Oficial de Justiça e Escrevente',
      publicadoEm: '2026-10-26',
      paginas: 54,
      urlPdf: 'https://www.vunesp.com.br',
      cargos: [
        { nome: 'Oficial de Justiça', vagas: 132, salario: 9856.95, escolaridade: 'Nível Superior (qualquer área)' },
        { nome: 'Escrevente Técnico Judiciário', vagas: 0, salario: 6782.54, escolaridade: 'Ensino Médio (Cadastro de Reserva)' }
      ],
      disciplinas: [
        { nome: 'Conhecimentos em Direito (Penal, Proc., Const., Adm. e Normas CGJ)', questoes: 40, peso: 40 },
        { nome: 'Língua Portuguesa (Vunesp)', questoes: 24, peso: 24 },
        { nome: 'Matemática e Raciocínio Lógico', questoes: 16, peso: 16 },
        { nome: 'Informática', questoes: 14, peso: 14 },
        { nome: 'Atualidades', questoes: 6, peso: 6 }
      ],
      etapas: [
        'Prova Objetiva (100 questões Vunesp) aplicada em 14/03/2027',
        'Prova Prática de Formatação e Digitação (para Escrevente)'
      ],
      requisitosChave: [
        'Taxa de R$ 96,00 para Oficial de Justiça e R$ 81,00 para Escrevente',
        'Inscrições abertas até 23h59 de 10/12/2026 no portal da Vunesp',
        'Histórico consistente de grandes convocações do cadastro reserva no TJ-SP'
      ]
    },
    cursos: [
      {
        plataformaId: 'estrategia',
        plataforma: 'Estratégia Concursos',
        titulo: 'TJ-SP Oficial de Justiça e Escrevente — Pós-Edital Vunesp',
        precoMensal: 59.9,
        precoTotal: 718.8,
        parcelas: '12x de R$ 59,90 (ref.)',
        formato: 'PDFs + Videoaulas + Lei Seca e Normas CGJ',
        cargaHoraria: '370h',
        nota: 4.9,
        avaliacoes: 5310,
        destaque: 'Referência TJ-SP',
        cupom: 'CHECK15',
        url: 'https://www.estrategiaconcursos.com.br/cursosPorConcurso/tj-sp/'
      },
      {
        plataformaId: 'direcao',
        plataforma: 'Direção Concursos',
        titulo: 'TJ-SP Completo Vunesp (PDF 2.0 + Questões Comentadas)',
        precoMensal: 49.9,
        precoTotal: 598.8,
        parcelas: '12x de R$ 49,90 (ref.)',
        formato: 'PDF 2.0 Interativo + Videoaulas',
        cargaHoraria: '320h',
        nota: 4.8,
        avaliacoes: 2420,
        destaque: 'PDF Interativo',
        cupom: 'CHECKDIR12',
        url: 'https://www.direcaoconcursos.com.br/concursos/tj-sp'
      },
      {
        plataformaId: 'nova',
        plataforma: 'Nova Concursos',
        titulo: 'TJ-SP Escrevente e Oficial — Curso Essencial Vunesp',
        precoMensal: 27.9,
        precoTotal: 334.8,
        parcelas: '12x de R$ 27,90 (ref.)',
        formato: 'Videoaulas + Apostila Digital + Questões',
        cargaHoraria: '240h',
        nota: 4.8,
        avaliacoes: 2910,
        destaque: 'Mais Econômico',
        cupom: 'CHECKNOVA20',
        url: 'https://www.novaconcursos.com.br/concurso/tj-sp'
      }
    ]
  },
  {
    id: 'trt-4-rs-2026',
    sigla: 'TRT-4',
    orgao: 'Tribunal Regional do Trabalho da 4ª Região (RS)',
    titulo: 'Técnico Judiciário e Analista Judiciário (23 Especialidades — CR)',
    uf: 'RS',
    regiao: 'Sul',
    esfera: 'Federal',
    area: 'Tribunais',
    escolaridade: 'Superior',
    vagas: 0,
    vagasCR: 500,
    salarioMin: 9776.71,
    salarioMax: 18380.17,
    beneficiosResumo: 'Inclui auxílio-alimentação de R$ 1.860,51 + assistência pré-escolar de R$ 1.288,47',
    banca: 'FCC',
    status: 'Inscrições Abertas',
    taxaInscricao: 90.0,
    inscricaoInicio: '2026-10-27',
    inscricaoFim: '2026-11-25',
    dataProva: '2027-01-31',
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'ÚLTIMOS DIAS! Inscrições até 25/11 · Prova em 31/01/2027',
    destaqueGratuito: true,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'TRT-4 / Fundação Carlos Chagas (FCC)',
    anosAnteriores: [2022, 2015, 2011, 2006, 2002],
    questoesPadrao: 60,
    edital: {
      numero: 'Edital nº 01/2026 — TRT 4ª Região (RS)',
      publicadoEm: '2026-10-22',
      paginas: 78,
      urlPdf: 'https://www.concursosfcc.com.br',
      cargos: [
        { nome: 'Técnico Judiciário (Adm., TI, Enfermagem, Polícia Judicial)', vagas: 0, salario: 9776.71, escolaridade: 'Superior (Cadastro de Reserva)' },
        { nome: 'Analista Judiciário (18 especialidades — Judiciária, TI, Contab.)', vagas: 0, salario: 16040.88, escolaridade: 'Superior (Cadastro de Reserva)' },
        { nome: 'Analista Judiciário — Oficial de Justiça Avaliador Federal', vagas: 0, salario: 18380.17, escolaridade: 'Bacharelado em Direito (CR)' }
      ],
      disciplinas: [
        { nome: 'Conhecimentos Específicos (Direito do Trabalho, Proc. Trabalho, Adm. e Const.)', questoes: 40, peso: 67 },
        { nome: 'Língua Portuguesa (FCC)', questoes: 12, peso: 20 },
        { nome: 'Raciocínio Lógico, Sustentabilidade e Direitos Humanos', questoes: 8, peso: 13 }
      ],
      etapas: [
        'Provas Objetivas e Discursivas em 31/01/2027 (turnos distintos para Técnico e Analista)',
        'Pagamento da taxa permitido até 26/11/2026'
      ],
      requisitosChave: [
        'Inscrições encerram em 25/11/2026 no portal da FCC (R$ 90 Técnico / R$ 110 Analista)',
        'Permite concorrer a Técnico e Analista simultaneamente (provas em turnos diferentes)',
        'Todos os cargos federais de Técnico e Analista exigem Nível Superior completo'
      ]
    },
    cursos: [
      {
        plataformaId: 'estrategia',
        plataforma: 'Estratégia Concursos',
        titulo: 'TRT-4 (RS) — Técnico e Analista Judiciário (Pós-Edital FCC)',
        precoMensal: 79.9,
        precoTotal: 958.8,
        parcelas: '12x de R$ 79,90 (ref.)',
        formato: 'PDFs + Videoaulas + Discursiva FCC Corrigida',
        cargaHoraria: '460h',
        nota: 4.9,
        avaliacoes: 3120,
        destaque: 'Pós-Edital FCC',
        cupom: 'CHECK15',
        url: 'https://www.estrategiaconcursos.com.br/cursosPorConcurso/trt-4/'
      },
      {
        plataformaId: 'gran',
        plataforma: 'Gran Cursos Online',
        titulo: 'TRT 4ª Região Completo + CLT Esquematizada',
        precoMensal: 59.9,
        precoTotal: 718.8,
        parcelas: '12x de R$ 59,90 (ref.)',
        formato: 'Videoaulas + PDFs + Gran Questões FCC',
        cargaHoraria: '420h',
        nota: 4.8,
        avaliacoes: 2780,
        destaque: 'Custo-Benefício',
        cupom: 'CHECKGRAN10',
        url: 'https://www.grancursosonline.com.br/cursos/por-concurso/trt-4'
      },
      {
        plataformaId: 'qconcursos',
        plataforma: 'QConcursos',
        titulo: 'Cadernos FCC Tribunais Trabalhistas + Súmulas TST',
        precoMensal: 29.9,
        precoTotal: 358.8,
        parcelas: '12x de R$ 29,90 (ref.)',
        formato: 'Questões FCC Comentadas + Estatísticas',
        cargaHoraria: '170h',
        nota: 4.8,
        avaliacoes: 2310,
        destaque: 'Treino de Questões',
        cupom: 'CHECKQ15',
        url: 'https://www.qconcursos.com/concursos-abertos'
      }
    ]
  },
  {
    id: 'sp-aguas-2026',
    sigla: 'SP Águas',
    orgao: 'Agência de Águas do Estado de São Paulo',
    titulo: 'Especialista em Regulação e Analista de Suporte à Regulação',
    uf: 'SP',
    regiao: 'Sudeste',
    esfera: 'Estadual',
    area: 'Administrativa',
    escolaridade: 'Superior',
    vagas: 190,
    vagasCR: 190,
    salarioMin: 10366.0,
    salarioMax: 12070.0,
    beneficiosResumo: 'Regime CLT permanente (40h) + vale-refeição de R$ 55,00 por dia trabalhado',
    banca: 'FGV',
    status: 'Inscrições Abertas',
    taxaInscricao: 110.0,
    inscricaoInicio: '2026-11-17',
    inscricaoFim: '2026-12-17',
    dataProva: '2027-01-31',
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Provas objetiva (manhã) e discursiva (tarde) em 31/01/2027',
    destaqueGratuito: false,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'SP Águas / FGV Conhecimento (Edital nº 01/2026)',
    anosAnteriores: [2024, 2022, 2019, 2016, 2013],
    questoesPadrao: 70,
    edital: {
      numero: 'Edital nº 01/2026 — SP Águas',
      publicadoEm: '2026-11-16',
      paginas: 64,
      urlPdf: 'https://conhecimento.fgv.br/concursos',
      cargos: [
        { nome: 'Especialista em Regulação e Fiscalização de Recursos Hídricos I', vagas: 170, salario: 12070.0, escolaridade: 'Superior (4 ênfases: Gestão, Ambiental, Dados, Direito)' },
        { nome: 'Analista de Suporte à Regulação I', vagas: 20, salario: 10366.0, escolaridade: 'Superior (Adm., Direito, Econômico-Fin., TI/Dados)' }
      ],
      disciplinas: [
        { nome: 'Conhecimentos Específicos da Ênfase (Regulação / Dados / Direito / Adm.)', questoes: 40, peso: 57 },
        { nome: 'Língua Portuguesa (FGV)', questoes: 14, peso: 20 },
        { nome: 'Legislação de Recursos Hídricos e Direito Administrativo', questoes: 10, peso: 14 },
        { nome: 'Raciocínio Lógico / Noções de Governança', questoes: 6, peso: 9 }
      ],
      etapas: [
        'Prova Objetiva (70 questões FGV) pela manhã em 31/01/2027 (São Paulo/SP)',
        'Prova Discursiva à tarde em 31/01/2027 + Avaliação de Títulos'
      ],
      requisitosChave: [
        'Inscrições abertas até as 18h de 17/12/2026 (pagamento até 18/12)',
        'Ótima remuneração inicial (até R$ 12.070) com ênfases em TI, Ciência de Dados, Direito e Gestão',
        'Empregos públicos permanentes sob o regime da CLT'
      ]
    },
    cursos: [
      {
        plataformaId: 'estrategia',
        plataforma: 'Estratégia Concursos',
        titulo: 'SP Águas Pós-Edital FGV — Especialista e Analista',
        precoMensal: 74.9,
        precoTotal: 898.8,
        parcelas: '12x de R$ 74,90 (ref.)',
        formato: 'PDFs + Videoaulas + Discursiva FGV',
        cargaHoraria: '410h',
        nota: 4.9,
        avaliacoes: 1180,
        destaque: 'Pós-Edital Atualizado',
        cupom: 'CHECK15',
        url: 'https://www.estrategiaconcursos.com.br/cursosPorConcurso/sp-aguas/'
      },
      {
        plataformaId: 'gran',
        plataforma: 'Gran Cursos Online',
        titulo: 'SP Águas — Especialista em Regulação e Analista (FGV)',
        precoMensal: 54.9,
        precoTotal: 658.8,
        parcelas: '12x de R$ 54,90 (ref.)',
        formato: 'Videoaulas + PDFs + Simulados FGV',
        cargaHoraria: '370h',
        nota: 4.8,
        avaliacoes: 940,
        destaque: 'Custo-Benefício',
        cupom: 'CHECKGRAN10',
        url: 'https://www.grancursosonline.com.br/cursos/por-concurso/sp-aguas'
      }
    ]
  },
  {
    id: 'ipa-sp-2026',
    sigla: 'IPA-SP',
    orgao: 'Instituto de Pesquisas Ambientais de São Paulo',
    titulo: 'Pesquisador Científico I — Categoria A (45 especialidades)',
    uf: 'SP',
    regiao: 'Sudeste',
    esfera: 'Estadual',
    area: 'TI e Engenharia',
    escolaridade: 'Superior',
    vagas: 98,
    vagasCR: 0,
    salarioMin: 9052.47,
    salarioMax: 9052.47,
    beneficiosResumo: 'Regime de dedicação exclusiva (40h semanais) com progressão na carreira de Pesquisador Científico',
    banca: 'Fundação Vunesp',
    status: 'Inscrições Abertas',
    taxaInscricao: 150.0,
    inscricaoInicio: '2026-11-18',
    inscricaoFim: '2026-12-22',
    dataProva: '2027-02-14',
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Provas objetiva e dissertativa em 14/02/2027 (São Paulo/SP)',
    destaqueGratuito: false,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'Agência SP / Fundação Vunesp',
    anosAnteriores: [2024, 2021, 2018, 2014, 2011],
    questoesPadrao: 60,
    edital: {
      numero: 'Edital IPA-SP 2026 — Pesquisador Científico I',
      publicadoEm: '2026-11-17',
      paginas: 72,
      urlPdf: 'https://www.vunesp.com.br',
      cargos: [
        { nome: 'Pesquisador Científico I (45 especialidades: Engenharias, TI, Biologia, Geologia, Química)', vagas: 98, salario: 9052.47, escolaridade: 'Superior na área' }
      ],
      disciplinas: [
        { nome: 'Conhecimentos Específicos da Área de Pesquisa', questoes: 35, peso: 58 },
        { nome: 'Prova Dissertativa Técnica / Metodologia Científica', questoes: 10, peso: 22 },
        { nome: 'Língua Portuguesa, Língua Inglesa e Legislação Ambiental', questoes: 15, peso: 20 }
      ],
      etapas: [
        'Provas Objetiva e Dissertativa em 14/02/2027 (tarde, em São Paulo/SP)',
        'Avaliação de Títulos e Memorial Circunstanciado'
      ],
      requisitosChave: [
        'Inscrições abertas de 18/11 até 22/12/2026 na Fundação Vunesp',
        'Previsão de redução de 50% da taxa para estudantes/desempregados conforme lei estadual',
        'Abrange 45 áreas como Ciência da Computação, Engenharias, Biologia, Geografia e Química'
      ]
    },
    cursos: [
      {
        plataformaId: 'gran',
        plataforma: 'Gran Cursos Online',
        titulo: 'IPA-SP Pesquisador Científico — Base Vunesp + Legislação',
        precoMensal: 49.9,
        precoTotal: 598.8,
        parcelas: '12x de R$ 49,90 (ref.)',
        formato: 'Videoaulas + PDFs + Questões Vunesp',
        cargaHoraria: '280h',
        nota: 4.8,
        avaliacoes: 620,
        destaque: 'Pós-Edital Vunesp',
        cupom: 'CHECKGRAN10',
        url: 'https://www.grancursosonline.com.br'
      },
      {
        plataformaId: 'estrategia',
        plataforma: 'Estratégia Concursos',
        titulo: 'Carreiras Ambientais e Pesquisa — Foco Vunesp',
        precoMensal: 59.9,
        precoTotal: 718.8,
        parcelas: '12x de R$ 59,90 (ref.)',
        formato: 'PDFs + Videoaulas + Dissertativa',
        cargaHoraria: '310h',
        nota: 4.9,
        avaliacoes: 710,
        destaque: 'Material Aprofundado',
        cupom: 'CHECK15',
        url: 'https://www.estrategiaconcursos.com.br'
      }
    ]
  },
  {
    id: 'prefeitura-boa-viagem-ce-2026',
    sigla: 'Boa Viagem',
    orgao: 'Prefeitura de Boa Viagem (CE)',
    titulo: '1.001 Vagas Efetivas — Educação, Saúde, Administrativo e Fiscalização',
    uf: 'CE',
    regiao: 'Nordeste',
    esfera: 'Municipal',
    area: 'Educação',
    escolaridade: 'Médio / Técnico / Superior',
    vagas: 1001,
    vagasCR: 500,
    salarioMin: 1621.0,
    salarioMax: 14718.92,
    beneficiosResumo: 'Regime estatutário municipal com ampla oferta para professores, saúde e técnicos',
    banca: 'Fundação CETREDE',
    status: 'Inscrições Abertas',
    taxaInscricao: 100.0,
    inscricaoInicio: '2026-11-06',
    inscricaoFim: '2026-12-07',
    dataProva: '2027-01-10',
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Prova objetiva confirmada para 10/01/2027',
    destaqueGratuito: false,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'Fundação CETREDE / UFC (Edital nº 001/2026)',
    anosAnteriores: [2022, 2019, 2015, 2012, 2008],
    questoesPadrao: 40,
    edital: {
      numero: 'Edital nº 001/2026 — Prefeitura de Boa Viagem (CE)',
      publicadoEm: '2026-11-04',
      paginas: 68,
      urlPdf: 'https://www.cetrede.com.br',
      cargos: [
        { nome: 'Cargos de Nível Fundamental e Médio / Técnico (Adm., Saúde, Trânsito)', vagas: 520, salario: 2650.0, escolaridade: 'Fundamental / Médio / Técnico' },
        { nome: 'Professores, Enfermeiros, Dentistas e Médicos (Nível Superior)', vagas: 481, salario: 14718.92, escolaridade: 'Nível Superior' }
      ],
      disciplinas: [
        { nome: 'Conhecimentos Específicos do Cargo', questoes: 20, peso: 50 },
        { nome: 'Língua Portuguesa (CETREDE)', questoes: 10, peso: 25 },
        { nome: 'Matemática / Conhecimentos Gerais e do Município', questoes: 10, peso: 25 }
      ],
      etapas: [
        'Prova Objetiva em 10/01/2027',
        'Prova de Títulos para cargos de Nível Superior'
      ],
      requisitosChave: [
        'Inscrições abertas até as 23h de 07/12/2026 no site da Fundação CETREDE',
        'Taxas: R$ 80 (Fundamental), R$ 100 (Médio/Técnico) e R$ 125 (Superior)',
        'Um dos maiores concursos municipais abertos no Nordeste neste fim de ano'
      ]
    },
    cursos: [
      {
        plataformaId: 'nova',
        plataforma: 'Nova Concursos',
        titulo: 'Prefeituras Ceará — Pacote Completo CETREDE',
        precoMensal: 22.9,
        precoTotal: 274.8,
        parcelas: '12x de R$ 22,90 (ref.)',
        formato: 'Videoaulas + Apostila Digital + Questões CETREDE',
        cargaHoraria: '190h',
        nota: 4.7,
        avaliacoes: 1120,
        destaque: 'Mais Econômico',
        cupom: 'CHECKNOVA20',
        url: 'https://www.novaconcursos.com.br'
      },
      {
        plataformaId: 'gran',
        plataforma: 'Gran Cursos Online',
        titulo: 'Concursos Municipais Educação e Saúde — Foco CETREDE',
        precoMensal: 34.9,
        precoTotal: 418.8,
        parcelas: '12x de R$ 34,90 (ref.)',
        formato: 'Videoaulas + PDFs + Gran Questões',
        cargaHoraria: '240h',
        nota: 4.8,
        avaliacoes: 1460,
        destaque: 'Mais Completo',
        cupom: 'CHECKGRAN10',
        url: 'https://www.grancursosonline.com.br'
      }
    ]
  },
  {
    id: 'prefeitura-sao-miguel-milagres-al-2026',
    sigla: 'Milagres-AL',
    orgao: 'Prefeitura de São Miguel dos Milagres (AL)',
    titulo: '232 Vagas Efetivas em 82 Cargos (Fundamental, Médio, Técnico e Superior)',
    uf: 'AL',
    regiao: 'Nordeste',
    esfera: 'Municipal',
    area: 'Administrativa',
    escolaridade: 'Médio / Técnico / Superior',
    vagas: 232,
    vagasCR: 100,
    salarioMin: 1621.0,
    salarioMax: 10000.0,
    beneficiosResumo: 'Vagas efetivas distribuídas em 82 cargos nas áreas de Saúde, Educação e Administração',
    banca: 'INBRAEDEM',
    status: 'Inscrições Abertas',
    taxaInscricao: 90.0,
    inscricaoInicio: '2026-11-23',
    inscricaoFim: '2026-12-23',
    dataProva: '2027-01-31',
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Inscrições recém-abertas (23/11) · Prova em 31/01/2027',
    destaqueGratuito: false,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'Prefeitura de São Miguel dos Milagres / INBRAEDEM',
    anosAnteriores: [2023, 2019, 2016, 2012, 2009],
    questoesPadrao: 40,
    edital: {
      numero: 'Edital 2026 — Prefeitura de São Miguel dos Milagres (AL)',
      publicadoEm: '2026-11-20',
      paginas: 52,
      urlPdf: 'https://www.pciconcursos.com.br',
      cargos: [
        { nome: 'Auxiliares, Assistentes Administrativos e Técnicos (Médio/Técnico)', vagas: 132, salario: 2450.0, escolaridade: 'Fundamental / Médio / Técnico' },
        { nome: 'Professores, Enfermeiros, Procuradores e Médicos (Superior)', vagas: 100, salario: 10000.0, escolaridade: 'Nível Superior' }
      ],
      disciplinas: [
        { nome: 'Conhecimentos Específicos do Cargo', questoes: 20, peso: 50 },
        { nome: 'Língua Portuguesa', questoes: 10, peso: 25 },
        { nome: 'Matemática, Informática e Conhecimentos Gerais', questoes: 10, peso: 25 }
      ],
      etapas: [
        'Prova Objetiva prevista para 31/01/2027',
        'Prova de Títulos para cargos de Nível Superior'
      ],
      requisitosChave: [
        'Inscrições abertas de 23/11 a 23/12/2026',
        '82 cargos contemplando todos os níveis de escolaridade',
        'Salários iniciais chegam a R$ 10.000,00'
      ]
    },
    cursos: [
      {
        plataformaId: 'nova',
        plataforma: 'Nova Concursos',
        titulo: 'Prefeituras Nordeste — Curso Base Completo',
        precoMensal: 21.9,
        precoTotal: 262.8,
        parcelas: '12x de R$ 21,90 (ref.)',
        formato: 'Videoaulas + Apostila Digital',
        cargaHoraria: '175h',
        nota: 4.7,
        avaliacoes: 890,
        destaque: 'Econômico',
        cupom: 'CHECKNOVA20',
        url: 'https://www.novaconcursos.com.br'
      },
      {
        plataformaId: 'qconcursos',
        plataforma: 'QConcursos',
        titulo: 'Trilha de Questões para Prefeituras (Saúde, Adm. e Educação)',
        precoMensal: 24.9,
        precoTotal: 298.8,
        parcelas: '12x de R$ 24,90 (ref.)',
        formato: 'Questões Comentadas + Simulados',
        cargaHoraria: '150h',
        nota: 4.8,
        avaliacoes: 1640,
        destaque: 'Foco em Questões',
        cupom: 'CHECKQ15',
        url: 'https://www.qconcursos.com'
      }
    ]
  },
  {
    id: 'gcm-maraba-pa-2026',
    sigla: 'GCM Marabá',
    orgao: 'Guarda Municipal de Marabá (PA)',
    titulo: 'Guarda Municipal — 60 Vagas Imediatas + 67 CR',
    uf: 'PA',
    regiao: 'Norte',
    esfera: 'Municipal',
    area: 'Policial',
    escolaridade: 'Médio',
    vagas: 60,
    vagasCR: 67,
    salarioMin: 2076.4,
    salarioMax: 2700.0,
    beneficiosResumo: 'Salário base de R$ 2.076,40 + adicional de periculosidade e vantagens legais (40h)',
    banca: 'Fadesp',
    status: 'Inscrições Abertas',
    taxaInscricao: 115.0,
    inscricaoInicio: '2026-11-17',
    inscricaoFim: '2026-12-28',
    dataProva: '2027-01-24',
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Prova objetiva confirmada para 24/01/2027 (manhã)',
    destaqueGratuito: false,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'Prefeitura de Marabá / Fadesp (Edital nº 01/2026)',
    anosAnteriores: [2019, 2015, 2012, 2009, 2006],
    questoesPadrao: 50,
    edital: {
      numero: 'Edital nº 01/2026 — Guarda Municipal de Marabá (PA)',
      publicadoEm: '2026-11-16',
      paginas: 48,
      urlPdf: 'https://portalfadesp.org.br',
      cargos: [
        { nome: 'Guarda Municipal de Marabá (Nível Médio + CNH AB)', vagas: 60, salario: 2076.4, escolaridade: 'Ensino Médio completo' }
      ],
      disciplinas: [
        { nome: 'Legislação de Trânsito, Estatuto das Guardas e Direito Penal/Const.', questoes: 25, peso: 50 },
        { nome: 'Língua Portuguesa (Fadesp)', questoes: 15, peso: 30 },
        { nome: 'Raciocínio Lógico, Informática e Conhecimentos Locais', questoes: 10, peso: 20 }
      ],
      etapas: [
        'Prova Objetiva em 24/01/2027 (manhã)',
        'Teste de Aptidão Física (TAF), Avaliação Psicológica, Exame Médico e Curso de Formação'
      ],
      requisitosChave: [
        'Inscrições até as 17h de 28/12/2026 pelo portal da Fadesp (taxa R$ 115,00)',
        'Exige Ensino Médio completo, CNH categoria AB e idade entre 18 e 35 anos',
        '60 vagas imediatas + 67 de cadastro reserva no Pará'
      ]
    },
    cursos: [
      {
        plataformaId: 'alfacon',
        plataforma: 'AlfaCon',
        titulo: 'Guardas Municipais Completo — Foco Fadesp + TAF',
        precoMensal: 39.9,
        precoTotal: 478.8,
        parcelas: '12x de R$ 39,90 (ref.)',
        formato: 'Videoaulas + Legislação GCM + Questões',
        cargaHoraria: '240h',
        nota: 4.8,
        avaliacoes: 1520,
        destaque: 'Especialista GCM',
        cupom: 'CHECKALFA15',
        url: 'https://www.alfaconcursos.com.br'
      },
      {
        plataformaId: 'gran',
        plataforma: 'Gran Cursos Online',
        titulo: 'GCM Marabá Pós-Edital Fadesp',
        precoMensal: 34.9,
        precoTotal: 418.8,
        parcelas: '12x de R$ 34,90 (ref.)',
        formato: 'Videoaulas + PDFs + Gran Questões',
        cargaHoraria: '220h',
        nota: 4.8,
        avaliacoes: 1180,
        destaque: 'Custo-Benefício',
        cupom: 'CHECKGRAN10',
        url: 'https://www.grancursosonline.com.br'
      }
    ]
  },
  {
    id: 'seeduc-rj-2026',
    sigla: 'SEEDUC-RJ',
    orgao: 'Secretaria de Estado de Educação do Rio de Janeiro',
    titulo: 'Processo Seletivo para Professores (Docente I e II — 1.750 vagas)',
    uf: 'RJ',
    regiao: 'Sudeste',
    esfera: 'Estadual',
    area: 'Educação',
    escolaridade: 'Médio / Superior',
    vagas: 1750,
    vagasCR: 0,
    salarioMin: 2400.0,
    salarioMax: 4200.0,
    beneficiosResumo: 'Inscrição gratuita · Seleção por análise de títulos e experiência profissional',
    banca: 'SEEDUC-RJ (Própria)',
    status: 'Inscrições Abertas',
    taxaInscricao: 0.0,
    inscricaoInicio: '2026-11-01',
    inscricaoFim: '2026-11-30',
    dataProva: null,
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Sem prova escrita (análise de títulos) · Inscrições até 30/11',
    destaqueGratuito: false,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'SEEDUC-RJ / Governo do Estado do RJ',
    anosAnteriores: [2025, 2024, 2023, 2022, 2019],
    questoesPadrao: 50,
    edital: {
      numero: 'Processo Seletivo Temporário 2026 — SEEDUC-RJ',
      publicadoEm: '2026-11-01',
      paginas: 28,
      urlPdf: 'https://www.seeduc.rj.gov.br',
      cargos: [
        { nome: 'Professor Docente I (Ensino Fundamental II e Médio)', vagas: 1200, salario: 4200.0, escolaridade: 'Licenciatura Plena' },
        { nome: 'Professor Docente II (Anos Iniciais)', vagas: 550, salario: 2400.0, escolaridade: 'Formação de Professores / Pedagogia' }
      ],
      disciplinas: [
        { nome: 'Pontuação por Titulação Acadêmica (Pós, Mestrado, Doutorado)', questoes: 1, peso: 50 },
        { nome: 'Experiência Comprovada em Regência de Turma', questoes: 1, peso: 50 }
      ],
      etapas: [
        'Etapa única: Inscrição online gratuita até 30/11/2026 + Análise de Títulos e Experiência'
      ],
      requisitosChave: [
        'Inscrição 100% gratuita aberta até 30 de novembro de 2026',
        'Não há prova objetiva escrita — classificação por títulos e tempo de docência',
        'O cadastro costuma reabrir periodicamente (nova janela prevista em fevereiro/2027)'
      ]
    },
    cursos: [
      {
        plataformaId: 'gran',
        plataforma: 'Gran Cursos Online',
        titulo: 'Carreira Magistério RJ — Preparação para Editais Efetivos',
        precoMensal: 34.9,
        precoTotal: 418.8,
        parcelas: '12x de R$ 34,90 (ref.)',
        formato: 'Videoaulas Pedagógicas + LDB + BNCC',
        cargaHoraria: '260h',
        nota: 4.8,
        avaliacoes: 1940,
        destaque: 'Base Magistério',
        cupom: 'CHECKGRAN10',
        url: 'https://www.grancursosonline.com.br'
      },
      {
        plataformaId: 'estrategia',
        plataforma: 'Estratégia Concursos',
        titulo: 'Pacote Professor SEEDUC-RJ (Base para Efetivos)',
        precoMensal: 44.9,
        precoTotal: 538.8,
        parcelas: '12x de R$ 44,90 (ref.)',
        formato: 'PDFs + Videoaulas + Simulados',
        cargaHoraria: '280h',
        nota: 4.9,
        avaliacoes: 1410,
        destaque: 'Preparação Contínua',
        cupom: 'CHECK15',
        url: 'https://www.estrategiaconcursos.com.br'
      }
    ]
  },

  // =========================================================
  // 2. EDITAL PUBLICADO — INSCRIÇÕES ABRINDO NOS PRÓXIMOS DIAS
  // =========================================================
  {
    id: 'seduc-sp-2026',
    sigla: 'SEDUC-SP',
    orgao: 'Secretaria da Educação do Estado de São Paulo',
    titulo: 'Professor de Ensino Fundamental e Médio (5.000 vagas efetivas)',
    uf: 'SP',
    regiao: 'Sudeste',
    esfera: 'Estadual',
    area: 'Educação',
    escolaridade: 'Superior',
    vagas: 5000,
    vagasCR: 2000,
    salarioMin: 3478.13,
    salarioMax: 5565.0,
    beneficiosResumo: '3.000 vagas para 40h (R$ 5.565,00) + 2.000 vagas para 25h (R$ 3.478,13)',
    banca: 'FGV',
    status: 'Edital Publicado',
    taxaInscricao: 64.0,
    inscricaoInicio: '2026-11-26',
    inscricaoFim: '2027-02-15',
    dataProva: '2027-04-25',
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Inscrições abrem em 26/11 · Prova em 25/04/2027',
    destaqueGratuito: false,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'SEDUC-SP / FGV (concursoseducsp27)',
    anosAnteriores: [2023, 2013, 2010, 2007, 2003],
    questoesPadrao: 50,
    edital: {
      numero: 'Edital SEDUC-SP 2026/2027 — PEFM (5.000 vagas)',
      publicadoEm: '2026-11-20',
      paginas: 86,
      urlPdf: 'https://conhecimento.fgv.br/concursos/concursoseducsp27',
      cargos: [
        { nome: 'Professor de Ensino Fundamental e Médio — 40h semanais', vagas: 3000, salario: 5565.0, escolaridade: 'Licenciatura Plena' },
        { nome: 'Professor de Ensino Fundamental e Médio — 25h semanais', vagas: 2000, salario: 3478.13, escolaridade: 'Licenciatura Plena' }
      ],
      disciplinas: [
        { nome: 'Conhecimentos Específicos da Disciplina (Port., Mat., Fís., Quím., Geo., Ed. Especial)', questoes: 30, peso: 55 },
        { nome: 'Conhecimentos Pedagógicos, Currículo Paulista e Legislação', questoes: 20, peso: 30 },
        { nome: 'Prova Discursiva + Simulação de Aula (Vídeo) + Títulos', questoes: 2, peso: 15 }
      ],
      etapas: [
        'Inscrições abertas de 26/11/2026 a 15/02/2027 (isenção entre 26/11 e 30/11)',
        'Prova Prática (envio de vídeo de aula) e Títulos entre 19/03 e 02/04/2027',
        'Prova Objetiva e Discursiva em 25/04/2027 (dois turnos)'
      ],
      requisitosChave: [
        'Taxa acessível de R$ 64,00 (pagamento até 16/02/2027)',
        'Inclui vagas para Matemática, Português, Física, Ciências, Inglês, Ed. Física, Geografia, Química e Ed. Especial (DI/TEA)',
        'Maior concurso estadual efetivo para professores no país neste momento'
      ]
    },
    cursos: [
      {
        plataformaId: 'gran',
        plataforma: 'Gran Cursos Online',
        titulo: 'SEDUC-SP Professor (5.000 vagas) — Pós-Edital FGV',
        precoMensal: 39.9,
        precoTotal: 478.8,
        parcelas: '12x de R$ 39,90 (ref.)',
        formato: 'Videoaulas + Currículo Paulista + Guia Videoaula Prática',
        cargaHoraria: '310h',
        nota: 4.9,
        avaliacoes: 3420,
        destaque: 'Forte em Educação',
        cupom: 'CHECKGRAN10',
        url: 'https://www.grancursosonline.com.br/cursos/por-concurso/seduc-sp'
      },
      {
        plataformaId: 'estrategia',
        plataforma: 'Estratégia Concursos',
        titulo: 'Pacote SEDUC-SP PEFM — Foco FGV + Discursiva',
        precoMensal: 49.9,
        precoTotal: 598.8,
        parcelas: '12x de R$ 49,90 (ref.)',
        formato: 'PDFs + Videoaulas + Simulados FGV',
        cargaHoraria: '330h',
        nota: 4.9,
        avaliacoes: 2680,
        destaque: 'Pós-Edital FGV',
        cupom: 'CHECK15',
        url: 'https://www.estrategiaconcursos.com.br/cursosPorConcurso/seduc-sp/'
      },
      {
        plataformaId: 'nova',
        plataforma: 'Nova Concursos',
        titulo: 'SEDUC-SP Professor Essencial (FGV)',
        precoMensal: 24.9,
        precoTotal: 298.8,
        parcelas: '12x de R$ 24,90 (ref.)',
        formato: 'Videoaulas + Apostila Digital',
        cargaHoraria: '210h',
        nota: 4.7,
        avaliacoes: 1740,
        destaque: 'Mais Econômico',
        cupom: 'CHECKNOVA20',
        url: 'https://www.novaconcursos.com.br/concurso/seduc-sp'
      }
    ]
  },
  {
    id: 'cro-pr-2026',
    sigla: 'CRO-PR',
    orgao: 'Conselho Regional de Odontologia do Paraná',
    titulo: 'Auxiliar Adm., Fiscal, Téc. Informática, Analistas, Contador e Procurador',
    uf: 'PR',
    regiao: 'Sul',
    esfera: 'Federal',
    area: 'Administrativa',
    escolaridade: 'Médio / Técnico / Superior',
    vagas: 12,
    vagasCR: 120,
    salarioMin: 4300.26,
    salarioMax: 14318.45,
    beneficiosResumo: '40h semanais + vale-alimentação + plano de saúde (Curitiba, Foz, Cascavel e Londrina)',
    banca: 'FGV',
    status: 'Edital Publicado',
    taxaInscricao: 70.0,
    inscricaoInicio: '2026-11-30',
    inscricaoFim: '2026-12-29',
    dataProva: '2027-02-28',
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Inscrições abrem em 30/11 · Prova em 28/02/2027 (Curitiba)',
    destaqueGratuito: false,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'CRO-PR / FGV Conhecimento (Edital nº 01/2026)',
    anosAnteriores: [2021, 2016, 2012, 2008, 2005],
    questoesPadrao: 60,
    edital: {
      numero: 'Edital nº 01/2026 — CRO-PR',
      publicadoEm: '2026-11-19',
      paginas: 52,
      urlPdf: 'https://conhecimento.fgv.br/concursos',
      cargos: [
        { nome: 'Auxiliar Administrativo (Curitiba e Foz do Iguaçu)', vagas: 4, salario: 4300.26, escolaridade: 'Ensino Médio' },
        { nome: 'Fiscal (Cascavel e Londrina) e Técnico em Informática (Curitiba)', vagas: 4, salario: 5359.51, escolaridade: 'Médio / Técnico' },
        { nome: 'Analista RH, Analista Conteúdo/IA e Contador (Curitiba)', vagas: 3, salario: 8487.34, escolaridade: 'Superior' },
        { nome: 'Procurador Jurídico (Curitiba)', vagas: 1, salario: 14318.45, escolaridade: 'Direito + OAB' }
      ],
      disciplinas: [
        { nome: 'Conhecimentos Específicos do Cargo + Legislação Conselhos', questoes: 30, peso: 50 },
        { nome: 'Língua Portuguesa (FGV)', questoes: 15, peso: 25 },
        { nome: 'Raciocínio Lógico, Informática e Noções de Adm. Pública', questoes: 15, peso: 25 }
      ],
      etapas: [
        'Inscrições das 16h de 30/11 até 16h de 29/12/2026 (pagamento até 30/12)',
        'Prova Objetiva em 28/02/2027 em Curitiba (manhã: médio/técnico · tarde: superior)'
      ],
      requisitosChave: [
        'Taxas de R$ 70,00 (Médio/Técnico) e R$ 100,00 (Superior)',
        'Excelente salário inicial de nível médio (R$ 4.300 a R$ 5.359) com benefícios',
        'Inclui cargo inovador de Analista de Conteúdo e IA (R$ 8.487,34)'
      ]
    },
    cursos: [
      {
        plataformaId: 'estrategia',
        plataforma: 'Estratégia Concursos',
        titulo: 'CRO-PR Pós-Edital FGV — Auxiliar, Fiscal e Analistas',
        precoMensal: 49.9,
        precoTotal: 598.8,
        parcelas: '12x de R$ 49,90 (ref.)',
        formato: 'PDFs + Videoaulas + Português FGV',
        cargaHoraria: '270h',
        nota: 4.9,
        avaliacoes: 980,
        destaque: 'Pós-Edital FGV',
        cupom: 'CHECK15',
        url: 'https://www.estrategiaconcursos.com.br'
      },
      {
        plataformaId: 'gran',
        plataforma: 'Gran Cursos Online',
        titulo: 'Conselhos Regionais (CRO-PR) — Completo FGV',
        precoMensal: 39.9,
        precoTotal: 478.8,
        parcelas: '12x de R$ 39,90 (ref.)',
        formato: 'Videoaulas + PDFs + Gran Questões',
        cargaHoraria: '250h',
        nota: 4.8,
        avaliacoes: 820,
        destaque: 'Custo-Benefício',
        cupom: 'CHECKGRAN10',
        url: 'https://www.grancursosonline.com.br'
      }
    ]
  },
  {
    id: 'dpdf-2026',
    sigla: 'DPDF',
    orgao: 'Defensoria Pública do Distrito Federal',
    titulo: 'Analista de Apoio à Assistência Judiciária (Direito, Contab. e TI)',
    uf: 'DF',
    regiao: 'Centro-Oeste',
    esfera: 'Estadual',
    area: 'Tribunais',
    escolaridade: 'Superior',
    vagas: 7,
    vagasCR: 700,
    salarioMin: 11514.95,
    salarioMax: 11514.95,
    beneficiosResumo: 'R$ 11.514,95 iniciais + auxílio-alimentação de R$ 1.701,41 (total acima de R$ 13,2 mil)',
    banca: 'Instituto ACCESS',
    status: 'Edital Publicado',
    taxaInscricao: 110.0,
    inscricaoInicio: '2026-12-03',
    inscricaoFim: '2027-01-07',
    dataProva: '2027-02-21',
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Inscrições abrem em 03/12 · Prova em 21/02/2027',
    destaqueGratuito: false,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'DPDF / Instituto ACCESS',
    anosAnteriores: [2022, 2019, 2014, 2010, 2006],
    questoesPadrao: 80,
    edital: {
      numero: 'Edital DPDF 2026 — Analista de Apoio à Assistência Judiciária',
      publicadoEm: '2026-10-29',
      paginas: 62,
      urlPdf: 'https://www.access.org.br',
      cargos: [
        { nome: 'Analista — Direito e Legislação, Contabilidade e TI (BD, Dev e Redes)', vagas: 7, salario: 11514.95, escolaridade: 'Superior Específico (+ 700 CR)' }
      ],
      disciplinas: [
        { nome: 'Conhecimentos Específicos (Direito / Contabilidade / TI)', questoes: 45, peso: 56 },
        { nome: 'Língua Portuguesa e Raciocínio Lógico', questoes: 15, peso: 19 },
        { nome: 'Lei Orgânica do DF, LC 840/2011 e Legislação Institucional DPDF', questoes: 20, peso: 25 }
      ],
      etapas: [
        'Inscrições de 03/12/2026 a 07/01/2027 (taxa de R$ 110,00)',
        'Prova Objetiva e Discursiva em 21/02/2027 em Brasília/DF'
      ],
      requisitosChave: [
        '700 vagas em Cadastro de Reserva com forte histórico de chamamentos no DF',
        'Especialidades de TI (Banco de Dados, Desenvolvimento e Redes), Direito e Contabilidade',
        'Auxílio-alimentação de R$ 1.701,41 soma-se ao vencimento inicial'
      ]
    },
    cursos: [
      {
        plataformaId: 'gran',
        plataforma: 'Gran Cursos Online',
        titulo: 'DPDF Analista Pós-Edital (Direito, TI e Contabilidade)',
        precoMensal: 59.9,
        precoTotal: 718.8,
        parcelas: '12x de R$ 59,90 (ref.)',
        formato: 'Videoaulas + LC 840/DF + Discursiva',
        cargaHoraria: '390h',
        nota: 4.9,
        avaliacoes: 2140,
        destaque: 'Especialista DF',
        cupom: 'CHECKGRAN10',
        url: 'https://www.grancursosonline.com.br/cursos/por-concurso/dpdf'
      },
      {
        plataformaId: 'estrategia',
        plataforma: 'Estratégia Concursos',
        titulo: 'Pacote Completo DPDF Analista — Instituto ACCESS',
        precoMensal: 69.9,
        precoTotal: 838.8,
        parcelas: '12x de R$ 69,90 (ref.)',
        formato: 'PDFs + Videoaulas + Simulados',
        cargaHoraria: '420h',
        nota: 4.9,
        avaliacoes: 1720,
        destaque: 'Material Completo',
        cupom: 'CHECK15',
        url: 'https://www.estrategiaconcursos.com.br/cursosPorConcurso/dpdf/'
      }
    ]
  },
  {
    id: 'prefeitura-sete-barras-sp-2026',
    sigla: 'Sete Barras',
    orgao: 'Prefeitura de Sete Barras (SP)',
    titulo: '42 Vagas + CR (Monitor Escolar, Professores, Advogado, Contador, Psicólogo)',
    uf: 'SP',
    regiao: 'Sudeste',
    esfera: 'Municipal',
    area: 'Educação',
    escolaridade: 'Médio / Superior',
    vagas: 42,
    vagasCR: 60,
    salarioMin: 1621.0,
    salarioMax: 6449.63,
    beneficiosResumo: 'Vagas efetivas municipais no Vale do Ribeira (SP)',
    banca: 'INDEPAC',
    status: 'Edital Publicado',
    taxaInscricao: 75.0,
    inscricaoInicio: '2026-11-27',
    inscricaoFim: '2026-12-20',
    dataProva: '2027-01-10',
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Inscrições abrem em 27/11 · Prova em 10/01/2027',
    destaqueGratuito: false,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'Prefeitura de Sete Barras / INDEPAC',
    anosAnteriores: [2023, 2019, 2016, 2013, 2010],
    questoesPadrao: 40,
    edital: {
      numero: 'Edital 2026 — Prefeitura de Sete Barras (SP)',
      publicadoEm: '2026-11-20',
      paginas: 42,
      urlPdf: 'https://www.indepac.org.br',
      cargos: [
        { nome: 'Monitor de Apoio Escolar e Cargos de Nível Médio', vagas: 18, salario: 2150.0, escolaridade: 'Ensino Médio' },
        { nome: 'Advogado, Assistente Social, Contador, Psicólogo e Professores', vagas: 24, salario: 6449.63, escolaridade: 'Nível Superior' }
      ],
      disciplinas: [
        { nome: 'Conhecimentos Específicos do Cargo', questoes: 20, peso: 50 },
        { nome: 'Língua Portuguesa (INDEPAC)', questoes: 10, peso: 25 },
        { nome: 'Matemática e Conhecimentos Gerais/Educacionais', questoes: 10, peso: 25 }
      ],
      etapas: [
        'Inscrições de 27/11 a 20/12/2026 pelo site da INDEPAC',
        'Prova Objetiva prevista para 10/01/2027'
      ],
      requisitosChave: [
        'Inscrições abrem em 3 dias (27/11/2026)',
        'Prova rápida em 10/01/2027 — ótimo edital enxuto no interior de SP'
      ]
    },
    cursos: [
      {
        plataformaId: 'nova',
        plataforma: 'Nova Concursos',
        titulo: 'Prefeituras SP — Pacote Base INDEPAC',
        precoMensal: 19.9,
        precoTotal: 238.8,
        parcelas: '12x de R$ 19,90 (ref.)',
        formato: 'Videoaulas + Apostila Digital',
        cargaHoraria: '150h',
        nota: 4.7,
        avaliacoes: 740,
        destaque: 'Mais Econômico',
        cupom: 'CHECKNOVA20',
        url: 'https://www.novaconcursos.com.br'
      },
      {
        plataformaId: 'qconcursos',
        plataforma: 'QConcursos',
        titulo: 'Caderno de Questões INDEPAC (Prefeituras SP)',
        precoMensal: 24.9,
        precoTotal: 298.8,
        parcelas: '12x de R$ 24,90 (ref.)',
        formato: 'Questões Comentadas + Provas Anteriores',
        cargaHoraria: '120h',
        nota: 4.7,
        avaliacoes: 980,
        destaque: 'Treino por Banca',
        cupom: 'CHECKQ15',
        url: 'https://www.qconcursos.com'
      }
    ]
  },

  // =========================================================
  // 3. PROVA AGENDADA — INSCRIÇÕES ENCERRADAS, DATA DE PROVA CONFIRMADA
  // =========================================================
  {
    id: 'tce-ma-2026',
    sigla: 'TCE-MA',
    orgao: 'Tribunal de Contas do Estado do Maranhão',
    titulo: 'Técnico, Analista e Auditor Estadual de Controle Externo',
    uf: 'MA',
    regiao: 'Nordeste',
    esfera: 'Estadual',
    area: 'Fiscal',
    escolaridade: 'Médio / Superior',
    vagas: 40,
    vagasCR: 120,
    salarioMin: 11061.72,
    salarioMax: 20112.2,
    beneficiosResumo: 'Carreira de Controle Externo · Prova de Auditor e Técnico neste domingo (29/11)',
    banca: 'Cebraspe',
    status: 'Prova Agendada',
    taxaInscricao: 150.0,
    inscricaoInicio: '2026-07-17',
    inscricaoFim: '2026-08-21',
    dataProva: '2026-11-29',
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Analista aplicada em 22/11 · Auditor/Técnico em 29/11/2026',
    destaqueGratuito: false,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'Cebraspe / TCE-MA',
    anosAnteriores: [2016, 2012, 2005, 2001, 1998],
    questoesPadrao: 120,
    edital: {
      numero: 'Edital TCE-MA 2026 — Controle Externo',
      publicadoEm: '2026-07-10',
      paginas: 76,
      urlPdf: 'https://www.cebraspe.org.br',
      cargos: [
        { nome: 'Técnico Estadual de Controle Externo', vagas: 15, salario: 11061.72, escolaridade: 'Ensino Médio' },
        { nome: 'Analista e Auditor Estadual de Controle Externo', vagas: 25, salario: 20112.2, escolaridade: 'Nível Superior' }
      ],
      disciplinas: [
        { nome: 'Controle Externo, Auditoria Governamental e AFO', questoes: 45, peso: 38 },
        { nome: 'Contabilidade Pública e Direito Administrativo/Constitucional', questoes: 45, peso: 37 },
        { nome: 'Língua Portuguesa e Análise de Dados (Cebraspe)', questoes: 30, peso: 25 }
      ],
      etapas: [
        'Analista: prova aplicada em 22/11/2026 (gabarito preliminar saiu em 24/11)',
        'Auditor e Técnico: prova confirmada para 29/11/2026 (em 5 dias!)'
      ],
      requisitosChave: [
        'Inscrições já encerradas — foco em revisão de véspera e recursos do cargo de Analista (25 a 26/11)',
        'Gabaritos das provas de 29/11 previstos para o início de dezembro'
      ]
    },
    cursos: [
      {
        plataformaId: 'estrategia',
        plataforma: 'Estratégia Concursos',
        titulo: 'Reta Final TCE-MA (Revisão Cebraspe — Auditor e Técnico)',
        precoMensal: 69.9,
        precoTotal: 838.8,
        parcelas: '12x de R$ 69,90 (ref.)',
        formato: 'Revisão de Véspera + Cadernos Cebraspe',
        cargaHoraria: '180h',
        nota: 4.9,
        avaliacoes: 1340,
        destaque: 'Reta Final',
        cupom: 'CHECK15',
        url: 'https://www.estrategiaconcursos.com.br/cursosPorConcurso/tce-ma/'
      },
      {
        plataformaId: 'direcao',
        plataforma: 'Direção Concursos',
        titulo: 'Área de Controle Cebraspe — TCE-MA e Próximos TCEs',
        precoMensal: 74.9,
        precoTotal: 898.8,
        parcelas: '12x de R$ 74,90 (ref.)',
        formato: 'PDF 2.0 + Questões Comentadas',
        cargaHoraria: '440h',
        nota: 4.9,
        avaliacoes: 1120,
        destaque: 'Controle Externo',
        cupom: 'CHECKDIR12',
        url: 'https://www.direcaoconcursos.com.br'
      }
    ]
  },
  {
    id: 'pc-ba-2026',
    sigla: 'PC-BA',
    orgao: 'Polícia Civil do Estado da Bahia',
    titulo: 'Delegado (100), Investigador (500) e Escrivão de Polícia (150)',
    uf: 'BA',
    regiao: 'Nordeste',
    esfera: 'Estadual',
    area: 'Policial',
    escolaridade: 'Superior',
    vagas: 750,
    vagasCR: 0,
    salarioMin: 6433.06,
    salarioMax: 16495.67,
    beneficiosResumo: '40h semanais · Inclui vencimento básico + GAPJ III / GAJ III',
    banca: 'Instituto AOCP',
    status: 'Prova Agendada',
    taxaInscricao: 150.0,
    inscricaoInicio: '2026-08-25',
    inscricaoFim: '2026-10-05',
    dataProva: '2026-12-06',
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Prova em 06/12 (Salvador, 2 turnos) · Local sai em 30/11',
    destaqueGratuito: false,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'Governo da Bahia / Instituto AOCP (Edital nº 02/2026)',
    anosAnteriores: [2022, 2018, 2013, 2008, 1997],
    questoesPadrao: 100,
    edital: {
      numero: 'Edital nº 02/2026 — Polícia Civil da Bahia',
      publicadoEm: '2026-08-20',
      paginas: 84,
      urlPdf: 'https://www.institutoaocp.org.br',
      cargos: [
        { nome: 'Investigador de Polícia Civil', vagas: 500, salario: 6433.06, escolaridade: 'Superior (qualquer área)' },
        { nome: 'Escrivão de Polícia Civil', vagas: 150, salario: 6433.06, escolaridade: 'Superior (qualquer área)' },
        { nome: 'Delegado de Polícia Civil', vagas: 100, salario: 16495.67, escolaridade: 'Bacharelado em Direito' }
      ],
      disciplinas: [
        { nome: 'Direito Penal, Processo Penal e Legislação Penal Especial', questoes: 35, peso: 35 },
        { nome: 'Direito Constitucional, Administrativo e Medicina Legal', questoes: 25, peso: 25 },
        { nome: 'Língua Portuguesa e Informática (AOCP)', questoes: 25, peso: 25 },
        { nome: 'Raciocínio Lógico, Atualidades e Igualdade Racial/Gênero', questoes: 15, peso: 15 }
      ],
      etapas: [
        'Provas Objetivas e Discursivas convocadas para 06/12/2026 em Salvador (dois turnos)',
        'Cartão de Informação do Candidato disponível a partir de 30/11/2026 no Instituto AOCP',
        'TAF, Exame Biomédico, Psicotécnico, Investigação Social e Curso de Formação'
      ],
      requisitosChave: [
        'Atenção inscritos: todas as provas serão aplicadas em Salvador (BA) em 06/12/2026',
        'Consulte seu local de prova no Instituto AOCP a partir de 30/11/2026',
        'Levar cartão impresso, documento original com foto e caneta transparente azul ou preta'
      ]
    },
    cursos: [
      {
        plataformaId: 'estrategia',
        plataforma: 'Estratégia Concursos',
        titulo: 'Reta Final PC-BA (Instituto AOCP) — Revisão + Discursiva',
        precoMensal: 59.9,
        precoTotal: 718.8,
        parcelas: '12x de R$ 59,90 (ref.)',
        formato: 'Revisão Final + Cadernos AOCP',
        cargaHoraria: '190h',
        nota: 4.9,
        avaliacoes: 2870,
        destaque: 'Reta Final PC-BA',
        cupom: 'CHECK15',
        url: 'https://www.estrategiaconcursos.com.br/cursosPorConcurso/pc-ba/'
      },
      {
        plataformaId: 'alfacon',
        plataforma: 'AlfaCon',
        titulo: 'PC-BA Revisão Intensiva Investigador e Escrivão',
        precoMensal: 44.9,
        precoTotal: 538.8,
        parcelas: '12x de R$ 44,90 (ref.)',
        formato: 'Videoaulas de Revisão + Guia TAF',
        cargaHoraria: '160h',
        nota: 4.8,
        avaliacoes: 2110,
        destaque: 'Foco Policial',
        cupom: 'CHECKALFA15',
        url: 'https://www.alfaconcursos.com.br/concursos/pc-ba'
      }
    ]
  },
  {
    id: 'ufba-tae-2026',
    sigla: 'UFBA',
    orgao: 'Universidade Federal da Bahia',
    titulo: 'Técnico-Administrativo em Educação (139 vagas — Classes D e E)',
    uf: 'BA',
    regiao: 'Nordeste',
    esfera: 'Federal',
    area: 'Administrativa',
    escolaridade: 'Médio / Técnico / Superior',
    vagas: 139,
    vagasCR: 200,
    salarioMin: 3181.39,
    salarioMax: 5215.39,
    beneficiosResumo: 'Vencimento básico + auxílio-alimentação R$ 1.192,00 + Incentivo à Qualificação',
    banca: 'Instituto Avalia',
    status: 'Prova Agendada',
    taxaInscricao: 100.0,
    inscricaoInicio: '2026-09-21',
    inscricaoFim: '2026-11-05',
    dataProva: '2026-12-20',
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Prova confirmada em 20/12 · Resultado final em 12/01/2027',
    destaqueGratuito: false,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'UFBA / Instituto Avalia (Edital nº 007/2026)',
    anosAnteriores: [2023, 2022, 2017, 2014, 2011],
    questoesPadrao: 50,
    edital: {
      numero: 'Edital nº 007/2026 — UFBA (TAE)',
      publicadoEm: '2026-09-16',
      paginas: 64,
      urlPdf: 'https://www.avalia.org.br',
      cargos: [
        { nome: 'Classe D — Assistente em Administração (94 vagas), Téc. TI, Enfermagem e Lab.', vagas: 108, salario: 3181.39, escolaridade: 'Médio / Técnico' },
        { nome: 'Classe E — Administrador, Contador, Analista de TI, Engenheiro, Médico', vagas: 31, salario: 5215.39, escolaridade: 'Superior' }
      ],
      disciplinas: [
        { nome: 'Conhecimentos Específicos do Cargo + Administração Pública', questoes: 25, peso: 50 },
        { nome: 'Língua Portuguesa e Redação (Instituto Avalia)', questoes: 15, peso: 30 },
        { nome: 'Informática, Raciocínio Lógico e Legislação (Lei 8.112/90)', questoes: 10, peso: 20 }
      ],
      etapas: [
        'Provas Objetiva e Redação em 20/12/2026 (turnos distintos)',
        'Gabarito preliminar em 21/12/2026 · Resultado final previsto para 12/01/2027'
      ],
      requisitosChave: [
        'Regime estatutário federal (Lei 8.112/1990) com lotações em Salvador, Vitória da Conquista, Barreiras, Teixeira de Freitas e Juazeiro',
        'Inscrições encerradas — foco na reta final até 20/12/2026'
      ]
    },
    cursos: [
      {
        plataformaId: 'gran',
        plataforma: 'Gran Cursos Online',
        titulo: 'UFBA Assistente em Administração — Reta Final Avalia',
        precoMensal: 34.9,
        precoTotal: 418.8,
        parcelas: '12x de R$ 34,90 (ref.)',
        formato: 'Videoaulas + Lei 8.112 + Simulados Avalia',
        cargaHoraria: '210h',
        nota: 4.8,
        avaliacoes: 1620,
        destaque: 'Reta Final UFBA',
        cupom: 'CHECKGRAN10',
        url: 'https://www.grancursosonline.com.br/cursos/por-concurso/ufba'
      },
      {
        plataformaId: 'qconcursos',
        plataforma: 'QConcursos',
        titulo: 'Caderno Instituto Avalia + Universidades Federais',
        precoMensal: 24.9,
        precoTotal: 298.8,
        parcelas: '12x de R$ 24,90 (ref.)',
        formato: 'Questões Avalia Comentadas',
        cargaHoraria: '130h',
        nota: 4.8,
        avaliacoes: 1410,
        destaque: 'Treino de Véspera',
        cupom: 'CHECKQ15',
        url: 'https://www.qconcursos.com'
      }
    ]
  },
  {
    id: 'camara-deputados-2026',
    sigla: 'Câmara',
    orgao: 'Câmara dos Deputados',
    titulo: 'Analista Legislativo (Comunicação, Engenharia, Documentação, Redação)',
    uf: 'Nacional',
    regiao: 'Nacional',
    esfera: 'Federal',
    area: 'Administrativa',
    escolaridade: 'Superior',
    vagas: 66,
    vagasCR: 118,
    salarioMin: 32070.88,
    salarioMax: 32070.88,
    beneficiosResumo: 'Uma das maiores remunerações iniciais da União (R$ 32.070,88) · Lotação em Brasília/DF',
    banca: 'Cebraspe',
    status: 'Prova Agendada',
    taxaInscricao: 130.0,
    inscricaoInicio: '2026-10-15',
    inscricaoFim: '2026-11-17',
    dataProva: '2027-01-17',
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Provas em 17/01/2027 nas 26 capitais e no DF',
    destaqueGratuito: false,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'Câmara dos Deputados / Cebraspe',
    anosAnteriores: [2023, 2014, 2012, 2007, 2003],
    questoesPadrao: 120,
    edital: {
      numero: 'Edital Câmara dos Deputados 2026 — Analista Legislativo',
      publicadoEm: '2026-10-10',
      paginas: 94,
      urlPdf: 'https://www.cebraspe.org.br',
      cargos: [
        { nome: 'Analista Legislativo — Comunicação, Engenharia, Documentação, Museólogo e Registro/Redação', vagas: 66, salario: 32070.88, escolaridade: 'Superior Específico (+ 118 CR)' }
      ],
      disciplinas: [
        { nome: 'Conhecimentos Específicos da Atribuição', questoes: 70, peso: 58 },
        { nome: 'Regimento Interno da Câmara e Processo Legislativo', questoes: 20, peso: 17 },
        { nome: 'Língua Portuguesa, Direito Constitucional e Administrativo', questoes: 30, peso: 25 }
      ],
      etapas: [
        'Inscrições encerradas em 17/11/2026 (pagamento até 19/11)',
        'Provas Objetivas e Discursivas confirmadas para 17/01/2027 em todas as capitais'
      ],
      requisitosChave: [
        'Remuneração inicial oficial de R$ 32.070,88 para 40h semanais em Brasília/DF',
        'Organizado pelo Cebraspe — provas nas 26 capitais + DF em janeiro/2027'
      ]
    },
    cursos: [
      {
        plataformaId: 'estrategia',
        plataforma: 'Estratégia Concursos',
        titulo: 'Câmara dos Deputados Cebraspe — Reta Final + Discursivas',
        precoMensal: 99.9,
        precoTotal: 1198.8,
        parcelas: '12x de R$ 99,90 (ref.)',
        formato: 'PDFs + Regimento Interno + Rodadas Discursivas',
        cargaHoraria: '480h',
        nota: 4.9,
        avaliacoes: 2950,
        destaque: 'Líder Legislativo',
        cupom: 'CHECK15',
        url: 'https://www.estrategiaconcursos.com.br/cursosPorConcurso/camara-dos-deputados/'
      },
      {
        plataformaId: 'gran',
        plataforma: 'Gran Cursos Online',
        titulo: 'Câmara dos Deputados — Analista Legislativo (Cebraspe)',
        precoMensal: 69.9,
        precoTotal: 838.8,
        parcelas: '12x de R$ 69,90 (ref.)',
        formato: 'Videoaulas + PDFs + Gran Questões',
        cargaHoraria: '440h',
        nota: 4.9,
        avaliacoes: 2410,
        destaque: 'Custo-Benefício',
        cupom: 'CHECKGRAN10',
        url: 'https://www.grancursosonline.com.br/cursos/por-concurso/camara-dos-deputados'
      }
    ]
  },
  {
    id: 'trf-3-sp-ms-2026',
    sigla: 'TRF-3',
    orgao: 'Tribunal Regional Federal da 3ª Região (SP/MS)',
    titulo: 'Técnico Judiciário e Analista Judiciário (11 vagas + CR)',
    uf: 'SP',
    regiao: 'Sudeste',
    esfera: 'Federal',
    area: 'Tribunais',
    escolaridade: 'Superior',
    vagas: 11,
    vagasCR: 400,
    salarioMin: 9776.73,
    salarioMax: 20013.11,
    beneficiosResumo: 'Inclui Oficial de Justiça Avaliador (R$ 20.013,11), Analista TI/Jud. (R$ 16.040,87) e Técnico (R$ 9.776,73)',
    banca: 'Fundação Vunesp',
    status: 'Prova Agendada',
    taxaInscricao: 100.0,
    inscricaoInicio: '2026-11-04',
    inscricaoFim: '2026-11-23',
    dataProva: '2027-01-31',
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Inscrições encerraram em 23/11 · Prova em 31/01/2027',
    destaqueGratuito: false,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'TRF-3 (trf3.jus.br) / Fundação Vunesp',
    anosAnteriores: [2024, 2023, 2019, 2016, 2013],
    questoesPadrao: 60,
    edital: {
      numero: 'Edital TRF 3ª Região 2026 — SP e MS',
      publicadoEm: '2026-10-30',
      paginas: 70,
      urlPdf: 'https://www.vunesp.com.br',
      cargos: [
        { nome: 'Técnico Judiciário (Dev. Sistemas, Suporte TI, Contabilidade)', vagas: 5, salario: 9776.73, escolaridade: 'Superior' },
        { nome: 'Analista Judiciário (Área Judiciária, Sistemas e Suporte TI)', vagas: 4, salario: 16040.87, escolaridade: 'Superior' },
        { nome: 'Analista Judiciário — Oficial de Justiça Avaliador Federal', vagas: 2, salario: 20013.11, escolaridade: 'Direito' }
      ],
      disciplinas: [
        { nome: 'Conhecimentos Específicos (TI / Direito / Contabilidade)', questoes: 40, peso: 67 },
        { nome: 'Língua Portuguesa (Vunesp)', questoes: 12, peso: 20 },
        { nome: 'Raciocínio Lógico e Noções de Sustentabilidade/Direitos Humanos', questoes: 8, peso: 13 }
      ],
      etapas: [
        'Inscrições encerradas ontem (23/11/2026)',
        'Provas Objetivas e Discursivas confirmadas para 31/01/2027'
      ],
      requisitosChave: [
        'Abrange o TRF-3 e Seções Judiciárias de São Paulo (SP) e Mato Grosso do Sul (MS)',
        'Banca Fundação Vunesp — foco em questões anteriores da banca até 31/01/2027'
      ]
    },
    cursos: [
      {
        plataformaId: 'estrategia',
        plataforma: 'Estratégia Concursos',
        titulo: 'TRF-3 Pós-Edital Vunesp — Técnico e Analista (TI e Direito)',
        precoMensal: 69.9,
        precoTotal: 838.8,
        parcelas: '12x de R$ 69,90 (ref.)',
        formato: 'PDFs + Videoaulas + Simulados Vunesp',
        cargaHoraria: '390h',
        nota: 4.9,
        avaliacoes: 2290,
        destaque: 'Pós-Edital Vunesp',
        cupom: 'CHECK15',
        url: 'https://www.estrategiaconcursos.com.br/cursosPorConcurso/trf-3/'
      },
      {
        plataformaId: 'gran',
        plataforma: 'Gran Cursos Online',
        titulo: 'TRF 3ª Região Completo — Reta Final Vunesp',
        precoMensal: 54.9,
        precoTotal: 658.8,
        parcelas: '12x de R$ 54,90 (ref.)',
        formato: 'Videoaulas + PDFs + Gran Questões',
        cargaHoraria: '350h',
        nota: 4.8,
        avaliacoes: 1940,
        destaque: 'Custo-Benefício',
        cupom: 'CHECKGRAN10',
        url: 'https://www.grancursosonline.com.br/cursos/por-concurso/trf-3'
      }
    ]
  },

  // =========================================================
  // 4. PREVISTOS / AUTORIZADOS COM BANCA EM DEFINIÇÃO OU CONTRATADA
  // =========================================================
  {
    id: 'bacen-autorizado-2026',
    sigla: 'BACEN',
    orgao: 'Banco Central do Brasil',
    titulo: 'Auditor (100 vagas) e Técnico (50 vagas) — Banca FGV contratada',
    uf: 'Nacional',
    regiao: 'Nacional',
    esfera: 'Federal',
    area: 'Fiscal',
    escolaridade: 'Superior',
    vagas: 150,
    vagasCR: 150,
    salarioMin: 8300.0,
    salarioMax: 20000.0,
    beneficiosResumo: 'Contrato com a FGV assinado em novembro/2026 · +20 vagas autorizadas para Procurador via AGU',
    banca: 'FGV',
    status: 'Previsto / Autorizado',
    taxaInscricao: 150.0,
    inscricaoInicio: null,
    inscricaoFim: null,
    dataProva: null,
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Edital previsto até 30/12/2026 · Data de prova sairá no edital',
    destaqueGratuito: false,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'DOU / Banco Central (Contrato FGV Nov/2026)',
    anosAnteriores: [2024, 2013, 2009, 2005, 2002],
    questoesPadrao: 120,
    edital: {
      numero: 'Autorizado — Contrato FGV assinado (Edital previsto até 30/12/2026)',
      publicadoEm: '2026-11-18',
      paginas: 0,
      urlPdf: 'https://conhecimento.fgv.br/concursos',
      cargos: [
        { nome: 'Auditor do Banco Central (ex-Analista)', vagas: 100, salario: 20000.0, escolaridade: 'Nível Superior' },
        { nome: 'Técnico do Banco Central', vagas: 50, salario: 8300.0, escolaridade: 'Médio / Superior (em tramitação)' }
      ],
      disciplinas: [
        { nome: 'Economia, Finanças, TI e Ciência de Dados (Base FGV)', questoes: 60, peso: 55 },
        { nome: 'Sistema Financeiro Nacional e Regulação Bancária', questoes: 25, peso: 20 },
        { nome: 'Língua Portuguesa, Inglês, Direito Const. e Administrativo', questoes: 35, peso: 25 }
      ],
      etapas: [
        'Banca FGV contratada oficialmente em novembro de 2026',
        'Publicação do edital prevista no cronograma até 30 de dezembro de 2026'
      ],
      requisitosChave: [
        'Salve nos favoritos para receber alerta push assim que o edital e a data da prova saírem',
        'Atenção: mudança de banca histórica para a FGV exige treino no estilo FGV'
      ]
    },
    cursos: [
      {
        plataformaId: 'estrategia',
        plataforma: 'Estratégia Concursos',
        titulo: 'BACEN Pré-Edital FGV — Auditor e Técnico (Atualização Grátis)',
        precoMensal: 99.9,
        precoTotal: 1198.8,
        parcelas: '12x de R$ 99,90 (ref.)',
        formato: 'PDFs + Videoaulas + Atualização Pós-Edital Garantida',
        cargaHoraria: '590h',
        nota: 4.9,
        avaliacoes: 2140,
        destaque: 'Banca FGV Definida',
        cupom: 'CHECK15',
        url: 'https://www.estrategiaconcursos.com.br/cursosPorConcurso/bacen/'
      },
      {
        plataformaId: 'direcao',
        plataforma: 'Direção Concursos',
        titulo: 'Banco Central Pré-Edital FGV (PDF 2.0)',
        precoMensal: 84.9,
        precoTotal: 1018.8,
        parcelas: '12x de R$ 84,90 (ref.)',
        formato: 'PDF 2.0 + Questões FGV',
        cargaHoraria: '520h',
        nota: 4.9,
        avaliacoes: 1320,
        destaque: 'Custo-Benefício',
        cupom: 'CHECKDIR12',
        url: 'https://www.direcaoconcursos.com.br/concursos/bacen'
      }
    ]
  },
  {
    id: 'receita-federal-autorizado-2026',
    sigla: 'RFB',
    orgao: 'Receita Federal do Brasil',
    titulo: 'Auditor-Fiscal e Analista-Tributário (146 vagas autorizadas)',
    uf: 'Nacional',
    regiao: 'Nacional',
    esfera: 'Federal',
    area: 'Fiscal',
    escolaridade: 'Superior',
    vagas: 146,
    vagasCR: 146,
    salarioMin: 12142.39,
    salarioMax: 21029.09,
    beneficiosResumo: 'Autorizado com 146 vagas · FGV em trâmites de contratação para organização do edital',
    banca: 'FGV (em contratação)',
    status: 'Previsto / Autorizado',
    taxaInscricao: 210.0,
    inscricaoInicio: null,
    inscricaoFim: null,
    dataProva: null,
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Autorizado (146 vagas) · Edital e data da prova aguardados',
    destaqueGratuito: false,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'Ministério da Fazenda / MGI / Gov.br',
    anosAnteriores: [2023, 2014, 2012, 2009, 2005],
    questoesPadrao: 120,
    edital: {
      numero: 'Autorização Oficial — 146 vagas (RFB / FGV em contratação)',
      publicadoEm: '2026-11-12',
      paginas: 0,
      urlPdf: 'https://www.gov.br/receitafederal',
      cargos: [
        { nome: 'Auditor-Fiscal da Receita Federal', vagas: 70, salario: 21029.09, escolaridade: 'Superior (qualquer área)' },
        { nome: 'Analista-Tributário da Receita Federal', vagas: 76, salario: 12142.39, escolaridade: 'Superior (qualquer área)' }
      ],
      disciplinas: [
        { nome: 'Direito Tributário, Legislação Tributária e Aduaneira', questoes: 35, peso: 32 },
        { nome: 'Contabilidade Geral, Pública e Auditoria', questoes: 30, peso: 26 },
        { nome: 'Fluência em Dados, Comércio Internacional e Economia', questoes: 25, peso: 22 },
        { nome: 'Língua Portuguesa, Inglês e Direito Adm./Const. (FGV)', questoes: 30, peso: 20 }
      ],
      etapas: [
        'Trâmites de contratação da Fundação Getulio Vargas (FGV) em fase avançada',
        'Ative o alerta para ser notificado no minuto em que o edital e a data da prova forem publicados'
      ],
      requisitosChave: [
        'Graduação em qualquer área de formação aceita para ambos os cargos',
        'Estudo antecipado com base no último edital FGV (2023) é decisivo para aprovação'
      ]
    },
    cursos: [
      {
        plataformaId: 'estrategia',
        plataforma: 'Estratégia Concursos',
        titulo: 'Receita Federal Pré-Edital FGV (Atualização Pós-Edital Inclusa)',
        precoMensal: 109.9,
        precoTotal: 1318.8,
        parcelas: '12x de R$ 109,90 (ref.)',
        formato: 'PDFs + Videoaulas + Fluência em Dados',
        cargaHoraria: '690h',
        nota: 4.9,
        avaliacoes: 4120,
        destaque: 'Líder Área Fiscal',
        cupom: 'CHECK15',
        url: 'https://www.estrategiaconcursos.com.br/cursosPorConcurso/receita-federal/'
      },
      {
        plataformaId: 'direcao',
        plataforma: 'Direção Concursos',
        titulo: 'RFB Completo — Analista e Auditor (PDF 2.0 FGV)',
        precoMensal: 94.9,
        precoTotal: 1138.8,
        parcelas: '12x de R$ 94,90 (ref.)',
        formato: 'PDF 2.0 + Cadernos FGV',
        cargaHoraria: '620h',
        nota: 4.9,
        avaliacoes: 2280,
        destaque: 'Custo-Benefício Fiscal',
        cupom: 'CHECKDIR12',
        url: 'https://www.direcaoconcursos.com.br/concursos/concurso-receita-federal'
      }
    ]
  },

  // =========================================================
  // 5. ENCERRADOS / PROVAS JÁ REALIZADAS EM 2026
  // =========================================================
  {
    id: 'tcdf-2026-encerrado',
    sigla: 'TCDF',
    orgao: 'Tribunal de Contas do Distrito Federal',
    titulo: 'Analista Administrativo de Controle Externo — Prova Realizada',
    uf: 'DF',
    regiao: 'Centro-Oeste',
    esfera: 'Estadual',
    area: 'Fiscal',
    escolaridade: 'Superior',
    vagas: 10,
    vagasCR: 50,
    salarioMin: 14990.41,
    salarioMax: 14990.41,
    beneficiosResumo: 'Prova aplicada em 22/11/2026 · Gabarito preliminar saiu hoje (24/11), recursos até 02/12',
    banca: 'Cebraspe',
    status: 'Encerrado',
    taxaInscricao: 140.0,
    inscricaoInicio: '2026-08-26',
    inscricaoFim: '2026-09-17',
    dataProva: '2026-11-22',
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Prova realizada em 22/11 · Gabarito preliminar em 24/11',
    destaqueGratuito: false,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'TCDF / Cebraspe',
    anosAnteriores: [2026, 2023, 2021, 2014, 2012],
    questoesPadrao: 120,
    edital: {
      numero: 'Edital TCDF 2026 — Analista Administrativo (Prova Realizada)',
      publicadoEm: '2026-08-18',
      paginas: 68,
      urlPdf: 'https://www.cebraspe.org.br',
      cargos: [
        { nome: 'Analista Administrativo de Controle Externo (Gestão)', vagas: 10, salario: 14990.41, escolaridade: 'Superior (+ CR)' }
      ],
      disciplinas: [
        { nome: 'Administração Pública, Orçamento (AFO) e Licitações', questoes: 45, peso: 38 },
        { nome: 'Direito Administrativo, Constitucional e LC 840/DF', questoes: 40, peso: 33 },
        { nome: 'Língua Portuguesa, Controle Externo e Gestão de Pessoas', questoes: 35, peso: 29 }
      ],
      etapas: [
        'Provas Objetiva e Discursiva aplicadas em 22/11/2026',
        'Gabarito preliminar divulgado em 24/11/2026 · Recursos de 25/11 a 02/12/2026'
      ],
      requisitosChave: [
        'Certame marcado como Encerrado para inscrições e provas — acompanhe recursos no Cebraspe',
        'Prova de 22/11/2026 já entra no histórico para quem estuda para Tribunais de Contas'
      ]
    },
    cursos: [
      {
        plataformaId: 'estrategia',
        plataforma: 'Estratégia Concursos',
        titulo: 'Carreira Controle Externo Cebraspe (Próximos TCEs/TCDF)',
        precoMensal: 89.9,
        precoTotal: 1078.8,
        parcelas: '12x de R$ 89,90 (ref.)',
        formato: 'PDFs + Videoaulas + Provas Comentadas',
        cargaHoraria: '520h',
        nota: 4.9,
        avaliacoes: 2610,
        destaque: 'Base Controle',
        cupom: 'CHECK15',
        url: 'https://www.estrategiaconcursos.com.br/cursosPorConcurso/tcdf/'
      },
      {
        plataformaId: 'gran',
        plataforma: 'Gran Cursos Online',
        titulo: 'Trilha Tribunais de Contas (Cebraspe)',
        precoMensal: 64.9,
        precoTotal: 778.8,
        parcelas: '12x de R$ 64,90 (ref.)',
        formato: 'Videoaulas + Gran Questões Controle',
        cargaHoraria: '460h',
        nota: 4.8,
        avaliacoes: 2180,
        destaque: 'Estudo Contínuo',
        cupom: 'CHECKGRAN10',
        url: 'https://www.grancursosonline.com.br/cursos/por-concurso/tcdf'
      }
    ]
  },
  {
    id: 'seduc-ce-2026-encerrado',
    sigla: 'SEDUC-CE',
    orgao: 'Secretaria da Educação do Ceará',
    titulo: 'Professor Nível C (2.000 vagas + 1.000 CR) — Prova Realizada',
    uf: 'CE',
    regiao: 'Nordeste',
    esfera: 'Estadual',
    area: 'Educação',
    escolaridade: 'Superior',
    vagas: 2000,
    vagasCR: 1000,
    salarioMin: 7181.41,
    salarioMax: 7181.41,
    beneficiosResumo: 'Prova aplicada em 22/11/2026 · Gabarito definitivo previsto para 18/12/2026',
    banca: 'CEV / UECE',
    status: 'Encerrado',
    taxaInscricao: 130.0,
    inscricaoInicio: '2026-09-01',
    inscricaoFim: '2026-10-08',
    dataProva: '2026-11-22',
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Prova realizada em 22/11 · Gabarito definitivo em 18/12',
    destaqueGratuito: false,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'SEDUC-CE / CEV-UECE',
    anosAnteriores: [2026, 2022, 2018, 2013, 2009],
    questoesPadrao: 60,
    edital: {
      numero: 'Edital SEDUC-CE 2026 — Professor Nível C (Prova Realizada)',
      publicadoEm: '2026-08-25',
      paginas: 72,
      urlPdf: 'https://www.uece.br/cev',
      cargos: [
        { nome: 'Professor Nível C (40h — Rede Estadual do Ceará)', vagas: 2000, salario: 7181.41, escolaridade: 'Licenciatura Plena (+ 1.000 CR)' }
      ],
      disciplinas: [
        { nome: 'Conhecimentos Específicos da Disciplina', questoes: 30, peso: 50 },
        { nome: 'Didática, LDB, BNCC e Legislação Educacional', questoes: 20, peso: 33 },
        { nome: 'Língua Portuguesa e Administração Pública', questoes: 10, peso: 17 }
      ],
      etapas: [
        'Prova Objetiva aplicada em 22/11/2026',
        'Previsão de gabarito oficial definitivo e resultado dos recursos em 18/12/2026'
      ],
      requisitosChave: [
        'Inscrições e prova objetiva concluídas — certame arquivado como Encerrado no calendário',
        'Salário inicial real de R$ 7.181,41 (40h) consolidou-se entre os melhores do Nordeste'
      ]
    },
    cursos: [
      {
        plataformaId: 'gran',
        plataforma: 'Gran Cursos Online',
        titulo: 'Carreira Magistério Estadual — LDB, BNCC e Didática',
        precoMensal: 34.9,
        precoTotal: 418.8,
        parcelas: '12x de R$ 34,90 (ref.)',
        formato: 'Videoaulas + Questões UECE e Estaduais',
        cargaHoraria: '260h',
        nota: 4.8,
        avaliacoes: 1840,
        destaque: 'Base Educação',
        cupom: 'CHECKGRAN10',
        url: 'https://www.grancursosonline.com.br'
      },
      {
        plataformaId: 'qconcursos',
        plataforma: 'QConcursos',
        titulo: 'Provas Anteriores CEV/UECE Comentadas',
        precoMensal: 24.9,
        precoTotal: 298.8,
        parcelas: '12x de R$ 24,90 (ref.)',
        formato: 'Questões Comentadas de Licenciaturas',
        cargaHoraria: '140h',
        nota: 4.7,
        avaliacoes: 1290,
        destaque: 'Treino por Banca',
        cupom: 'CHECKQ15',
        url: 'https://www.qconcursos.com'
      }
    ]
  },
  {
    id: 'fab-eear-cfs-2026-encerrado',
    sigla: 'FAB / EEAR',
    orgao: 'Força Aérea Brasileira — Escola de Especialistas de Aeronáutica',
    titulo: 'CFS 2/2027 — Curso de Formação de Sargentos (235 vagas) — Encerrado',
    uf: 'Nacional',
    regiao: 'Nacional',
    esfera: 'Federal',
    area: 'Policial',
    escolaridade: 'Médio / Técnico',
    vagas: 235,
    vagasCR: 0,
    salarioMin: 4177.0,
    salarioMax: 4177.0,
    beneficiosResumo: 'Prova realizada em 22/11/2026 · Gabarito preliminar saiu hoje (24/11), recursos até 26/11',
    banca: 'EEAR (Própria)',
    status: 'Encerrado',
    taxaInscricao: 95.0,
    inscricaoInicio: '2026-07-15',
    inscricaoFim: '2026-08-20',
    dataProva: '2026-11-22',
    dataProvaAtualizadaEm: '2026-11-24',
    provaObservacao: 'Prova realizada em 22/11 · Recursos do gabarito até 26/11',
    destaqueGratuito: false,
    atualizadoEm: '2026-11-24',
    fonteOficial: 'EEAR / Força Aérea Brasileira (CFS 2/2027)',
    anosAnteriores: [2026, 2025, 2024, 2023, 2022],
    questoesPadrao: 96,
    edital: {
      numero: 'Exame de Admissão CFS 2/2027 — EEAR/FAB (Prova Realizada)',
      publicadoEm: '2026-07-01',
      paginas: 74,
      urlPdf: 'https://ingresso.eear.aer.mil.br',
      cargos: [
        { nome: 'Sargento Especialista da Aeronáutica (Tráfego Aéreo, Mecânica, Eletrônica e outras)', vagas: 235, salario: 4177.0, escolaridade: 'Ensino Médio / Técnico' }
      ],
      disciplinas: [
        { nome: 'Língua Portuguesa', questoes: 24, peso: 25 },
        { nome: 'Língua Inglesa', questoes: 24, peso: 25 },
        { nome: 'Matemática', questoes: 24, peso: 25 },
        { nome: 'Física', questoes: 24, peso: 25 }
      ],
      etapas: [
        'Provas Escritas aplicadas em 22/11/2026 em todo o Brasil',
        'Gabarito preliminar divulgado em 24/11/2026 (recursos abertos até 26/11)'
      ],
      requisitosChave: [
        'Prova escrita concluída — novos candidatos já podem se preparar para o próximo exame semestral da EEAR',
        'Banca própria com altíssima repetição de padrão nas 5 provas anteriores'
      ]
    },
    cursos: [
      {
        plataformaId: 'estrategia',
        plataforma: 'Estratégia Concursos',
        titulo: 'Estratégia Militares — Pacote EEAR Próxima Edição',
        precoMensal: 54.9,
        precoTotal: 658.8,
        parcelas: '12x de R$ 54,90 (ref.)',
        formato: 'PDFs + Videoaulas + Simulados EEAR',
        cargaHoraria: '410h',
        nota: 4.9,
        avaliacoes: 3890,
        destaque: 'Líder Militares',
        cupom: 'CHECK15',
        url: 'https://militares.estrategia.com'
      },
      {
        plataformaId: 'gran',
        plataforma: 'Gran Cursos Online',
        titulo: 'EEAR Sargento da Aeronáutica — Curso Completo',
        precoMensal: 42.9,
        precoTotal: 514.8,
        parcelas: '12x de R$ 42,90 (ref.)',
        formato: 'Videoaulas + Questões EEAR Comentadas',
        cargaHoraria: '360h',
        nota: 4.8,
        avaliacoes: 2140,
        destaque: 'Custo-Benefício',
        cupom: 'CHECKGRAN10',
        url: 'https://www.grancursosonline.com.br'
      }
    ]
  },
  {
    id: 'detran-al-2026-encerrado',
    sigla: 'DETRAN-AL',
    orgao: 'Departamento Estadual de Trânsito de Alagoas',
    titulo: 'Analista de Trânsito e Assistente de Trânsito — Certame Encerrado',
    uf: 'AL',
    regiao: 'Nordeste',
    esfera: 'Estadual',
    area: 'Administrativa',
    escolaridade: 'Médio / Superior',
    vagas: 50,
    vagasCR: 66,
    salarioMin: 5454.54,
    salarioMax: 7800.0,
    beneficiosResumo: 'Prova aplicada em 20/09/2026 · Gabarito definitivo oficial publicado em 28/10/2026',
    banca: 'Cebraspe',
    status: 'Encerrado',
    taxaInscricao: 100.0,
    inscricaoInicio: '2026-05-06',
    inscricaoFim: '2026-06-29',
    dataProva: '2026-09-20',
    dataProvaAtualizadaEm: '2026-10-28',
    provaObservacao: 'Prova realizada em 20/09 · Gabarito definitivo em 28/10',
    destaqueGratuito: false,
    atualizadoEm: '2026-10-28',
    fonteOficial: 'DETRAN-AL / Cebraspe',
    anosAnteriores: [2026, 2013, 2008, 2004, 2001],
    questoesPadrao: 120,
    edital: {
      numero: 'Edital DETRAN-AL 2026 — Cebraspe (Encerrado)',
      publicadoEm: '2026-04-30',
      paginas: 62,
      urlPdf: 'https://www.cebraspe.org.br',
      cargos: [
        { nome: 'Assistente de Trânsito', vagas: 30, salario: 5454.54, escolaridade: 'Ensino Médio (+ CR)' },
        { nome: 'Analista de Trânsito (diversas especialidades)', vagas: 20, salario: 7800.0, escolaridade: 'Nível Superior (+ CR)' }
      ],
      disciplinas: [
        { nome: 'Código de Trânsito Brasileiro (CTB) e Resoluções CONTRAN', questoes: 50, peso: 42 },
        { nome: 'Língua Portuguesa, Informática e Ética', questoes: 35, peso: 29 },
        { nome: 'Direito Administrativo, Constitucional e Gestão Pública', questoes: 35, peso: 29 }
      ],
      etapas: [
        'Provas Objetivas aplicadas em 20/09/2026',
        'Gabarito definitivo oficial publicado pelo Cebraspe em 28/10/2026'
      ],
      requisitosChave: [
        'Certame finalizado no calendário de provas — mantido no histórico para consulta e provas anteriores',
        'Total de 116 oportunidades (50 imediatas + 66 em cadastro reserva)'
      ]
    },
    cursos: [
      {
        plataformaId: 'gran',
        plataforma: 'Gran Cursos Online',
        titulo: 'Carreira DETRANs Estaduais — CTB + Cebraspe',
        precoMensal: 39.9,
        precoTotal: 478.8,
        parcelas: '12x de R$ 39,90 (ref.)',
        formato: 'Videoaulas + CTB Atualizado + Questões',
        cargaHoraria: '270h',
        nota: 4.8,
        avaliacoes: 1520,
        destaque: 'Carreira Trânsito',
        cupom: 'CHECKGRAN10',
        url: 'https://www.grancursosonline.com.br'
      },
      {
        plataformaId: 'qconcursos',
        plataforma: 'QConcursos',
        titulo: 'Caderno Cebraspe DETRAN + Legislação de Trânsito',
        precoMensal: 24.9,
        precoTotal: 298.8,
        parcelas: '12x de R$ 24,90 (ref.)',
        formato: 'Questões Cebraspe Comentadas',
        cargaHoraria: '140h',
        nota: 4.8,
        avaliacoes: 1710,
        destaque: 'Treino por Provas',
        cupom: 'CHECKQ15',
        url: 'https://www.qconcursos.com'
      }
    ]
  }
];

const ALL_RAW_CONCURSOS = [
  ...RAW_CONCURSOS,
  ...ESTADOS_NORTE,
  ...ESTADOS_NORDESTE,
  ...ESTADOS_CENTRO_OESTE,
  ...ESTADOS_SUDESTE,
  ...ESTADOS_SUL,
  ...ESTADOS_ATIVOS_2026_11
];

/**
 * Nota de importância (0–200 aprox.): vagas, salário, esfera, carreiras de elite e
 * penalidade para seleção temporária. Usada para ordenar o Top 10 de cada estado.
 */
export function calcImportancia(c) {
  const temp = /seletiv|substitut|tempor|pss|contrata[cç][aã]o/i.test(`${c.titulo} ${c.banca}`);
  let sc = Math.log10((c.vagas || 0) + 1) * 30 + (Math.min(c.salarioMax || 0, 30000) / 1000) * 2.2;
  if (c.esfera === 'Estadual') sc += 14;
  if (c.esfera === 'Federal') sc += 12;
  if (temp) sc -= 22;
  if (['Policial', 'Tribunais', 'Fiscal'].includes(c.area)) sc += 8;
  return Math.round(sc * 10) / 10;
}

export const CONCURSOS = ALL_RAW_CONCURSOS.map(({ anosAnteriores, questoesPadrao, ...rest }) => ({
  ...rest,
  importancia: calcImportancia(rest),
  provasAnteriores: buildFivePastExams(
    rest.sigla,
    rest.banca,
    rest.edital.cargos[0]?.nome || rest.titulo,
    anosAnteriores,
    questoesPadrao
  )
}));
