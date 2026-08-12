import { RefObject } from 'react';

export interface TemplateFieldTarget {
	// The input/textarea the placeholder lands in.
	ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
	value: string;
	onChange: (next: string) => void;
}

export interface TemplateVariablePickerProps {
	// Variables offered as chips, WITHOUT braces (e.g. 'alert.name').
	variables: string[];
	// Candidate fields, most-likely-to-be-templated first: a click inserts into the
	// FOCUSED target, falling back to the first one when none is focused.
	targets: TemplateFieldTarget[];
	caption?: string;
}

// Clickable {{variable}} chips that insert into a template field at the caret,
// replacing any selection — the enrichments dialog's label picker, generalized to
// multiple fields and to plain inputs as well as textareas. The chips preventDefault
// on mousedown so the click never steals focus: whichever field the user was typing
// in is still document.activeElement when the click handler picks its target.
export const TemplateVariablePicker = ({ variables, targets, caption }: TemplateVariablePickerProps) => {
	const insert = (placeholder: string) => {
		const focused = targets.find((t) => t.ref.current != null && t.ref.current === document.activeElement);
		const target = focused ?? targets[0];
		if (!target) return;
		const el = target.ref.current;
		// Unfocused fields report selection 0 — append at the end instead of the start.
		const start = focused && el ? (el.selectionStart ?? target.value.length) : target.value.length;
		const end = focused && el ? (el.selectionEnd ?? target.value.length) : target.value.length;
		target.onChange(target.value.slice(0, start) + placeholder + target.value.slice(end));
		requestAnimationFrame(() => {
			if (!el) return;
			el.focus();
			const caret = start + placeholder.length;
			el.setSelectionRange(caret, caret);
		});
	};

	if (variables.length === 0) return null;

	return (
		<div className="space-y-1">
			<p className="text-[11px] text-muted-foreground">
				{caption ?? 'Available variables — click to insert into the field you are editing:'}
			</p>
			<div className="flex flex-wrap gap-1">
				{variables.map((variable) => {
					const placeholder = `{{${variable}}}`;
					return (
						<button
							key={variable}
							type="button"
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => insert(placeholder)}
							className="px-2 py-0.5 rounded-full border bg-background hover:bg-muted text-[11px] font-mono"
							title={`Insert ${placeholder}`}
						>
							{placeholder}
						</button>
					);
				})}
			</div>
		</div>
	);
};
