import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useEnrichmentHistory } from '@/hooks/queries/enrichments';
import { AlertEnrichment } from '@OpsiMate/shared';
import { EnrichmentHistoryDialogLayout } from './EnrichmentHistoryDialogLayout';
import { VersionContent } from './VersionContent';

interface EnrichmentHistoryDialogProps {
	enrichment: AlertEnrichment | null;
	onOpenChange: (open: boolean) => void;
}

export const EnrichmentHistoryDialog = ({ enrichment, onOpenChange }: EnrichmentHistoryDialogProps) => {
	const { data: versions = [], isLoading, error } = useEnrichmentHistory(enrichment?.id ?? null);

	if (!enrichment) return null;

	if (isLoading) {
		return (
			<EnrichmentHistoryDialogLayout enrichment={enrichment} onOpenChange={onOpenChange}>
				<p className="py-8 text-center text-sm text-muted-foreground">Loading version history…</p>
			</EnrichmentHistoryDialogLayout>
		);
	}

	if (error) {
		return (
			<EnrichmentHistoryDialogLayout enrichment={enrichment} onOpenChange={onOpenChange}>
				<p className="py-8 text-center text-sm text-destructive">{error.message}</p>
			</EnrichmentHistoryDialogLayout>
		);
	}

	return (
		<EnrichmentHistoryDialogLayout enrichment={enrichment} onOpenChange={onOpenChange}>
			<Accordion type="single" collapsible defaultValue={versions[0] ? String(versions[0].id) : undefined}>
				{versions.map((version) => (
					<AccordionItem key={version.id} value={String(version.id)}>
						<AccordionTrigger>
							<span>
								Version {version.version} · {version.author} ·{' '}
								{new Date(version.createdAt).toLocaleString()}
							</span>
						</AccordionTrigger>
						<AccordionContent>
							<VersionContent enrichment={version.content} />
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</EnrichmentHistoryDialogLayout>
	);
};
