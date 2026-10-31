import { describe, expect, test } from 'vitest';
import userEvent from '@testing-library/user-event';
import { McpGuide } from '@/components/Settings/AiSettings/McpGuide';
import { RootCauseGuide } from '@/components/Settings/AiSettings/RootCauseGuide';
import { render, screen } from './test-utils';

// The AI tab's how-to guides are folded by default: a title and one line each, the body
// on demand. A /settings#mcp link opens the MCP one.
describe('AI guides', () => {
	test('both guides start folded with a one-line tagline, and open on click', async () => {
		const user = userEvent.setup();
		render(
			<>
				<RootCauseGuide />
				<McpGuide />
			</>
		);
		const rootCause = screen.getByText('Root cause analysis — bring your own').closest('details');
		const mcp = screen.getByText('AI assistants (MCP)').closest('details');
		expect(rootCause).not.toHaveAttribute('open');
		expect(mcp).not.toHaveAttribute('open');
		expect(mcp).toHaveAttribute('id', 'mcp');
		expect(screen.getByText(/Push your analyzer's conclusion/)).toBeInTheDocument();

		await user.click(screen.getByText('AI assistants (MCP)'));
		expect(mcp).toHaveAttribute('open');
		expect(rootCause).not.toHaveAttribute('open');
	});

	test('the MCP guide opens when the page is reached by its anchor', () => {
		window.location.hash = '#mcp';
		try {
			render(<McpGuide />);
			expect(screen.getByText('AI assistants (MCP)').closest('details')).toHaveAttribute('open');
		} finally {
			window.location.hash = '';
		}
	});
});
