import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Fragment, useId } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface NameMatchersEditorProps {
	// Substrings ORed together: the rule's name criterion passes when the alert name
	// contains ANY of them. One empty row is rendered when the list is empty, so the
	// control always looks like a field rather than a button.
	values: string[];
	onChange: (values: string[]) => void;
	placeholder?: string;
	disabled?: boolean;
	label?: string;
}

// Name-matcher editor shared by mute policies, enrichments and actions. Label matchers
// could always say "env=prod OR env=staging" through matcher groups; the name could only
// ever be one substring, so a rule covering two naming conventions needed two rules.
// Rows here are alternatives, mirroring the OR boxes of MatcherGroupsEditor.
export const NameMatchersEditor = ({
	values,
	onChange,
	placeholder = 'e.g. disk',
	disabled = false,
	label = 'Alert name contains',
}: NameMatchersEditorProps) => {
	// useId, not a prop with a default: every call site would have passed the same
	// default and the ids would collide anyway whenever two dialogs are mounted at
	// once. React guarantees uniqueness per instance with nothing to remember.
	const idPrefix = useId();
	// An empty list still shows one row: the field is the primary way to scope a rule,
	// and hiding it behind "+ Add" would make it look unavailable.
	const rows = values.length > 0 ? values : [''];

	const update = (index: number, value: string) => {
		const next = [...rows];
		next[index] = value;
		// Trailing blank rows are dropped on the way out so they never reach the payload;
		// the row itself stays on screen until the user leaves it.
		onChange(next.filter((v, i) => v.trim().length > 0 || i < next.length - 1));
	};

	const removeRow = (index: number) => {
		const next = rows.filter((_, i) => i !== index);
		onChange(next.filter((v) => v.trim().length > 0));
	};

	return (
		<div className="space-y-2">
			{/* Bound to the FIRST row so the visible label is the accessible name of the
			    field a user lands on; the alternatives below carry their own aria-label,
			    since "Alert name contains" repeated four times tells a screen-reader user
			    nothing about which row they are in. */}
			<Label htmlFor={`${idPrefix}-0`} className="text-sm font-medium">
				{label}
			</Label>
			{rows.map((value, index) => (
				<Fragment key={index}>
					{index > 0 && (
						<div className="flex items-center gap-2">
							<Badge variant="outline" className="text-[10px] uppercase tracking-wide">
								or
							</Badge>
							<span className="h-px flex-1 bg-border" />
						</div>
					)}
					<div className="flex items-center gap-2">
						<Input
							id={`${idPrefix}-${index}`}
							value={value}
							onChange={(e) => update(index, e.target.value)}
							placeholder={placeholder}
							disabled={disabled}
							aria-label={index === 0 ? label : `${label}, alternative ${index + 1}`}
						/>
						{rows.length > 1 && (
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="h-9 w-9 shrink-0"
								onClick={() => removeRow(index)}
								disabled={disabled}
								aria-label={`Remove name matcher ${index + 1}`}
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						)}
					</div>
				</Fragment>
			))}
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="gap-1"
				onClick={() => onChange([...rows.filter((v) => v.trim().length > 0), ''])}
				// A new blank row on top of a blank row would do nothing visible.
				disabled={disabled || rows.some((v) => v.trim().length === 0)}
			>
				<Plus className="h-3.5 w-3.5" />
				Add name (OR)
			</Button>
		</div>
	);
};
