import { RefObject, useRef } from 'react';

export interface TemplateFieldTarget {
	// The input/textarea the placeholder lands in.
	ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
	value: string;
	onChange: (next: string) => void;
}

export interface TemplateVariablePickerProps {
	// Variables offered as chips, WITHOUT braces (e.g. 'name', 'label.env').
	variables: string[];
	// Candidate fields, most-likely-to-be-templated first: a click inserts into the
	// FOCUSED target, falling back to the first one when none is focused.
	targets: TemplateFieldTarget[];
	caption?: string;
}

// Clickable {{variable}} chips that insert into a template field at the caret,
// replacing any selection — the enrichments dialog's label picker, generalized to
// multiple fields and to plain inputs as well as textareas. The chips preventDefault
// on mousedown so a CLICK never steals focus: whichever field the user was typing in
// is still document.activeElement when the click handler picks its target. Keyboard
// users Tab to a chip instead, which does move focus off the field — the chip's
// focus event remembers where focus came from (relatedTarget) so Enter still inserts
// into the field they were editing.
export const TemplateVariablePicker = ({ variables, targets, caption }: TemplateVariablePickerProps) => {
	const lastFieldRef = useRef<EventTarget | null>(null);

	const insert = (placeholder: string) => {
		const target =
			targets.find((t) => t.ref.current != null && t.ref.current === document.activeElement) ??
			targets.find((t) => t.ref.current != null && t.ref.current === lastFieldRef.current) ??
			targets[0];
		if (!target) return;
		const el = target.ref.current;
		// The caret position is only meaningful when the field is focused (click path)
		// or is the field keyboard-focus just left (a blurred field keeps its last
		// selection). A field the user never touched reports 0/0 — append instead of
		// inserting at the start of existing content.
		const caretTrusted = el != null && (document.activeElement === el || lastFieldRef.current === el);
		const start = caretTrusted ? (el.selectionStart ?? target.value.length) : target.value.length;
		const end = caretTrusted ? (el.selectionEnd ?? target.value.length) : target.value.length;
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
							onFocus={(e) => {
								if (e.relatedTarget) lastFieldRef.current = e.relatedTarget;
							}}
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
