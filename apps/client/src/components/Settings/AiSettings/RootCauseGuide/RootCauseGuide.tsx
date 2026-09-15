import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { API_HOST } from '@/lib/api';
import { Check, Copy, MessageSquareQuote, SearchCheck, ThumbsDown, ThumbsUp } from 'lucide-react';

const ROOT_CAUSE_ENDPOINT = `${API_HOST}/api/v1/alerts/{alertId}/root-cause?api_token={your_api_token}`;

const SEND_EXAMPLE = `curl -X PUT "${ROOT_CAUSE_ENDPOINT}" \\
  -H "content-type: application/json" \\
  -d '{
    "content": "Deploy 2481 rotated the connection pooler config; max_connections dropped from 400 to 40. Checkout pods exhausted the pool within 90s of the rollout. Rolling back the pooler config restores headroom.",
    "feedbackUpUrl": "https://your-analyzer.example/feedback/up?token=…",
    "feedbackDownUrl": "https://your-analyzer.example/feedback/down?token=…"
  }'`;

const CALLBACK_EXAMPLE = `POST https://your-analyzer.example/feedback/down?token=…
content-type: application/json

{
  "alertId": "gcp-alert-0-4136",
  "rating": "down",
  "ratedBy": "Dana Levi",
  "ratedAt": "2026-09-15T15:12:03.201Z",
  "comment": "It blamed the pool, but the pool was fine — the real cause was DNS."
}`;

interface StepProps {
	number: number;
	title: string;
	children: React.ReactNode;
}

const Step = ({ number, title, children }: StepProps) => (
	<div className="space-y-2">
		<h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
			<span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 text-xs font-bold">
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
			<pre className="bg-muted p-3 pr-12 rounded-lg text-xs font-mono overflow-x-auto border whitespace-pre">
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

// A static replica of the drawer's Root cause section, so the reader knows what the
// pushed analysis looks like before sending one. Deliberately markup only — the real
// section needs an alert and a query behind it.
const SectionPreview = () => (
	<div className="rounded-lg border border-violet-400/70 bg-violet-50/50 dark:bg-violet-950/20 ring-1 ring-violet-400/30 p-3 space-y-2 max-w-md">
		<div className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
			<SearchCheck className="h-3.5 w-3.5" />
			Root cause
		</div>
		<p className="text-sm text-foreground">
			Deploy 2481 rotated the connection pooler config; max_connections dropped from 400 to 40. Checkout pods
			exhausted the pool within 90s of the rollout. Rolling back the pooler config restores headroom.
		</p>
		<p className="flex items-start gap-1.5 text-xs text-muted-foreground italic">
			<MessageSquareQuote className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
			<span>It blamed the pool, but the pool was fine — the real cause was DNS.</span>
		</p>
		<div className="flex items-center justify-between gap-2 border-t border-violet-400/30 pt-2">
			<span className="text-xs text-violet-600/80 dark:text-violet-400/80">via API · just now</span>
			<div className="flex items-center gap-1">
				<span className="text-xs text-muted-foreground mr-1">rated by Dana Levi just now</span>
				<ThumbsUp className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
				<ThumbsDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400 fill-current" aria-hidden="true" />
			</div>
		</div>
	</div>
);

// "Bring your own" root cause, explained where people go looking for AI features:
// what to send, what operators see, how they rate, and what your system gets back.
export const RootCauseGuide = () => (
	<div className="space-y-4">
		<div>
			<h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
				<SearchCheck className="h-5 w-5 text-violet-500" />
				Root cause analysis — bring your own
			</h2>
			<p className="text-sm text-muted-foreground">
				Already have an analyzer (an AI agent, a runbook engine, a script)? Push its conclusion onto any alert.
				Operators see it in the alert drawer, rate it with 👍/👎, and their verdict is sent straight back to
				you.
			</p>
		</div>

		<Card className="p-4 space-y-5">
			<Step number={1} title="Send the analysis">
				<p className="text-xs text-muted-foreground">
					One <span className="font-mono">PUT</span> per alert, authenticated with your API token. Only{' '}
					<span className="font-mono">content</span> is required (up to 65,536 characters). The two feedback
					URLs are optional; they may embed a secret — they are stored server-side and never shown in the UI.
					Pushing again replaces the analysis and clears its rating.
				</p>
				<CodeBlock code={SEND_EXAMPLE} copyLabel="Copy the send example" />
			</Step>

			<Step number={2} title="What operators see">
				<p className="text-xs text-muted-foreground">
					A <span className="font-semibold text-violet-600 dark:text-violet-400">Root cause</span> section
					appears in that alert's drawer, loaded on open. This one has already been rated 👎 with a note:
				</p>
				<SectionPreview />
			</Step>

			<Step number={3} title="How they rate, and what you get back">
				<ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
					<li>
						<ThumbsUp className="inline h-3 w-3 mr-1 align-[-1px]" aria-hidden="true" />
						<strong>Helpful</strong> is one click. We <span className="font-mono">POST</span> to your{' '}
						<span className="font-mono">feedbackUpUrl</span>.
					</li>
					<li>
						<ThumbsDown className="inline h-3 w-3 mr-1 align-[-1px]" aria-hidden="true" />
						<strong>Unhelpful</strong> first asks <em>"What went wrong?"</em> — an optional note the
						operator can skip. We <span className="font-mono">POST</span> to your{' '}
						<span className="font-mono">feedbackDownUrl</span> with the note as{' '}
						<span className="font-mono">comment</span> (<span className="font-mono">null</span> when skipped
						or on 👍).
					</li>
					<li>
						The verdict is stored first; delivery is best-effort with a 3-second timeout, no redirects, and
						no headers from us — put any token you need in the URL.
					</li>
				</ul>
				<CodeBlock code={CALLBACK_EXAMPLE} copyLabel="Copy the callback example" />
			</Step>
		</Card>
	</div>
);
