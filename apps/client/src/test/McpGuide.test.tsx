import { DEFAULT_MCP_URL, McpGuide } from '@/components/Settings/AiSettings/McpGuide/McpGuide';
import { MCP_DEFAULT_PORT, MCP_PATH, MCP_TOOLS } from '@OpsiMate/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

// Documentation rendered as UI: every HTTP snippet points at the MCP container on this
// host (the compose default), the stdio snippet keeps the token out of the command line,
// and the tools listed are the ones the server registers (the MCP package's test checks
// the same shared list against what is served).
describe('McpGuide', () => {
	test('HTTP snippets use the compose-default MCP URL for this host with the x-api-token header', () => {
		render(<McpGuide />);
		expect(DEFAULT_MCP_URL).toBe(`http://localhost:${MCP_DEFAULT_PORT}${MCP_PATH}`);
		const httpSnippets = [
			screen.getByText(/claude mcp add/),
			...screen.getAllByText(/"headers": \{ "x-api-token"/),
		];
		expect(httpSnippets).toHaveLength(3);
		for (const snippet of httpSnippets) {
			expect(snippet.textContent).toContain(DEFAULT_MCP_URL);
			expect(snippet.textContent).toContain('x-api-token');
		}
		const [mcpJson, vscode] = screen.getAllByText(/"headers": \{ "x-api-token"/).map((el) => el.textContent ?? '');
		expect(mcpJson).toContain('"mcpServers"');
		expect(mcpJson).toContain('"type": "http"');
		expect(vscode).toContain('"servers"');
	});

	test('the stdio snippet runs the image with the token in env, never in args, and reaches OpsiMate from the container', () => {
		render(<McpGuide />);
		const stdio = screen.getByText(/"--stdio"/).textContent ?? '';
		expect(stdio).toContain('"command": "docker"');
		expect(stdio).toContain('"-e", "OPSIMATE_API_TOKEN",');
		expect(stdio).toContain('"opsimate/mcp",');
		expect(stdio).toContain('"env": { "OPSIMATE_API_TOKEN": "{your_api_token}" }');
		expect(stdio).not.toMatch(/OPSIMATE_API_TOKEN=\{/);
		// jsdom runs on localhost: inside a container that is the container itself.
		expect(stdio).toContain('"--url", "http://host.docker.internal:3001"');
		// Linux Docker Engine resolves host.docker.internal only with this mapping.
		expect(stdio).toContain('"--add-host=host.docker.internal:host-gateway"');
	});

	test('lists every tool the server offers, by name, with copy buttons on the snippets', () => {
		render(<McpGuide />);
		const list = screen.getByRole('list', { name: 'MCP tools' });
		const names = within(list)
			.getAllByRole('listitem')
			.map((item) => item.querySelector('.font-mono')?.textContent);
		expect(names).toEqual(MCP_TOOLS.map((tool) => tool.name));
		for (const label of [
			'Copy the Claude Code command',
			'Copy the mcp.json entry',
			'Copy the VS Code entry',
			'Copy the Claude Desktop entry',
		]) {
			expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
		}
		expect(screen.getByText(/MCP_RATE_LIMIT_PER_MINUTE/)).toBeInTheDocument();
	});
});
