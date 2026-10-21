import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { API_HOST } from '@/lib/api';
import { MCP_DEFAULT_PORT, MCP_PATH, MCP_TOOLS } from '@OpsiMate/shared';
import { Bot, Check, Container, Copy, Eye, KeyRound, Wrench } from 'lucide-react';

// The MCP server is its own container, published on :3100 of the same host as the UI by
// docker-compose. The page cannot know where an Ingress or another host put it, so the
// URL is the compose default and the text says to adjust it.
const { protocol, hostname } = window.location;
export const DEFAULT_MCP_URL = `${protocol}//${hostname}:${MCP_DEFAULT_PORT}${MCP_PATH}`;

// Where a process in a container on this machine reaches OpsiMate: "localhost" there is
// the container itself. Docker Desktop resolves host.docker.internal by itself; Docker
// Engine on Linux only with the --add-host mapping in the snippet (harmless elsewhere).
const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(hostname);
const OPSIMATE_URL_FOR_CONTAINER = isLocalHost ? 'http://host.docker.internal:3001' : API_HOST;

// The token comes from the shell's environment, so it is not typed into the command (and
// into shell history); setting OPSIMATE_API_TOKEN is the user's own secrets step.
const CLAUDE_CODE_EXAMPLE = `claude mcp add --transport http opsimate ${DEFAULT_MCP_URL} \\
  --header "x-api-token: $OPSIMATE_API_TOKEN"`;

// The "mcpServers" shape: Cursor (.cursor/mcp.json), Windsurf, and a project's .mcp.json read
// by Claude Code. "type": "http" names the transport for the clients that need it. Claude
// Code expands ${OPSIMATE_API_TOKEN} from the environment, so a committed .mcp.json carries
// no secret; clients without expansion take the literal token in a file kept out of git.
const MCP_JSON_EXAMPLE = `{
  "mcpServers": {
    "opsimate": {
      "type": "http",
      "url": "${DEFAULT_MCP_URL}",
      "headers": { "x-api-token": "\${OPSIMATE_API_TOKEN}" }
    }
  }
}`;

// VS Code keeps its own shape: a top-level "servers" object, in .vscode/mcp.json, and reads
// environment variables with its own ${env:...} syntax.
const VSCODE_EXAMPLE = `{
  "servers": {
    "opsimate": {
      "type": "http",
      "url": "${DEFAULT_MCP_URL}",
      "headers": { "x-api-token": "\${env:OPSIMATE_API_TOKEN}" }
    }
  }
}`;

// Clients whose config only starts a local process (Claude Desktop's claude_desktop_config.json)
// run the same image over stdio. "-e OPSIMATE_API_TOKEN" with no value copies the variable
// from the client's environment ("env" below), so the token is never on a command line,
// where other users of the machine could read it.
const STDIO_EXAMPLE = `{
  "mcpServers": {
    "opsimate": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "OPSIMATE_API_TOKEN",
               "--add-host=host.docker.internal:host-gateway", "opsimate/mcp",
               "node", "apps/mcp/dist/cli.js", "--stdio", "--url", "${OPSIMATE_URL_FOR_CONTAINER}"],
      "env": { "OPSIMATE_API_TOKEN": "{your_api_token}" }
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

// Connecting an AI assistant to the OpsiMate MCP server, explained next to the other AI
// features: where it runs, how it authenticates, what it can answer, what it never does.
export const McpGuide = () => (
	<div className="space-y-4 min-w-0 max-w-4xl">
		<div>
			<h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
				<Bot className="h-5 w-5 text-sky-500" />
				AI assistants (MCP)
			</h2>
			<p className="text-sm text-muted-foreground">
				Claude Code, Claude Desktop, Cursor and any other MCP client can read your alerts and dashboards through
				the OpsiMate MCP server — a separate container (<span className="font-mono">opsimate/mcp</span>, the{' '}
				<span className="font-mono">mcp</span> service in docker-compose) that reads from this server's API with
				each caller's own token. Everything it offers is read-only: an assistant can answer questions, never
				silence, resolve or change anything.
			</p>
		</div>

		<Card className="p-4 space-y-5">
			<Step number={1} title="Connect a client">
				<p className="text-xs text-muted-foreground flex items-start gap-1.5">
					<Container className="h-3.5 w-3.5 mt-0.5 shrink-0" />
					<span>
						The snippets assume the compose default: the MCP container on port{' '}
						<span className="font-mono">{MCP_DEFAULT_PORT}</span> of this host, at{' '}
						<span className="font-mono">{DEFAULT_MCP_URL}</span>. Behind an Ingress or on another host,
						replace the URL.
					</span>
				</p>
				<p className="text-xs text-muted-foreground flex items-start gap-1.5">
					<KeyRound className="h-3.5 w-3.5 mt-0.5 shrink-0" />
					<span>
						Authenticate with the API token (<span className="font-mono">x-api-token</span>, the
						<span className="font-mono"> security.api_token</span> of the server configuration) or with a
						user's login token (<span className="font-mono">Authorization: Bearer …</span>). The MCP server
						forwards it to OpsiMate as is: any role works, Viewers included, and a Viewer stays a Viewer.
					</span>
				</p>
				<div className="space-y-4">
					<ClientSnippet
						heading="Claude Code"
						note="One command. Set OPSIMATE_API_TOKEN in your shell first (your secrets manager, or ~/.zshrc) so the token is not typed into the command or saved in shell history; Claude Code then keeps it in its own settings."
						code={CLAUDE_CODE_EXAMPLE}
						copyLabel="Copy the Claude Code command"
					/>
					<ClientSnippet
						heading="Cursor, Windsurf, and a project's .mcp.json (Claude Code)"
						note="The mcpServers shape: .cursor/mcp.json for Cursor, Windsurf's mcp_config.json, or a .mcp.json at a repository root that Claude Code picks up. Claude Code fills ${OPSIMATE_API_TOKEN} from your environment, so the file can be committed; Cursor and Windsurf need the token itself there — use the user-level file (~/.cursor/mcp.json), not one inside a repository."
						code={MCP_JSON_EXAMPLE}
						copyLabel="Copy the mcp.json entry"
					/>
					<ClientSnippet
						heading="VS Code"
						note="VS Code uses a top-level servers object: put this in .vscode/mcp.json (or the user profile's mcp.json). ${env:OPSIMATE_API_TOKEN} is read from your environment, so no token lands in the file."
						code={VSCODE_EXAMPLE}
						copyLabel="Copy the VS Code entry"
					/>
					<ClientSnippet
						heading="Claude Desktop and other clients that only start a local process"
						note={
							'The same image over stdio, started by the client with Docker. The token is read from the environment (env), never put on the command line.' +
							(isLocalHost
								? ' From inside the container, "localhost" is the container itself, so the OpsiMate URL uses host.docker.internal.'
								: '')
						}
						code={STDIO_EXAMPLE}
						copyLabel="Copy the Claude Desktop entry"
					/>
				</div>
			</Step>

			<Step number={2} title="What the assistant can do">
				<p className="text-xs text-muted-foreground flex items-start gap-1.5">
					<Wrench className="h-3.5 w-3.5 mt-0.5 shrink-0" />
					<span>
						Seven tools, each a read of the same API this UI uses. Results use the display values you see
						here (<span className="font-mono">Firing</span>, <span className="font-mono">Critical</span>,
						owner names), so what the assistant quotes pastes straight back into a filter.
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
							Read-only by construction: the server registers no tool that writes, holds no credentials of
							its own, and forwards each caller's token, so OpsiMate's permissions and logs apply. A
							dashboard's time preset (<span className="font-mono">last24h</span>,{' '}
							<span className="font-mono">today</span>) is resolved at call time, so an assistant sees the
							same alerts the dashboard shows.
						</span>
					</li>
					<li className="flex items-start gap-1.5">
						<Container className="h-3.5 w-3.5 mt-0.5 shrink-0" />
						<span>
							Stateless Streamable HTTP, scaled and deployed on its own (compose service{' '}
							<span className="font-mono">mcp</span>, Helm <span className="font-mono">mcp.enabled</span>
							). Each caller gets 240 requests a minute, then 429 until the minute is over —{' '}
							<span className="font-mono">MCP_RATE_LIMIT_PER_MINUTE</span> on the container changes it (0
							= no limit). Not running the container is how you turn the feature off.
						</span>
					</li>
				</ul>
			</Step>
		</Card>
	</div>
);
