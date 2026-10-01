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

/**
 * Recursively extracts a safe plain text / markdown string from arbitrary content,
 * supporting plain strings, numbers, Portable Text block objects ({_type: 'block', children: [...]}),
 * nested block arrays, and unknown entity structures. Prevents Minified React Error #31.
 */
export function extractTextFromContent(content: any): string {
  if (content === null || content === undefined) return '';

  if (typeof content === 'string') {
    const trimmed = content.trim();
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        const parsed = JSON.parse(trimmed);
        const extracted = extractTextFromContent(parsed);
        if (extracted) return extracted;
      } catch {}
    }
    return content;
  }

  if (typeof content === 'number' || typeof content === 'boolean') return String(content);

  if (Array.isArray(content)) {
    return content.map(extractTextFromContent).filter(Boolean).join('\n\n');
  }

  if (typeof content === 'object') {
    // 1. Check Portable Text / rich text children array
    if (Array.isArray(content.children)) {
      const blockText = content.children.map(extractTextFromContent).filter(Boolean).join('');
      if (blockText) return blockText;
    }

    // 2. Check direct string fields
    if (typeof content.text === 'string') return content.text;
    if (typeof content.value === 'string') return content.value;
    if (typeof content.name === 'string') return content.name;
    if (typeof content.title === 'string') return content.title;
    if (typeof content.label === 'string') return content.label;

    // 3. Check nested document properties
    if (content.recap) return extractTextFromContent(content.recap);
    if (content.synopsis) return extractTextFromContent(content.synopsis);
    if (content.notes) return extractTextFromContent(content.notes);
    if (content.description) return extractTextFromContent(content.description);
    if (content.summary) return extractTextFromContent(content.summary);
    if (content.chapterName) return extractTextFromContent(content.chapterName);
    if (content.location) return extractTextFromContent(content.location);

    // 4. Fallback for object: NEVER return the object itself
    return '';
  }

  return '';
}

/**
 * Ensures any value passed to React children is a clean primitive string,
 * preventing Minified React Error #31 when rendering objects.
 */
export function safeString(val: any, fallback = ''): string {
  const extracted = extractTextFromContent(val);
  return extracted || fallback;
}


