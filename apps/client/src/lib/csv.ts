// Shared CSV + file-download helpers for every client-side export (alert history,
// the alerts list).

// Spreadsheets execute cells that begin with a formula trigger even when the field is
// properly quoted — and exported fields carry user-typed text (names, comments, alert
// summaries from external sources), so a value like "=HYPERLINK(...)" would become a
// live formula in an exported file. The standard neutralization is a leading
// apostrophe, which spreadsheets read as "literal text". Applied to EVERY field:
// benign fields never start with a trigger, so the guard is invisible where it isn't needed.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const neutralizeFormula = (value: string): string => (FORMULA_TRIGGER.test(value) ? `'${value}` : value);

// RFC 4180: quote every field, double any quotes inside, and normalize embedded line
// breaks to CRLF so a multi-line value stays one record for strict parsers.
export const csvField = (value: string): string =>
	`"${neutralizeFormula(value)
		.replace(/\r\n|\r|\n/g, '\r\n')
		.replace(/"/g, '""')}"`;

// CRLF record separator per RFC 4180 (embedded breaks are normalized to CRLF too, but
// stay inside their quotes).
export const toCsv = (header: string[], rows: string[][]): string =>
	[header, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n');

// "2026-11-19-14-05-09" — sortable and safe in a filename on every OS.
export const fileTimestamp = (date: Date = new Date()): string => date.toISOString().slice(0, 19).replace(/[T:]/g, '-');

export const downloadFile = (filename: string, mimeType: string, content: string): void => {
	const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
};
