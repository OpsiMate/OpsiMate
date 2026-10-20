import { cn } from '@/lib/utils';

// Flag emoji are two "regional indicator" characters (🇮🇱 = U+1F1EE U+1F1F1) that the
// font turns into a flag — on macOS, iOS and Android. Windows' emoji font ships no
// country flags, so there the pair renders as two boxed letters. Any text that may carry
// a flag (tag values set by enrichments, facet labels, group headers) goes through this
// component, which draws the flag itself from a bundled SVG so every OS shows the same
// thing. Text without flags is returned untouched.

const REGIONAL_INDICATOR_A = 0x1f1e6;
const FLAG_PAIR = /\p{Regional_Indicator}{2}/gu;
// The same test without the global flag (a global regex keeps lastIndex between calls),
// shared so the hot path — every tag cell — allocates nothing.
const HAS_FLAG_PAIR = /\p{Regional_Indicator}{2}/u;

// Vite emits one asset per flag (?no-inline: never a data URI in the bundle, which would
// add ~400 KB for flags most pages never show) and this module holds only their URLs; a
// flag's SVG is fetched the first time it is shown. The node_modules path is relative to
// this file so the glob survives pnpm's symlinked layout.
const FLAG_URLS = import.meta.glob<string>('../../../../node_modules/country-flag-icons/3x2/*.svg', {
	query: '?no-inline',
	import: 'default',
	eager: true,
});

const flagUrlByCode = new Map<string, string>();
for (const [path, url] of Object.entries(FLAG_URLS)) {
	const code = path.match(/\/([A-Z]{2})\.svg$/)?.[1];
	if (code) flagUrlByCode.set(code, url);
}

// The ISO 3166-1 alpha-2 code a regional-indicator pair spells: 🇮🇱 -> "IL".
export const flagEmojiToCode = (emoji: string): string =>
	[...emoji].map((char) => String.fromCharCode((char.codePointAt(0) ?? 0) - REGIONAL_INDICATOR_A + 65)).join('');

export const flagUrlFor = (code: string): string | undefined => flagUrlByCode.get(code.toUpperCase());

export type TextSegment = { type: 'text'; text: string } | { type: 'flag'; emoji: string; code: string };

// Split text into plain runs and flag pairs, in order. "IL 🇮🇱" -> [text "IL ", flag IL].
export const splitFlags = (text: string): TextSegment[] => {
	const segments: TextSegment[] = [];
	let last = 0;
	for (const match of text.matchAll(FLAG_PAIR)) {
		const index = match.index ?? 0;
		if (index > last) segments.push({ type: 'text', text: text.slice(last, index) });
		segments.push({ type: 'flag', emoji: match[0], code: flagEmojiToCode(match[0]) });
		last = index + match[0].length;
	}
	if (last < text.length) segments.push({ type: 'text', text: text.slice(last) });
	return segments;
};

export const containsFlag = (text: string): boolean => HAS_FLAG_PAIR.test(text);

interface TextWithFlagsProps {
	text: string;
	className?: string;
}

// The text with every flag emoji drawn as an inline SVG the height of the surrounding
// text. Flags are 3:2, so the width is fixed too: the cell does not shift when a flag
// seen for the first time finishes loading. A pair with no flag for it (an unassigned
// code) stays as the emoji.
export const TextWithFlags = ({ text, className }: TextWithFlagsProps) => {
	if (!containsFlag(text)) return <>{text}</>;
	return (
		<>
			{splitFlags(text).map((segment, index) => {
				if (segment.type === 'text') return <span key={index}>{segment.text}</span>;
				const url = flagUrlFor(segment.code);
				if (!url) return <span key={index}>{segment.emoji}</span>;
				return (
					<img
						key={index}
						src={url}
						alt={segment.emoji}
						title={segment.code}
						className={cn('inline-block h-[1em] w-[1.5em] align-[-0.125em] rounded-[1px]', className)}
						draggable={false}
					/>
				);
			})}
		</>
	);
};
