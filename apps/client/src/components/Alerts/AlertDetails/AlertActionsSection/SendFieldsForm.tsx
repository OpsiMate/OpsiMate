import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { coerceFieldValue, fieldValueText, getAtPath, pathLabel, setAtPath } from '@/lib/jsonFields';
import type { HttpEditableField } from '@OpsiMate/shared';
import { ChevronRight } from 'lucide-react';
import { useId } from 'react';

interface SendFieldsFormProps {
	// The rendered request body, parsed. Edits are written back into a copy of it.
	body: unknown;
	// The body as rendered, before any edit: a field keeps the TYPE it had there (a number
	// cleared and retyped is still a number), whatever it holds mid-edit.
	original: unknown;
	fields: HttpEditableField[];
	onChange: (nextBody: unknown) => void;
}

// The Send dialog's form for an HTTP action whose author marked fields the sender may
// change: one labelled input per field, prefilled from the rendered request, the rest of
// the body untouched and shown folded below so it is clear what else goes out.
export const SendFieldsForm = ({ body, original, fields, onChange }: SendFieldsFormProps) => {
	const baseId = useId();
	const present = fields.filter((f) => getAtPath(body, f.path) !== undefined);
	const missing = fields.filter((f) => getAtPath(body, f.path) === undefined);

	return (
		<div className="space-y-3">
			{present.map((field, index) => {
				const id = `${baseId}-${index}`;
				const current = getAtPath(body, field.path);
				const was = getAtPath(original, field.path);
				const label = field.label?.trim() || pathLabel(field.path);
				const set = (text: string) => onChange(setAtPath(body, field.path, coerceFieldValue(was, text)));
				return (
					<div key={field.path} className="space-y-1">
						<Label htmlFor={id} className="text-xs">
							{label}
							{field.label?.trim() && (
								<span className="ml-2 font-mono text-[10px] text-muted-foreground">{field.path}</span>
							)}
						</Label>
						{typeof was === 'boolean' ? (
							<div className="flex items-center gap-2">
								<Switch
									id={id}
									checked={current === true}
									onCheckedChange={(v) => onChange(setAtPath(body, field.path, v))}
								/>
								<span className="text-xs text-muted-foreground">{current ? 'true' : 'false'}</span>
							</div>
						) : field.multiline ? (
							<Textarea
								id={id}
								value={fieldValueText(current)}
								onChange={(e) => set(e.target.value)}
								rows={3}
								className="text-sm"
							/>
						) : (
							<Input
								id={id}
								value={fieldValueText(current)}
								onChange={(e) => set(e.target.value)}
								inputMode={typeof was === 'number' ? 'decimal' : undefined}
								className="h-9 text-sm"
							/>
						)}
					</div>
				);
			})}
			{missing.length > 0 && (
				<p className="text-xs text-muted-foreground">
					Not in this request: {missing.map((f) => pathLabel(f.path)).join(', ')}.
				</p>
			)}
			<details className="group text-xs">
				<summary className="flex cursor-pointer items-center gap-1 text-muted-foreground hover:text-foreground">
					<ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" aria-hidden />
					Full request body
				</summary>
				<pre
					role="region"
					aria-label="Full request body"
					className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted p-3 font-mono text-foreground"
				>
					{JSON.stringify(body, null, 2)}
				</pre>
			</details>
		</div>
	);
};
