import { Badge } from '@/components/ui/badge';
import { AlertEnrichment, getLabelMatcherGroups, getNameNeedles } from '@OpsiMate/shared';

interface VersionContentProps {
	enrichment: AlertEnrichment;
}

export const VersionContent = ({ enrichment }: VersionContentProps) => (
	<div className="space-y-3 rounded-md bg-muted/40 p-3">
		<div className="grid gap-2 sm:grid-cols-2">
			<div>
				<div className="text-xs text-muted-foreground">Name</div>
				<div className="font-medium">{enrichment.name}</div>
			</div>
			<div>
				<div className="text-xs text-muted-foreground">Priority</div>
				<div>{enrichment.priority}</div>
			</div>
		</div>
		<div>
			<div className="text-xs text-muted-foreground">Match</div>
			<div className="mt-1 flex flex-wrap gap-1">
				{enrichment.matchAll && <Badge variant="secondary">All alerts</Badge>}
				{getNameNeedles(enrichment).map((name) => (
					<Badge key={name} variant="secondary">
						name contains {name}
					</Badge>
				))}
				{getLabelMatcherGroups(enrichment).map((group, groupIndex) => (
					<Badge key={groupIndex} variant="outline">
						{group.map((matcher) => `${matcher.key}=${matcher.value}`).join(' and ')}
					</Badge>
				))}
			</div>
		</div>
		<div>
			<div className="text-xs text-muted-foreground">Added fields</div>
			<div className="mt-1 font-mono text-xs">
				{enrichment.addFields.length > 0
					? enrichment.addFields.map((field) => `${field.key}=${field.value}`).join(', ')
					: 'None'}
			</div>
		</div>
		{enrichment.addLinks && enrichment.addLinks.length > 0 && (
			<div>
				<div className="text-xs text-muted-foreground">Links</div>
				<ul className="mt-1 list-inside list-disc text-xs">
					{enrichment.addLinks.map((link) => (
						<li key={`${link.label}-${link.url}`}>
							{link.label}: {link.url}
						</li>
					))}
				</ul>
			</div>
		)}
		<div>
			<div className="text-xs text-muted-foreground">Summary template</div>
			<div className="mt-1 text-xs">{enrichment.summaryTemplate || 'None'}</div>
		</div>
	</div>
);
