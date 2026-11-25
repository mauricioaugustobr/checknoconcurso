import { renderBlogIndex, renderBlogPost } from '../lib/pages.js';

export function GET(request) {
  const slug = new URL(request.url).searchParams.get('slug');
  return slug ? renderBlogPost(request, slug) : renderBlogIndex(request);
}
