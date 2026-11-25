import { renderConcursoPage } from '../lib/pages.js';

export function GET(request) {
  return renderConcursoPage(request, new URL(request.url).searchParams.get('id') || '');
}
