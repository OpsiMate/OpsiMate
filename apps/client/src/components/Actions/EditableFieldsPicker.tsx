import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { listTemplateFields, pathLabel, TemplateField } from '@/lib/jsonFields';
import type { HttpEditableField } from '@OpsiMate/shared';
import { AlertTriangle, PencilLine } from 'lucide-react';
import { useMemo } from 'react';

interface EditableFieldsPickerProps {
	// The JSON body template as typed; its leaves are what can be ticked.
	template: string;
	value: HttpEditableField[];
	onChange: (next: HttpEditableField[]) => void;
}

// Which fields of the body the person SENDING the action may change: the author ticks
// them here, once, and the Send dialog then shows just those — a "comment" left empty in
// the template to be filled per alert, a label to override — instead of the whole JSON.
export const EditableFieldsPicker = ({ template, value, onChange }: EditableFieldsPickerProps) => {
	const fields = useMemo(() => listTemplateFields(template), [template]);
	const byPath = new Map(value.map((f) => [f.path, f]));
	// Ticked earlier, but no longer in the template (renamed or removed): shown so it can be
	// unticked rather than silently kept and then ignored at send time.
	const orphans = value.filter((f) => !fields.some((t) => t.path === f.path));

	const toggle = (field: TemplateField, on: boolean) => {
		if (on) onChange([...value, { path: field.path }]);
		else onChange(value.filter((f) => f.path !== field.path));
	};
	const patch = (path: string, changes: Partial<HttpEditableField>) =>
		onChange(value.map((f) => (f.path === path ? { ...f, ...changes } : f)));

	if (fields.length === 0 && orphans.length === 0) {
		return (
			<p className="text-xs text-muted-foreground">
				{template.trim()
					? 'Fix the JSON above to pick fields the sender can change.'
					: 'Write the body above, then pick fields the sender can change.'}
			</p>
		);
	}

	return (
		<div className="space-y-2">
			<p className="text-xs text-muted-foreground">
				Tick the fields a person may change when sending this action. Everything else goes out as written; a
				ticked field is prefilled with its value and can be edited — an empty field becomes a free-text box.
			</p>
			<ul className="divide-y rounded-md border bg-background" aria-label="Fields the sender can change">
				{fields.map((field) => {
					const picked = byPath.get(field.path);
					return (
						<li key={field.path} className="px-3 py-2 space-y-2">
							<label className="flex items-center gap-2 cursor-pointer">
								<Checkbox
									checked={picked !== undefined}
									onCheckedChange={(v) => toggle(field, v === true)}
									aria-label={`Sender can change ${pathLabel(field.path)}`}
								/>
								<span className="font-mono text-xs">{pathLabel(field.path)}</span>
								<span className="text-xs text-muted-foreground truncate">
									{field.sample === '' ? '(empty)' : field.sample}
								</span>
							</label>
							{picked && (
								<div className="ml-6 flex flex-wrap items-center gap-2">
									<Input
										value={picked.label ?? ''}
										onChange={(e) => patch(field.path, { label: e.target.value || null })}
										placeholder={`Label shown to the sender (default: ${pathLabel(field.path)})`}
										aria-label={`Label for ${pathLabel(field.path)}`}
										className="h-8 text-xs max-w-sm"
									/>
									{field.kind === 'string' || field.kind === 'variable' || field.kind === 'null' ? (
										<label className="flex items-center gap-1.5 text-xs cursor-pointer">
											<Checkbox
												checked={picked.multiline === true}
												onCheckedChange={(v) => patch(field.path, { multiline: v === true })}
												aria-label={`Multi-line ${pathLabel(field.path)}`}
											/>
											Multi-line
										</label>
									) : null}
								</div>
							)}
						</li>
					);
				})}
				{orphans.map((f) => (
					<li key={f.path} className="px-3 py-2">
						<label className="flex items-center gap-2 cursor-pointer text-xs">
							<Checkbox
								checked
								onCheckedChange={() => onChange(value.filter((v) => v.path !== f.path))}
								aria-label={`Sender can change ${pathLabel(f.path)}`}
							/>
							<span className="font-mono">{pathLabel(f.path)}</span>
							<span className="flex items-center gap-1 text-[#92400e] dark:text-[#fde68a]">
								<AlertTriangle className="h-3.5 w-3.5" aria-hidden />
								not in the body any more — untick it
							</span>
						</label>
					</li>
				))}
			</ul>
			{value.length > 0 && (
				<p className="flex items-center gap-1 text-xs text-muted-foreground">
					<PencilLine className="h-3.5 w-3.5" aria-hidden />
					{value.length} field{value.length > 1 ? 's' : ''} the sender can change.
				</p>
			)}
		</div>
	);
};
