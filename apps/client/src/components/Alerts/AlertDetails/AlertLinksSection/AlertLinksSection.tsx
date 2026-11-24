import { Button } from '@/components/ui/button';
import { Alert, AlertLink } from '@OpsiMate/shared';
import { AlertLinkIcon } from '../../AlertLinkIcon';
import { getAlertLinks } from '../../utils/links.utils';

interface AlertLinksSectionProps {
	alert: Alert;
	// The alert's links, when the caller already derived them (to decide whether to
	// render the section at all); derived here otherwise.
	links?: AlertLink[];
}

export const AlertLinksSection = ({ alert, links = getAlertLinks(alert) }: AlertLinksSectionProps) => {
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
