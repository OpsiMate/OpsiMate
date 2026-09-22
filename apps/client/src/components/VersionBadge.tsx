import { useAppVersion } from '@/hooks/queries/version';
import { formatVersion, releaseNotesUrl } from '@/lib/version';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@radix-ui/react-tooltip';

interface VersionBadgeProps {
	// Sidebar-collapsed mode: keep the text for screen readers, hide it visually.
	collapsed?: boolean;
	className?: string;
}

// Tooltip lines: build details, plus the two things worth calling out.
const buildDetails = (info: ReturnType<typeof useAppVersion>): string[] => {
	const lines: string[] = [];
	if (info.commit) lines.push(`commit ${info.commit.slice(0, 7)}`);
	if (info.buildDate) lines.push(`built ${new Date(info.buildDate).toLocaleDateString()}`);
	if (info.mismatch) lines.push(`client ${formatVersion(info.clientVersion)}`);
	if (info.updateAvailable) lines.push(`v${info.updateAvailable.version} available`);
	return lines;
};

// "v0.0.110" in the sidebar footer, linking to that release's notes. Hover shows the
// build details; a dot appears when GitHub has a newer release. The first thing a
// support thread asks is "what version are you on?" — this makes the answer visible
// without opening Settings or a terminal.
export const VersionBadge = ({ collapsed, className }: VersionBadgeProps) => {
	const info = useAppVersion();
	const { version, commit, updateAvailable } = info;
	const label = formatVersion(version, commit);
	const details = buildDetails(info);
	const ariaLabel = updateAvailable
		? `OpsiMate ${label}, update available: v${updateAvailable.version}`
		: `OpsiMate ${label}`;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<a
					href={updateAvailable?.url ?? releaseNotesUrl(version)}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={ariaLabel}
					className={cn(
						'inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors',
						collapsed && 'sr-only',
						className
					)}
				>
					<span className="font-mono">{label}</span>
					{updateAvailable && (
						<span
							aria-hidden="true"
							className="h-1.5 w-1.5 rounded-full bg-emerald-500"
							title={`v${updateAvailable.version} available`}
						/>
					)}
				</a>
			</TooltipTrigger>
			{details.length > 0 && (
				<TooltipContent
					side="top"
					align="center"
					className="rounded-md bg-popover text-popover-foreground px-2 py-1 text-xs border"
				>
					{details.join(' · ')}
				</TooltipContent>
			)}
		</Tooltip>
	);
};
