import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { API_HOST } from '@/lib/api';
import { MCP_PATH, MCP_TOOLS } from '@OpsiMate/shared';
import { Bot, Check, Copy, Eye, KeyRound, Plug, Wrench } from 'lucide-react';

const MCP_URL = `${API_HOST}${MCP_PATH}`;

const CLAUDE_CODE_EXAMPLE = `claude mcp add --transport http opsimate ${MCP_URL} \\
  --header "x-api-token: {your_api_token}"`;

// Cursor, Windsurf, VS Code and most other clients read this shape (file name varies:
// .cursor/mcp.json, mcp.json, settings.json → "mcp.servers").
const MCP_JSON_EXAMPLE = `{
  "mcpServers": {
    "opsimate": {
      "url": "${MCP_URL}",
      "headers": { "x-api-token": "{your_api_token}" }
    }
  }
}`;

// Clients whose config only starts a local process (Claude Desktop's claude_desktop_config.json)
// reach a remote HTTP server through the mcp-remote bridge.
const MCP_REMOTE_EXAMPLE = `{
  "mcpServers": {
    "opsimate": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${MCP_URL}", "--header", "x-api-token:{your_api_token}"]
    }
  }
}`;

const EXAMPLE_PROMPTS = [
	'Which dashboards do we have, and what does "Prod Critical" show?',
	'What is firing in Prod Critical right now? Group it by service.',
	'Show alert gcp-alert-0-4136 with its comments and root cause.',
	'Which alerts re-fired most this week, and what was the MTTR?',
	'List every Critical alert owned by Dana that is not silenced.',
];

interface StepProps {
	number: number;
	title: string;
	children: React.ReactNode;
}

const Step = ({ number, title, children }: StepProps) => (
	<div className="space-y-2">
		<h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
			<span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 text-xs font-bold">
				{number}
			</span>
			{title}
		</h3>
		{children}
	</div>
);

interface CodeBlockProps {
	code: string;
	copyLabel: string;
}

const CodeBlock = ({ code, copyLabel }: CodeBlockProps) => {
	const { copied, copy } = useCopyToClipboard();
	return (
		<div className="relative">
			<pre className="bg-muted p-3 pr-12 rounded-lg text-xs font-mono border whitespace-pre-wrap break-all">
				{code}
			</pre>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="absolute top-1.5 right-1.5 h-7 w-7"
				aria-label={copyLabel}
				onClick={() =>
					void copy(code, {
						successDescription: 'Copied to clipboard',
						failureDescription: 'Please copy manually',
					})
				}
			>
				{copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
			</Button>
		</div>
	);
};

interface ClientSnippetProps {
	heading: string;
	note: string;
	code: string;
	copyLabel: string;
}

const ClientSnippet = ({ heading, note, code, copyLabel }: ClientSnippetProps) => (
	<div className="space-y-1.5">
		<p className="text-xs text-foreground font-medium">{heading}</p>
		<p className="text-xs text-muted-foreground">{note}</p>
		<CodeBlock code={code} copyLabel={copyLabel} />
	</div>
);

// Connecting an AI assistant to this deployment's MCP endpoint, explained next to the
// other AI features: where it is, how it authenticates, what it can answer, what it
// can never do (write).
export const McpGuide = () => (
	<div className="space-y-4 min-w-0 max-w-4xl">
		<div>
			<h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
				<Bot className="h-5 w-5 text-sky-500" />
				AI assistants (MCP)
			</h2>
			<p className="text-sm text-muted-foreground">
				Claude Code, Claude Desktop, Cursor and any other MCP client can read your alerts and dashboards through
				this server's{' '}
				<a className="font-mono underline underline-offset-2" href={MCP_URL} target="_blank" rel="noreferrer">
					{MCP_PATH}
				</a>{' '}
				endpoint — the same data, filters and permissions as this UI. Everything it offers is read-only: an
				assistant can answer questions, never silence, resolve or change anything.
			</p>
		</div>

		<Card className="p-4 space-y-5">
			<Step number={1} title="Connect a client">
				<p className="text-xs text-muted-foreground flex items-start gap-1.5">
					<KeyRound className="h-3.5 w-3.5 mt-0.5 shrink-0" />
					<span>
						Authenticate with the server's API token (<span className="font-mono">x-api-token</span>, the
						<span className="font-mono"> security.api_token</span> of the server configuration) or with a
						user's login token (<span className="font-mono">Authorization: Bearer …</span>). Any role works,
						Viewers included, because no tool writes.
					</span>
				</p>
				<div className="space-y-4">
					<ClientSnippet
						heading="Claude Code"
						note="One command; the token is kept in Claude Code's own settings."
						code={CLAUDE_CODE_EXAMPLE}
						copyLabel="Copy the Claude Code command"
					/>
					<ClientSnippet
						heading="Cursor, Windsurf, VS Code and other clients with an mcp.json"
						note="Streamable HTTP with a header. The file name differs per client (.cursor/mcp.json, mcp.json, or the editor's settings)."
						code={MCP_JSON_EXAMPLE}
						copyLabel="Copy the mcp.json entry"
					/>
					<ClientSnippet
						heading="Claude Desktop and other clients that only start a local process"
						note="The mcp-remote bridge turns the local stdio connection into HTTP requests to this server."
						code={MCP_REMOTE_EXAMPLE}
						copyLabel="Copy the mcp-remote entry"
					/>
				</div>
			</Step>

			<Step number={2} title="What the assistant can do">
				<p className="text-xs text-muted-foreground flex items-start gap-1.5">
					<Wrench className="h-3.5 w-3.5 mt-0.5 shrink-0" />
					<span>
						Seven tools, each a read of the same business logic the REST API serves. Results use the display
						values you see here (<span className="font-mono">Firing</span>,{' '}
						<span className="font-mono">Critical</span>, owner names), so what the assistant quotes pastes
						straight back into a filter.
					</span>
				</p>
				<ul className="space-y-1.5" aria-label="MCP tools">
					{MCP_TOOLS.map((tool) => (
						<li key={tool.name} className="text-xs flex flex-wrap items-baseline gap-x-2">
							<span className="font-mono text-foreground">{tool.name}</span>
							<span className="text-muted-foreground">{tool.summary}</span>
						</li>
					))}
				</ul>
				<p className="text-xs text-muted-foreground pt-1">Things people ask:</p>
				<ul className="space-y-1" aria-label="Example prompts">
					{EXAMPLE_PROMPTS.map((prompt) => (
						<li key={prompt} className="text-xs text-foreground italic">
							“{prompt}”
						</li>
					))}
				</ul>
			</Step>

			<Step number={3} title="Good to know">
				<ul className="space-y-1.5 text-xs text-muted-foreground">
					<li className="flex items-start gap-1.5">
						<Eye className="h-3.5 w-3.5 mt-0.5 shrink-0" />
						<span>
							Read-only by construction: the endpoint registers no tool that writes, and it uses the
							read-only authentication guard. A dashboard's time preset (
							<span className="font-mono">last24h</span>, <span className="font-mono">today</span>) is
							resolved on the server, so an assistant sees the same alerts the dashboard shows.
						</span>
					</li>
					<li className="flex items-start gap-1.5">
						<Plug className="h-3.5 w-3.5 mt-0.5 shrink-0" />
						<span>
							Stateless Streamable HTTP: no sessions to store, works behind any load balancer. Set{' '}
							<span className="font-mono">MCP_ENABLED=false</span> on the server to remove the endpoint.
						</span>
					</li>
				</ul>
			</Step>
		</Card>
	</div>
);
