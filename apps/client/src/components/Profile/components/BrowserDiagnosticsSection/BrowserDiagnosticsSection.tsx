import { useAppVersion } from '@/hooks/queries/version';
import { useBrowserDiagnostics } from '@/hooks/useBrowserDiagnostics';
import { formatBrowserDiagnostics } from '@/lib/browserDiagnostics';
import { AlertTriangle, CheckCircle2, Stethoscope } from 'lucide-react';

// Profile page: what this browser can and cannot do, printed in full (see
// lib/browserDiagnostics). When something on screen looks wrong on one machine, the
// person sends a screenshot or selects the block — no copy button to find, nothing to
// run. Findings come first, in plain language; the raw block follows for support.
//
// The findings are styled with literal sRGB colors (hex), not the Tailwind palette: the
// palette is oklch(), which is exactly what the browsers these findings are about cannot
// render — the warning would be invisible on the machines that need it.
export const BrowserDiagnosticsSection = () => {
	const info = useAppVersion();
	const diagnostics = useBrowserDiagnostics();
	const text = formatBrowserDiagnostics(
		diagnostics,
		{ server: info.serverKnown ? info.version : null, commit: info.commit, client: info.clientVersion },
		window.location.origin
	);

	return (
		<div className="space-y-4 border-t pt-6">
			<div className="flex items-center gap-3">
				<Stethoscope className="h-5 w-5 text-muted-foreground" />
				<h3 className="font-semibold">Browser diagnostics</h3>
			</div>
			<p className="text-sm text-muted-foreground">
				If colors, icons or hover effects look wrong on this machine, this is what support needs. The findings
				say what this browser will show differently; the block below is the full report.
			</p>
			{diagnostics.findings.length > 0 ? (
				<ul className="space-y-2" aria-label="Browser findings">
					{diagnostics.findings.map((finding) => (
						<li
							key={finding}
							className="flex items-start gap-2 rounded-md border border-[#f59e0b] bg-[#fffbeb] p-3 text-sm text-[#92400e] dark:border-[#b45309] dark:bg-[#451a03] dark:text-[#fde68a]"
						>
							<AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
							<span>{finding}</span>
						</li>
					))}
				</ul>
			) : (
				<p className="flex items-center gap-2 text-sm text-[#047857] dark:text-[#6ee7b7]">
					<CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
					No known rendering issue detected in this browser.
				</p>
			)}
			<pre
				aria-label="Browser diagnostics report"
				className="select-all whitespace-pre-wrap break-words rounded-lg border bg-muted p-3 text-xs font-mono text-foreground"
			>
				{text}
			</pre>
		</div>
	);
};
