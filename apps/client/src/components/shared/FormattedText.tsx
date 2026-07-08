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
	],
	ALLOWED_ATTR: ['href', 'target', 'rel'],
};

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
// subset of HTML (bold, links, lists, ...) is rendered after sanitization.
export const FormattedText = ({ text, className }: FormattedTextProps) => {
	if (!containsHtml(text)) {
		// overflow-wrap:anywhere (not just break-words) so a single very long token with no
		// spaces — e.g. an asset id — wraps instead of overflowing the panel width.
		return <div className={cn('whitespace-pre-line [overflow-wrap:anywhere]', className)}>{text}</div>;
	}
	const safe = DOMPurify.sanitize(text, SANITIZE_CONFIG);
	return (
		<div
			className={cn(
				'whitespace-pre-line [overflow-wrap:anywhere]',
				'[&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5',
				'[&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs',
				'[&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_h4]:text-sm [&_h4]:font-semibold',
				className
			)}
			// Safe: content is sanitized by DOMPurify with an explicit allow-list just above.
			dangerouslySetInnerHTML={{ __html: safe }}
		/>
	);
};
