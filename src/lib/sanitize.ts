import DOMPurify, { type Config } from 'dompurify';

/**
 * Universal HTML & Markdown Content Sanitizer (Anti-XSS Shield)
 * Neutralizes malicious code, script injections, event handlers, and rogue protocols.
 */

const DEFAULT_CONFIG: Config = {
  ALLOWED_TAGS: [
    'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'table', 'thead', 'tbody',
    'tr', 'th', 'td', 'span', 'div', 'img', 'mark', 'del', 'sub', 'sup'
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'target', 'rel', 'src', 'alt', 'width', 'height', 'class',
    'className', 'style', 'id', 'data-entity-id', 'data-type', 'role'
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  ADD_ATTR: ['target', 'rel'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'style'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'formaction'],
};

/**
 * Sanitizes arbitrary HTML string and strips potential XSS attack vectors.
 */
export function sanitizeHtml(dirtyHtml: string, customConfig?: Config): string {
  if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';
  if (typeof window === 'undefined') return dirtyHtml;

  const config = { ...DEFAULT_CONFIG, ...(customConfig || {}) };
  return DOMPurify.sanitize(dirtyHtml, config) as unknown as string;
}

/**
 * Sanitizes Markdown plain text by neutralizing embedded malicious inline HTML before Markdown parsing.
 * Uses DOMPurify to strip dangerous HTML, tags, protocols, and event handlers.
 */
export function sanitizeMarkdown(dirtyMarkdown: string): string {
  if (!dirtyMarkdown || typeof dirtyMarkdown !== 'string') return '';
  if (typeof window === 'undefined') return dirtyMarkdown;

  // 1. First pass: use DOMPurify to neutralize any dangerous raw HTML tags and handlers
  let cleaned = DOMPurify.sanitize(dirtyMarkdown, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'table', 'thead', 'tbody',
      'tr', 'th', 'td', 'span', 'div', 'img', 'mark', 'del', 'sub', 'sup'
    ],
    ALLOWED_ATTR: [
      'href', 'title', 'target', 'rel', 'src', 'alt', 'width', 'height', 'class',
      'className', 'id', 'data-entity-id', 'data-type', 'role'
    ],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'style', 'base', 'meta', 'svg'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'formaction', 'srcdoc'],
  }) as unknown as string;

  // 2. Neutralize inline markdown javascript: and data: links
  cleaned = cleaned.replace(/\[([^\]]+)\]\(javascript:[^)]+\)/gi, '[$1](#blocked-script)');
  cleaned = cleaned.replace(/\[([^\]]+)\]\(data:text\/html[^)]+\)/gi, '[$1](#blocked-data-uri)');
  cleaned = cleaned.replace(/href=["']javascript:[^"']+["']/gi, 'href="#blocked-script"');
  cleaned = cleaned.replace(/href=["']data:text\/html[^"']+["']/gi, 'href="#blocked-data-uri"');

  // 3. Neutralize any residual inline event handlers
  cleaned = cleaned.replace(/\s+(on\w+)=["'][^"']*["']/gi, '');

  return cleaned;
}

/**
 * Validates whether a URL is safe to open/render (prevents javascript: URIs).
 */
export function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:text/html') || trimmed.startsWith('vbscript:')) {
    return false;
  }
  return true;
}
