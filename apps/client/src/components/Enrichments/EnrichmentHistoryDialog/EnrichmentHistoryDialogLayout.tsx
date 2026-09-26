import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertEnrichment } from '@OpsiMate/shared';
import { ReactNode } from 'react';

interface EnrichmentHistoryDialogLayoutProps {
	enrichment: AlertEnrichment;
	onOpenChange: (open: boolean) => void;
	children: ReactNode;
}

export const EnrichmentHistoryDialogLayout = ({
	enrichment,
	onOpenChange,
	children,
}: EnrichmentHistoryDialogLayoutProps) => (
	<Dialog open onOpenChange={onOpenChange}>
		<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
			<DialogHeader>
				<DialogTitle>Version history</DialogTitle>
				<DialogDescription>{enrichment.name}</DialogDescription>
			</DialogHeader>
			{children}
		</DialogContent>
	</Dialog>
);
