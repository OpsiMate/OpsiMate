// A long summary never shrinks below this when the column is crowded (about five lines).
export const SUMMARY_MIN_HEIGHT_CLASS = 'min-h-32';

// One step up from the rest of the panel; headings, code and tables move up with it so they
// keep their size relative to the body text (FormattedText sets them in fixed sizes).
export const SUMMARY_TEXT_CLASS =
	'text-base text-foreground leading-relaxed [&_h1]:text-lg [&_h2]:text-lg [&_h3]:text-base [&_h4]:text-base [&_code]:text-sm [&_table]:text-sm [&_caption]:text-sm';
