import { ExternalLink } from 'lucide-react';
import { integrationDefinitions, normalizeIntegration } from '../IntegrationAvatar';

export interface AlertLinkIconProps {
	icon?: string;
	className?: string;
}

// A link's icon slug resolved against the integration icon set; empty or unrecognized
// slugs get the generic external-link glyph. Shared by the details panel's links
// section, the row's ⋮ menu, and the services-page alert list.
export const AlertLinkIcon = ({ icon, className = 'h-3 w-3 shrink-0' }: AlertLinkIconProps) => {
	const kind = normalizeIntegration(icon);
	if (kind) return <span className="shrink-0 inline-flex">{integrationDefinitions[kind].render(className)}</span>;
	return <ExternalLink className={className} />;
};
