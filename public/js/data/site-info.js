// Informações públicas do site (marca, planos, regiões e plataformas parceiras).
// Ficam separadas do catálogo de concursos: este arquivo é público; o catálogo só chega
// a quem tem plano, pela API.
import { ESTADOS_BRASIL } from './estado-builder.js';
export { ESTADOS_BRASIL };

export const MARCA = {
  nome: 'Check no Concurso',
  dominio: 'checknoconcurso.com.br',
  atualizadoEm: '2026-11-24',
  tagline: 'Concursos reais abertos e encerrados em todo o Brasil, datas de prova atualizadas, editais, cursos e treino com questões de provas anteriores.'
};

export const PLANOS = {
  essencial: {
    id: 'essencial',
    nome: 'Check Essencial',
    preco: 9.99,
    periodicidade: 'mês',
    rotuloPreco: 'R$ 9,99/mês',
    resumo: 'Acesso a todos os concursos abertos e encerrados do Brasil, datas de prova atualizadas, salários e vagas, editais completos com Raio-X e comparador de cursos.'
  },
  completoMensal: {
    id: 'completo-mensal',
    nome: 'Check Completo',
    preco: 23.99,
    periodicidade: 'mês',
    rotuloPreco: 'R$ 23,99/mês',
    resumo: 'Tudo do Essencial + treinar com questões de provas anteriores, com resposta e explicação em 3 parágrafos abaixo de cada questão.'
  },
  completoAnual: {
    id: 'completo-anual',
    nome: 'Check Completo Anual',
    preco: 199.90,
    equivalenteMensal: 16.66,
    economiaAnual: 87.98,
    periodicidade: 'ano',
    rotuloPreco: 'R$ 199,90/ano',
    resumo: 'Acesso total por 12 meses com desconto especial (equivale a R$ 16,66/mês), incluindo o treino com questões de provas anteriores.'
  }
};

export const PLATAFORMAS_PARCEIRAS = [
  { id: 'estrategia', nome: 'Estratégia Concursos', cor: '#DC2626', destaque: 'PDFs completos + Passo Estratégico', urlBase: 'https://www.estrategiaconcursos.com.br' },
  { id: 'gran', nome: 'Gran Cursos Online', cor: '#1D4ED8', destaque: 'Videoaulas + Gran Questões ilimitado', urlBase: 'https://www.grancursosonline.com.br' },
  { id: 'direcao', nome: 'Direção Concursos', cor: '#0F766E', destaque: 'PDF 2.0 interativo + Mentoria', urlBase: 'https://www.direcaoconcursos.com.br' },
  { id: 'qconcursos', nome: 'QConcursos', cor: '#EA580C', destaque: 'Maior banco de questões comentadas', urlBase: 'https://www.qconcursos.com' },
  { id: 'alfacon', nome: 'AlfaCon', cor: '#B45309', destaque: 'Forte tradição em carreiras policiais', urlBase: 'https://www.alfaconcursos.com.br' },
  { id: 'nova', nome: 'Nova Concursos', cor: '#7C3AED', destaque: 'Custo acessível para nível médio e prefeituras', urlBase: 'https://www.novaconcursos.com.br' }
];

export const REGIOES_BRASIL = [
  { id: 'TODAS', nome: 'Todo o Brasil', ufs: [] },
  { id: 'Nacional', nome: 'Nacional', ufs: ['Nacional'] },
  { id: 'Sudeste', nome: 'Sudeste', ufs: ['SP', 'RJ', 'MG', 'ES'] },
  { id: 'Sul', nome: 'Sul', ufs: ['PR', 'SC', 'RS'] },
  { id: 'Nordeste', nome: 'Nordeste', ufs: ['BA', 'CE', 'PE', 'RN', 'PB', 'MA', 'PI', 'AL', 'SE'] },
  { id: 'Centro-Oeste', nome: 'Centro-Oeste', ufs: ['DF', 'GO', 'MT', 'MS'] },
  { id: 'Norte', nome: 'Norte', ufs: ['AM', 'PA', 'TO', 'RO', 'AC', 'AP', 'RR'] }
];
