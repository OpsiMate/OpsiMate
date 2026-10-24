import { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/server';

// Every tool here only reads; the hints let a client skip its "may I run this?" prompt.
export const READ_ONLY_ANNOTATIONS: ToolAnnotations = {
	readOnlyHint: true,
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: false,
};

// A successful result carries the same JSON twice: `structuredContent` for clients that
// read the output schema, and a text block for the (many) clients that only show text.
export const toolResult = (structured: Record<string, unknown>): CallToolResult => ({
	content: [{ type: 'text', text: JSON.stringify(structured) }],
	structuredContent: structured,
});

// A problem the caller can fix (unknown id, bad filter value...) is a tool error the
// assistant reads and acts on — never a thrown error, which would surface as a protocol
// failure with no guidance in it.
export const toolError = (message: string): CallToolResult => ({
	content: [{ type: 'text', text: message }],
	isError: true,
});
