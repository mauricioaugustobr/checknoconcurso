import { renderSitemap } from '../lib/pages.js';

export function GET(request) {
  return renderSitemap(request);
}
