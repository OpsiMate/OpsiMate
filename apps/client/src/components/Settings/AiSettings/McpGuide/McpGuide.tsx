import { Button } from '@/components/ui/button';
import { CollapsibleGuide } from '../CollapsibleGuide';
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

// Connecting an AI assistant to the OpsiMate MCP server. Folded by default; /settings#mcp
// lands here.
export const McpGuide = () => (
	<CollapsibleGuide
		id="mcp"
		// A /settings#mcp link lands on this guide opened.
		defaultOpen={typeof window !== 'undefined' && window.location.hash === '#mcp'}
		icon={Bot}
		iconClassName="text-sky-500"
		title="AI assistants (MCP)"
		tagline="Let Claude Code, Claude Desktop, Cursor or VS Code read your alerts and dashboards — read-only, with each user's own token."
	>
		<Step number={1} title="Connect a client">
			<p className="text-xs text-muted-foreground flex items-start gap-1.5">
				<Container className="h-3.5 w-3.5 mt-0.5 shrink-0" />
				<span>
					The MCP server is its own container (<span className="font-mono">opsimate/mcp</span>), here assumed
					at <span className="font-mono">{DEFAULT_MCP_URL}</span>. Behind an Ingress or on another host,
					replace the URL.
				</span>
			</p>
			<p className="text-xs text-muted-foreground flex items-start gap-1.5">
				<KeyRound className="h-3.5 w-3.5 mt-0.5 shrink-0" />
				<span>
					Authenticate with the API token (<span className="font-mono">x-api-token</span>) or a user's login
					token (<span className="font-mono">Authorization: Bearer …</span>). It is forwarded as is — a Viewer
					stays a Viewer.
				</span>
			</p>
			<div className="space-y-4">
				<ClientSnippet
					heading="Claude Code"
					note="Set OPSIMATE_API_TOKEN in your shell first, so the token is never typed into the command."
					code={CLAUDE_CODE_EXAMPLE}
					copyLabel="Copy the Claude Code command"
				/>
				<ClientSnippet
					heading="Cursor, Windsurf, or a project's .mcp.json"
					note="Claude Code fills ${OPSIMATE_API_TOKEN} from your environment; Cursor and Windsurf need the token itself — keep it in the user-level file (~/.cursor/mcp.json), not in a repository."
					code={MCP_JSON_EXAMPLE}
					copyLabel="Copy the mcp.json entry"
				/>
				<ClientSnippet
					heading="VS Code"
					note=".vscode/mcp.json; ${env:OPSIMATE_API_TOKEN} is read from your environment."
					code={VSCODE_EXAMPLE}
					copyLabel="Copy the VS Code entry"
				/>
				<ClientSnippet
					heading="Claude Desktop (local process over stdio)"
					note={
						'The same image, started by the client with Docker; the token comes from env.' +
						(isLocalHost
							? ' Inside the container "localhost" is the container itself, hence host.docker.internal.'
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
					Seven read-only tools over the same API this UI uses, answering with the values you see here.
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
						Read-only by construction: no tool writes, the server holds no credentials of its own, and
						OpsiMate's permissions and logs apply. Dashboard time presets resolve at call time.
					</span>
				</li>
				<li className="flex items-start gap-1.5">
					<Container className="h-3.5 w-3.5 mt-0.5 shrink-0" />
					<span>
						240 requests a minute per caller, then 429 (
						<span className="font-mono">MCP_RATE_LIMIT_PER_MINUTE</span>; 0 = no limit). Not running the
						container turns the feature off.
					</span>
				</li>
			</ul>
		</Step>
	</CollapsibleGuide>
);
