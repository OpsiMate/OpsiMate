import { Button } from '@/components/ui/button';
import { Alert } from '@OpsiMate/shared';
import { AlertLinkIcon } from '../../AlertLinkIcon';
import { getAlertLinks } from '../../utils/links.utils';

interface AlertLinksSectionProps {
	alert: Alert;
}

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
