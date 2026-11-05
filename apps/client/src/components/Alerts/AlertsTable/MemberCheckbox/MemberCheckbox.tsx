import { Checkbox } from '@/components/ui/checkbox';
import {
	MEMBER_CHECKBOX_CLASSES,
	MEMBER_SELECTION_STATE,
	MemberSelectionState,
	SELECT_COLUMN_WIDTH,
} from '../AlertsTable.constants';

interface MemberCheckboxProps {
	// How many of the row's members are selected: unchecked / mixed / checked.
	state: MemberSelectionState;
	// Accessible names, naming the row (folder, group) for screen reader users moving between checkboxes.
	labels: Record<'select' | 'unselect', string>;
	// Hover text, when the checkbox needs to explain its scope.
	title?: string;
	onToggle?: () => void;
}

// The checkbox cell of a row that stands for several alerts — an incident folder, a
// group header. Sits under the table's select column so it lines up with the rows'
// checkboxes: same width, and the same left-only padding the table cells get (TableCell
// drops its right padding around a checkbox). Clicks stay in the cell; the row behind
// it toggles expansion.
export const MemberCheckbox = ({ state, labels, title, onToggle }: MemberCheckboxProps) => (
	<div
		className="flex shrink-0 items-center justify-center pl-2"
		style={{ width: SELECT_COLUMN_WIDTH }}
		onClick={(e) => e.stopPropagation()}
	>
		<Checkbox
			checked={
				state === MEMBER_SELECTION_STATE.ALL
					? true
					: state === MEMBER_SELECTION_STATE.SOME
						? 'indeterminate'
						: false
			}
			onCheckedChange={() => onToggle?.()}
			aria-label={state === MEMBER_SELECTION_STATE.ALL ? labels.unselect : labels.select}
			title={title}
			className={MEMBER_CHECKBOX_CLASSES}
		/>
	</div>
);
