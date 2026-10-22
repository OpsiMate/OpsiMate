import { useAppVersion } from '@/hooks/queries/version';
import { useBrowserDiagnostics } from '@/hooks/useBrowserDiagnostics';
import { buildAboutList, buildChecklist, ChecklistStatus, formatBrowserDiagnostics } from '@/lib/browserDiagnostics';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, ChevronRight, Info, Stethoscope, XCircle } from 'lucide-react';

// Profile page: what this browser can and cannot do, as a checklist a person reads
// (see lib/browserDiagnostics). When something on screen looks wrong on one machine,
// the person sends a screenshot — nothing to find or run. Collapsed by default: the
// header alone says "all good" or how many things are off, so it costs no attention when
// nothing is wrong. Opened, findings come first, then the checks, then the facts support
// asks for; the raw report is folded away at the bottom.
//
// Status colors are literal sRGB hex, not the Tailwind palette: the palette is oklch(),
// which is exactly what the browsers these findings are about cannot render — a red ✗
// drawn in oklch would be invisible on the machines that need it.
const STATUS_ICON: Record<ChecklistStatus, { Icon: typeof CheckCircle2; className: string; label: string }> = {
	ok: { Icon: CheckCircle2, className: 'text-[#047857] dark:text-[#6ee7b7]', label: 'OK' },
	problem: { Icon: XCircle, className: 'text-[#b91c1c] dark:text-[#fca5a5]', label: 'Problem' },
	info: { Icon: Info, className: 'text-[#6b7280] dark:text-[#9ca3af]', label: 'Info' },
};

const AMBER =
	'border-[#f59e0b] bg-[#fffbeb] text-[#92400e] dark:border-[#b45309] dark:bg-[#451a03] dark:text-[#fde68a]';
const GREEN =
	'border-[#6ee7b7] bg-[#ecfdf5] text-[#047857] dark:border-[#047857] dark:bg-[#022c22] dark:text-[#6ee7b7]';

export const BrowserDiagnosticsSection = () => {
	const info = useAppVersion();
	const diagnostics = useBrowserDiagnostics();
	const versions = {
		server: info.serverKnown ? info.version : null,
		commit: info.commit,
		client: info.clientVersion,
	};
	const checklist = buildChecklist(diagnostics);
	const about = buildAboutList(diagnostics, versions, window.location.origin);
	const report = formatBrowserDiagnostics(diagnostics, versions, window.location.origin);
	// Counted from the checklist, so the header agrees with the red rows below it (one
	// finding can cover two checks, as the "too old" one does for oklch and color-mix).
	const problems = checklist.filter((item) => item.status === 'problem').length;
	const verdict = problems > 0 ? `${problems} problem${problems > 1 ? 's' : ''} found` : 'All good';

	return (
		<details className="group/section border-t pt-6">
			<summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
				<Stethoscope className="h-5 w-5 text-muted-foreground" />
				<h3 className="font-semibold">Browser check</h3>
				<span className={cn('rounded-full border px-2 py-0.5 text-xs', problems > 0 ? AMBER : GREEN)}>
					{verdict}
				</span>
				<ChevronRight
					className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open/section:rotate-90"
					aria-hidden
				/>
			</summary>

			<div className="mt-4 space-y-4">
				<p className="text-sm text-muted-foreground">
					If colors, icons or hover effects look wrong on this computer, this page shows why. Send a
					screenshot of it to support.
				</p>

				{diagnostics.findings.length > 0 ? (
					<ul className="space-y-2" aria-label="Browser findings">
						{diagnostics.findings.map((finding) => (
							<li
								key={finding}
								className={cn('flex items-start gap-2 rounded-md border p-3 text-sm', AMBER)}
							>
								<AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
								<span>{finding}</span>
							</li>
						))}
					</ul>
				) : (
					<p className="flex items-center gap-2 text-sm text-[#047857] dark:text-[#6ee7b7]">
						<CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
						Everything this page depends on is supported by this browser.
					</p>
				)}

				<ul className="divide-y rounded-lg border" aria-label="Browser checks">
					{checklist.map((item) => {
						const { Icon, className, label } = STATUS_ICON[item.status];
						return (
							<li key={item.id} className="flex items-start gap-3 px-3 py-2">
								<Icon
									className={`h-4 w-4 mt-0.5 shrink-0 ${className}`}
									aria-label={label}
									role="img"
								/>
								<div className="min-w-0">
									<div className="text-sm font-medium text-foreground">{item.label}</div>
									<div className="text-xs text-muted-foreground">{item.detail}</div>
								</div>
							</li>
						);
					})}
				</ul>

				<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" aria-label="About this browser">
					{about.map((item) => (
						<div key={item.label} className="contents">
							<dt className="text-muted-foreground">{item.label}</dt>
							<dd className="text-foreground break-words">{item.value}</dd>
						</div>
					))}
				</dl>

				<details className="group text-xs">
					<summary className="flex cursor-pointer items-center gap-1 text-muted-foreground hover:text-foreground">
						<ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" aria-hidden />
						Technical details for support
					</summary>
					{/* role=region: aria-label is not permitted on a bare <pre>. */}
					<pre
						role="region"
						aria-label="Browser diagnostics report"
						className="mt-2 select-all whitespace-pre-wrap break-words rounded-lg border bg-muted p-3 font-mono text-foreground"
					>
						{report}
					</pre>
				</details>
			</div>
		</details>
	);
};
