import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';
import {
	forwardRef,
	ReactNode,
	RefObject,
	TextareaHTMLAttributes,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import type { TemplateFieldTarget } from '../TemplateVariablePicker';
import {
	addChild,
	duplicateKeys,
	MAX_FORM_NODES,
	NODE_TYPES,
	NodeType,
	removeNode,
	TemplateNode,
	templateToTree,
	treeToTemplate,
	updateNode,
} from './jsonTemplateTree';

// A JSON body template edited as a form — one row per field with its key, type and value,
// nested fields indented — or as the raw text. The text is what is stored and sent; the
// form is a view of it that writes it back after every edit, so the two can be switched
// at will. The form steps aside when the text is not JSON (nothing to show as rows), when
// the root is a bare value, or when the template is too big to be a form (see
// MAX_FORM_NODES): the text then stays the editor, with the reason said once.

export type JsonTemplateEditorMode = 'form' | 'text';

// A text value as a one-line field that grows with its content: a summary that runs to
// three lines is read in full instead of scrolled inside a 32px box.
const GrowingTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
	({ className, value, ...props }, forwardedRef) => {
		const inner = useRef<HTMLTextAreaElement | null>(null);
		useLayoutEffect(() => {
			const el = inner.current;
			if (!el) return;
			el.style.height = '0px';
			el.style.height = `${Math.max(32, el.scrollHeight)}px`;
		}, [value]);
		return (
			<Textarea
				{...props}
				value={value}
				rows={1}
				ref={(el) => {
					inner.current = el;
					if (typeof forwardedRef === 'function') forwardedRef(el);
					else if (forwardedRef) forwardedRef.current = el;
				}}
				className={cn('min-h-8 resize-none overflow-hidden py-1.5 font-mono text-xs leading-5', className)}
			/>
		);
	}
);
GrowingTextarea.displayName = 'GrowingTextarea';

export interface JsonTemplateEditorProps {
	value: string;
	onChange: (text: string) => void;
	// The {{variables}} the raw-variable type offers, without braces.
	variables: string[];
	// Validation of the text, owned by the caller (it also gates saving).
	problem: string | null;
	textareaId: string;
	textareaRef: RefObject<HTMLTextAreaElement | null>;
	textareaPlaceholder?: string;
	// id of the visible label for the whole editor; names the form group and the textarea.
	ariaLabelledBy?: string;
	// The field(s) a template-variable picker should insert into right now: the focused
	// row's value in form mode, the textarea in text mode. Reported whenever they change.
	onTargetsChange?: (targets: TemplateFieldTarget[]) => void;
}

const TYPE_LABEL: Record<NodeType, string> = {
	string: 'text',
	number: 'number',
	boolean: 'true/false',
	null: 'null',
	object: 'object',
	array: 'list',
	variable: 'variable',
};

const UNAVAILABLE: Record<'invalid' | 'scalar' | 'too-large', string> = {
	invalid: 'The form view needs valid JSON — fix the text first.',
	scalar: 'The form view needs an object or a list at the top level.',
	'too-large': `This template is too large for the form view (more than ${MAX_FORM_NODES} fields or very deep) — edit it as text.`,
};

export const JsonTemplateEditor = ({
	value,
	onChange,
	variables,
	problem,
	textareaId,
	textareaRef,
	textareaPlaceholder,
	ariaLabelledBy,
	onTargetsChange,
}: JsonTemplateEditorProps) => {
	const initial = useMemo(() => templateToTree(value), []); // eslint-disable-line react-hooks/exhaustive-deps
	const [tree, setTree] = useState<TemplateNode | null>(initial.ok ? initial.root : null);
	const [unavailable, setUnavailable] = useState<keyof typeof UNAVAILABLE | null>(
		'reason' in initial ? initial.reason : null
	);
	const [mode, setMode] = useState<JsonTemplateEditorMode>(initial.ok ? 'form' : 'text');
	// The text this component last produced: a `value` equal to it is our own echo, not an
	// outside change that should rebuild the tree (and drop focus from the row being typed in).
	const lastEmitted = useRef<string>(initial.ok ? value : '');
	const datalistId = useId();

	useEffect(() => {
		if (value === lastEmitted.current) return;
		const outcome = templateToTree(value);
		if ('reason' in outcome) {
			setTree(null);
			setUnavailable(outcome.reason);
			setMode('text');
		} else {
			setTree(outcome.root);
			setUnavailable(null);
		}
	}, [value]);

	const emit = useCallback(
		(next: TemplateNode) => {
			setTree(next);
			const text = treeToTemplate(next);
			lastEmitted.current = text;
			onChange(text);
		},
		[onChange]
	);

	// One ref object per row value input, so the variable picker can find the focused one.
	const valueRefs = useRef(new Map<string, RefObject<HTMLTextAreaElement | null>>());
	const refFor = (id: string): RefObject<HTMLTextAreaElement | null> => {
		let ref = valueRefs.current.get(id);
		if (!ref) {
			ref = { current: null };
			valueRefs.current.set(id, ref);
		}
		return ref;
	};

	useEffect(() => {
		if (!onTargetsChange) return;
		if (mode === 'text' || !tree) {
			onTargetsChange([{ ref: textareaRef, value, onChange }]);
			return;
		}
		const targets: TemplateFieldTarget[] = [];
		const walk = (node: TemplateNode) => {
			if (node.type === 'string' && node !== tree) {
				targets.push({
					ref: refFor(node.id),
					value: node.value,
					onChange: (v) => emit(updateNode(tree, node.id, { value: v })),
				});
			}
			node.children.forEach(walk);
		};
		walk(tree);
		onTargetsChange(targets);
	}, [mode, tree, value, onChange, emit, onTargetsChange, textareaRef]);

	const dupes = tree ? duplicateKeys(tree) : [];

	const renderRow = (node: TemplateNode, depth: number, parent: TemplateNode): ReactNode => {
		const isContainer = node.type === 'object' || node.type === 'array';
		return (
			<li key={node.id} className="space-y-1">
				<div
					className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.4fr)_auto] items-start gap-2"
					style={{ paddingLeft: `${depth * 16}px` }}
				>
					{parent.type === 'object' ? (
						<Input
							value={node.key}
							onChange={(e) => emit(updateNode(tree!, node.id, { key: e.target.value }))}
							placeholder="key"
							aria-label="Field name"
							aria-invalid={dupes.includes(node.key) || undefined}
							className="h-8 font-mono text-xs"
						/>
					) : (
						<span className="font-mono text-xs text-muted-foreground px-1">
							[{parent.children.indexOf(node)}]
						</span>
					)}
					<Select
						value={node.type}
						onValueChange={(type) => emit(updateNode(tree!, node.id, { type: type as NodeType }))}
					>
						<SelectTrigger className="h-8 w-[112px] text-xs" aria-label="Field type">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{NODE_TYPES.map((type) => (
								<SelectItem key={type} value={type}>
									{TYPE_LABEL[type]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{node.type === 'string' && (
						<GrowingTextarea
							ref={(el) => {
								refFor(node.id).current = el;
							}}
							value={node.value}
							onChange={(e) => emit(updateNode(tree!, node.id, { value: e.target.value }))}
							placeholder="value — {{variables}} allowed"
							aria-label="Field value"
						/>
					)}
					{node.type === 'number' && (
						<Input
							value={node.value}
							onChange={(e) => emit(updateNode(tree!, node.id, { value: e.target.value }))}
							inputMode="decimal"
							aria-label="Field value"
							aria-invalid={!/^-?\d+(\.\d+)?$/.test(node.value) || undefined}
							className="h-8 font-mono text-xs"
						/>
					)}
					{node.type === 'boolean' && (
						<Select
							value={node.value}
							onValueChange={(v) => emit(updateNode(tree!, node.id, { value: v }))}
						>
							<SelectTrigger className="h-8 text-xs" aria-label="Field value">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="true">true</SelectItem>
								<SelectItem value="false">false</SelectItem>
							</SelectContent>
						</Select>
					)}
					{node.type === 'null' && <span className="font-mono text-xs text-muted-foreground px-1">null</span>}
					{node.type === 'variable' && (
						<div className="flex items-center gap-1 font-mono text-xs">
							<span className="text-muted-foreground">{'{{'}</span>
							<Input
								value={node.value}
								onChange={(e) => emit(updateNode(tree!, node.id, { value: e.target.value }))}
								list={datalistId}
								placeholder="label.count"
								aria-label="Variable name"
								className="h-8 font-mono text-xs"
							/>
							<span className="text-muted-foreground">{'}}'}</span>
						</div>
					)}
					{isContainer && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-8 justify-start px-2 text-xs"
							onClick={() => emit(addChild(tree!, node.id))}
						>
							<Plus className="h-3.5 w-3.5 mr-1" />
							{node.type === 'object' ? 'Add field' : 'Add item'}
							<span className="ml-1 text-muted-foreground">({node.children.length})</span>
						</Button>
					)}
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8 text-muted-foreground hover:text-destructive"
						onClick={() => emit(removeNode(tree!, node.id))}
						aria-label="Remove field"
					>
						<Trash2 className="h-3.5 w-3.5" />
					</Button>
				</div>
				{isContainer && node.children.length > 0 && (
					<ul className="space-y-1">{node.children.map((child) => renderRow(child, depth + 1, node))}</ul>
				)}
			</li>
		);
	};

	const formAvailable = tree !== null;

	return (
		<div className="space-y-2">
			<div className="flex items-center gap-1" role="group" aria-label="Body editor view">
				{(['form', 'text'] as const).map((m) => (
					<Button
						key={m}
						type="button"
						size="sm"
						variant={mode === m ? 'secondary' : 'ghost'}
						className="h-7 px-2 text-xs"
						aria-pressed={mode === m}
						disabled={m === 'form' && !formAvailable}
						title={m === 'form' && unavailable ? UNAVAILABLE[unavailable] : undefined}
						onClick={() => setMode(m)}
					>
						{m === 'form' ? 'Form' : 'Text'}
					</Button>
				))}
				{unavailable && <span className="text-xs text-muted-foreground">{UNAVAILABLE[unavailable]}</span>}
			</div>

			{mode === 'form' && tree ? (
				<div
					className="rounded-md border bg-background p-2 space-y-1"
					role="group"
					aria-labelledby={ariaLabelledBy}
				>
					{tree.children.length === 0 ? (
						<p className="px-1 py-2 text-xs text-muted-foreground">No fields yet.</p>
					) : (
						<ul className="space-y-1" aria-label="Body fields">
							{tree.children.map((child) => renderRow(child, 0, tree))}
						</ul>
					)}
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-8 text-xs"
						onClick={() => emit(addChild(tree, tree.id))}
					>
						<Plus className="h-3.5 w-3.5 mr-1" />
						{tree.type === 'object' ? 'Add field' : 'Add item'}
					</Button>
					{dupes.length > 0 && (
						<p className="text-xs text-destructive" role="alert">
							Duplicate key{dupes.length > 1 ? 's' : ''}: {Array.from(new Set(dupes)).join(', ')} — JSON
							keeps only one of them.
						</p>
					)}
					<datalist id={datalistId}>
						{variables.map((v) => (
							<option key={v} value={v} />
						))}
					</datalist>
				</div>
			) : (
				<Textarea
					id={textareaId}
					ref={textareaRef}
					placeholder={textareaPlaceholder}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					rows={6}
					className={cn('font-mono text-xs', problem && 'border-destructive')}
					aria-invalid={problem !== null}
					aria-labelledby={ariaLabelledBy}
				/>
			)}
		</div>
	);
};
