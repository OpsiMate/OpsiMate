import { useAppVersion } from '@/hooks/queries/version';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { collectBrowserDiagnostics, formatBrowserDiagnostics } from '@/lib/browserDiagnostics';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@radix-ui/react-tooltip';
import { Check, Stethoscope } from 'lucide-react';

interface BrowserDiagnosticsButtonProps {
	className?: string;
}

// Sidebar footer, next to the version: one click copies what the browser can and cannot
// do (see lib/browserDiagnostics) for a support request. The tooltip already says whether
// something is off, so a user can tell without pasting anything.
export const BrowserDiagnosticsButton = ({ className }: BrowserDiagnosticsButtonProps) => {
	const info = useAppVersion();
	const { copied, copy } = useCopyToClipboard();
	const diagnostics = collectBrowserDiagnostics();
	const hasFindings = diagnostics.findings.length > 0;

	const copyDiagnostics = () =>
		void copy(
			formatBrowserDiagnostics(
				diagnostics,
				{ server: info.version, commit: info.commit, client: info.clientVersion },
				window.location.origin
			),
			{
				successDescription: 'Browser diagnostics copied — paste them into your support request.',
				failureDescription: 'Could not copy; open the browser console and run the diagnostics by hand.',
			}
		);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					onClick={copyDiagnostics}
					aria-label="Copy browser diagnostics"
					className={cn(
						'inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors',
						hasFindings && 'text-amber-600 dark:text-amber-400',
						className
					)}
				>
					{copied ? (
						<Check className="h-3.5 w-3.5 text-emerald-500" />
					) : (
						<Stethoscope className="h-3.5 w-3.5" />
					)}
				</button>
			</TooltipTrigger>
			<TooltipContent
				side="top"
				align="center"
				className="max-w-xs rounded-md bg-popover text-popover-foreground px-2 py-1 text-xs border"
			>
				{hasFindings
					? `Copy browser diagnostics — ${diagnostics.findings.length} thing${diagnostics.findings.length > 1 ? 's' : ''} this browser will show differently`
					: 'Copy browser diagnostics (version, browser, what it supports) for a support request'}
			</TooltipContent>
		</Tooltip>
	);
};
