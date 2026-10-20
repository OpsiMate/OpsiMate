import { McpGuide } from '@/components/Settings/AiSettings/McpGuide';
import { API_HOST } from '@/lib/api';
import { MCP_PATH, MCP_TOOLS } from '@OpsiMate/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

// Documentation rendered as UI: what matters is that every snippet points at THIS
// deployment's endpoint, and that the tools it lists are the ones the server registers
// (the server test checks the same list against the registered tools).
describe('McpGuide', () => {
	test("every connection snippet uses this deployment's MCP URL and the x-api-token header", () => {
		render(<McpGuide />);
		const url = `${API_HOST}${MCP_PATH}`;
		const snippets = [
			screen.getByText(/claude mcp add/),
			screen.getByText(/"headers": \{ "x-api-token"/),
			screen.getByText(/"mcp-remote"/),
		];
		for (const snippet of snippets) {
			expect(snippet.textContent).toContain(url);
			expect(snippet.textContent).toContain('x-api-token');
		}
		expect(screen.getByRole('link', { name: MCP_PATH })).toHaveAttribute('href', url);
	});

	test('lists every tool the server offers, by name, with copy buttons on the snippets', () => {
		render(<McpGuide />);
		const list = screen.getByRole('list', { name: 'MCP tools' });
		const names = within(list)
			.getAllByRole('listitem')
			.map((item) => item.querySelector('.font-mono')?.textContent);
		expect(names).toEqual(MCP_TOOLS.map((tool) => tool.name));
		expect(screen.getByRole('button', { name: 'Copy the Claude Code command' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Copy the mcp.json entry' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Copy the mcp-remote entry' })).toBeInTheDocument();
		expect(screen.getByText(/MCP_ENABLED=false/)).toBeInTheDocument();
		expect(screen.getByText(/MCP_RATE_LIMIT_PER_MINUTE/)).toBeInTheDocument();
	});
});
