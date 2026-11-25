import { renderEstadoPage } from '../lib/pages.js';

export function GET(request) {
  return renderEstadoPage(request, new URL(request.url).searchParams.get('uf') || '');
}
