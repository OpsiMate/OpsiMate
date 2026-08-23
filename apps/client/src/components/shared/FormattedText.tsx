import { cn } from '@/lib/utils';
import DOMPurify from 'dompurify';

// Safe subset of HTML allowed in user/integration-provided text (alert summaries,
// enrichment templates). Everything else — scripts, event handlers, iframes — is stripped.
const SANITIZE_CONFIG: DOMPurify.Config = {
	ALLOWED_TAGS: [
		'a',
		'b',
		'i',
		'em',
		'strong',
		'u',
		's',
		'p',
		'br',
		'hr',
		'div',
		'span',
		'font',
		'ul',
		'ol',
		'li',
		'code',
		'pre',
		'blockquote',
		'h1',
		'h2',
		'h3',
		'h4',
		'table',
		'thead',
		'tbody',
		'tfoot',
		'tr',
		'th',
		'td',
		'caption',
	],
	// `style` is allowed but hard-filtered to a color/formatting property allow-list (see
	// the hook below); `color`/`bgcolor`/`align`/`colspan`/`rowspan` are presentational
	// only (they carry no script or URL vector).
	ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'color', 'bgcolor', 'align', 'colspan', 'rowspan'],
};

// The only CSS properties an inline style may set. Anything else — layout/positioning
// (position, display, z-index, width, height, margin), which could overlay or hide UI —
// is dropped. Colors and basic text/table styling are what integrations actually use.
const ALLOWED_STYLE_PROPERTIES = new Set([
	'color',
	'background-color',
	'font-weight',
	'font-style',
	'text-decoration',
	'text-align',
	'border',
	'border-color',
	'border-width',
	'border-style',
	'padding',
]);

// Value-level guard, independent of the property allow-list: reject anything that could
// smuggle a fetch or script — url(), expression(), javascript:, @import, CSS comments, or
// angle brackets.
const DANGEROUS_CSS_VALUE = /url\(|expression|javascript:|@import|[<>]|\/\*/i;

// Keep only allow-listed, safe-valued declarations from a style attribute.
const sanitizeStyle = (raw: string): string =>
	raw
		.split(';')
		.map((declaration) => declaration.trim())
		.filter(Boolean)
		.filter((declaration) => {
			const colon = declaration.indexOf(':');
			if (colon === -1) return false;
			const property = declaration.slice(0, colon).trim().toLowerCase();
			const value = declaration.slice(colon + 1).trim();
			return ALLOWED_STYLE_PROPERTIES.has(property) && !DANGEROUS_CSS_VALUE.test(value);
		})
		.join('; ');

// Filter the style attribute down to the allow-list before DOMPurify keeps it.
DOMPurify.addHook('uponSanitizeAttribute', (_node, event) => {
	if (event.attrName === 'style') {
		event.attrValue = sanitizeStyle(event.attrValue);
	}
});

// Links open in a new tab and can't reach back into the opener.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
	if (node.tagName === 'A') {
		node.setAttribute('target', '_blank');
		node.setAttribute('rel', 'noopener noreferrer');
	}
});

const HTML_TAG_REGEX = /<\/?[a-z][\s\S]*?>/i;

export const containsHtml = (text: string): boolean => HTML_TAG_REGEX.test(text);

// Plain-text version of possibly-HTML content, for single-line contexts like table cells.
export const stripHtml = (text: string): string => {
	if (!containsHtml(text)) return text;
	const sanitized = DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
	return sanitized.replace(/\s+/g, ' ').trim();
};

interface FormattedTextProps {
	text: string;
	className?: string;
}

// Renders user/integration-provided text with formatting: newlines are preserved, and a safe
// subset of HTML (bold, links, lists, tables, colors, ...) is rendered after sanitization.
export const FormattedText = ({ text, className }: FormattedTextProps) => {
	if (!containsHtml(text)) {
		// overflow-wrap:anywhere (not just break-words) so a single very long token with no
		// spaces — e.g. an asset id — wraps instead of overflowing the panel width.
		return <div className={cn('whitespace-pre-line wrap-anywhere', className)}>{text}</div>;
	}
	const safe = DOMPurify.sanitize(text, SANITIZE_CONFIG);
	return (
		<div
			className={cn(
				'whitespace-pre-line wrap-anywhere',
				'[&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5',
				'[&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs',
				'[&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_h4]:text-sm [&_h4]:font-semibold',
				// Tables get visible structure by default; any inline colors layer on top.
				'[&_table]:my-2 [&_table]:border-collapse [&_table]:text-xs',
				'[&_caption]:text-xs [&_caption]:text-muted-foreground [&_caption]:mb-1',
				'[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted [&_th]:font-semibold [&_th]:text-left',
				'[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
				className
			)}
			// Safe: content is sanitized by DOMPurify with an explicit allow-list above, and
			// the style attribute is filtered to a color/formatting property allow-list.
			dangerouslySetInnerHTML={{ __html: safe }}
		/>
	);
};
