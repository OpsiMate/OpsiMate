import { Alert } from '@OpsiMate/shared';
import { Link2 } from 'lucide-react';
import { getAlertLinks } from '../../utils/links.utils';
import { AlertActions } from '../AlertActionsSection';
import { AlertLinksSection } from '../AlertLinksSection';
import { CollapsibleSection } from '../CollapsibleSection';
import { BOTTOM_SECTIONS_MAX_HEIGHT_CLASS, LINKS_SECTION_TITLE } from './AlertDetailsBottomSections.constants';

interface AlertDetailsBottomSectionsProps {
	alert: Alert;
}

// The Details tab's bottom block: the alert's links and its custom actions, pinned above
// the silence/resolve footer rather than scrolling with the body — they are what you
// reach for after reading, so they sit where the hand already is. Links stay folded;
// actions open, so the buttons are one click away. Each section draws its own top rule
// (CollapsibleSection), so with nothing to show the block has no chrome and no height.
// Bounded: many matching actions must not push the body (or the footer) out of the panel
// — past half the tab the block scrolls instead.
export const AlertDetailsBottomSections = ({ alert }: AlertDetailsBottomSectionsProps) => {
	const links = getAlertLinks(alert);
	return (
		<div
			className={`shrink-0 overflow-y-auto bg-background px-4 pb-2 space-y-2 empty:hidden ${BOTTOM_SECTIONS_MAX_HEIGHT_CLASS}`}
		>
			{links.length > 0 && (
				<CollapsibleSection
					title={LINKS_SECTION_TITLE}
					icon={<Link2 className="h-3.5 w-3.5" />}
					defaultOpen={false}
				>
					<AlertLinksSection alert={alert} links={links} />
				</CollapsibleSection>
			)}
			<AlertActions alert={alert} />
		</div>
	);
};
