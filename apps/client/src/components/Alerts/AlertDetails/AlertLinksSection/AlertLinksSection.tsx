import { Button } from '@/components/ui/button';
import { Alert } from '@OpsiMate/shared';
import { ExternalLink } from 'lucide-react';
import { integrationDefinitions, normalizeIntegration } from '../../IntegrationAvatar';
import { getAlertLinks } from '../../utils/links.utils';

interface AlertLinksSectionProps {
	alert: Alert;
}

// A link's icon slug resolved against the integration icon set; empty or unrecognized
// slugs get the generic external-link glyph.
export const AlertLinkIcon = ({ icon, className = 'h-3 w-3 shrink-0' }: { icon?: string; className?: string }) => {
	const kind = normalizeIntegration(icon);
	if (kind) return <span className="shrink-0 inline-flex">{integrationDefinitions[kind].render(className)}</span>;
	return <ExternalLink className={className} />;
};

export const AlertLinksSection = ({ alert }: AlertLinksSectionProps) => {
	const links = getAlertLinks(alert);
	if (links.length === 0) {
		return null;
	}

	return (
		<div className="grid grid-cols-2 gap-2">
			{links.map((link) => (
				<Button
					key={`${link.label}-${link.url}`}
					variant="outline"
					size="sm"
					className="w-full justify-start gap-2 text-xs h-8"
					title={link.url}
					onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
				>
					<AlertLinkIcon icon={link.icon} />
					<span className="truncate">{link.label}</span>
				</Button>
			))}
		</div>
	);
};
