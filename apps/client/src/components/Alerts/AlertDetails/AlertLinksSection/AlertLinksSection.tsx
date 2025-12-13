import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert } from '@OpsiMate/shared';
import { Book, ExternalLink } from 'lucide-react';

interface AlertLinksSectionProps {
	alert: Alert;
}

export const AlertLinksSection = ({ alert }: AlertLinksSectionProps) => {
	if (!alert.alertUrl && !alert.runbookUrl) {
		return null;
	}

	return (
		<>
			<Separator />
			<div className="grid grid-cols-2 gap-2">
				{alert.alertUrl && (
					<Button
						variant="outline"
						size="sm"
						className="w-full justify-start gap-2 text-xs h-8"
						onClick={() => window.open(alert.alertUrl, '_blank', 'noopener,noreferrer')}
					>
						<ExternalLink className="h-3 w-3 flex-shrink-0" />
						<span className="truncate">Source</span>
					</Button>
				)}

				{alert.runbookUrl && (
					<Button
						variant="outline"
						size="sm"
						className="w-full justify-start gap-2 text-xs h-8"
						onClick={() => window.open(alert.runbookUrl, '_blank', 'noopener,noreferrer')}
					>
						<Book className="h-3 w-3 flex-shrink-0" />
						<span className="truncate">Runbook</span>
					</Button>
				)}
			</div>
		</>
	);
};
