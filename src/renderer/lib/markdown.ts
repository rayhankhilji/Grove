import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.setOptions({ gfm: true, breaks: true })

/**
 * Model output is untrusted text. It is parsed as markdown and then sanitised
 * before it ever reaches innerHTML — the CSP blocks remote loads, and this
 * blocks everything script-shaped that could survive inside the document.
 */
export const render = (markdown: string): string =>
  DOMPurify.sanitize(marked.parse(markdown, { async: false }), {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'blockquote',
      'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'a', 'hr',
      'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    ALLOWED_ATTR: ['href'],
    ALLOWED_URI_REGEXP: /^https:\/\//i
  })
