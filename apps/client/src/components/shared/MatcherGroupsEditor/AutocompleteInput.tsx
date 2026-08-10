import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

interface AutocompleteInputProps {
	value: string;
	onChange: (value: string) => void;
	suggestions: string[];
	placeholder?: string;
	disabled?: boolean;
	'aria-label'?: string;
	className?: string;
}

// A text input with a styled type-ahead dropdown. Unlike a native <datalist> it matches
// the app's design; unlike a cmdk Command it never captures the caret, so free typing (a
// value not in the list) always works. The list is filtered to the current text and only
// renders while focused, so nothing shows until the user engages the field.
export const AutocompleteInput = ({
	value,
	onChange,
	suggestions,
	placeholder,
	disabled,
	className,
	...aria
}: AutocompleteInputProps) => {
	const [open, setOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(-1);
	const containerRef = useRef<HTMLDivElement>(null);

	// Close when focus leaves the input+list container (click-away or Tab-out).
	useEffect(() => {
		if (!open) return;
		const onDocMouseDown = (e: MouseEvent) => {
			if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener('mousedown', onDocMouseDown);
		return () => document.removeEventListener('mousedown', onDocMouseDown);
	}, [open]);

	const needle = value.trim().toLowerCase();
	// Substring match, current exact value excluded (no point suggesting what's typed).
	const matches = suggestions.filter((s) => s.toLowerCase().includes(needle) && s !== value).slice(0, 50);
	const showList = open && matches.length > 0;

	const commit = (v: string) => {
		onChange(v);
		setOpen(false);
		setActiveIndex(-1);
	};

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (!showList) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			setActiveIndex((i) => (i + 1) % matches.length);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			setActiveIndex((i) => (i <= 0 ? matches.length - 1 : i - 1));
		} else if (e.key === 'Enter' && activeIndex >= 0) {
			e.preventDefault();
			commit(matches[activeIndex]);
		} else if (e.key === 'Escape') {
			setOpen(false);
		}
	};

	return (
		<div ref={containerRef} className={cn('relative', className)}>
			<Input
				value={value}
				placeholder={placeholder}
				disabled={disabled}
				aria-label={aria['aria-label']}
				autoComplete="off"
				role="combobox"
				aria-expanded={showList}
				onChange={(e) => {
					onChange(e.target.value);
					setOpen(true);
					setActiveIndex(-1);
				}}
				onFocus={() => setOpen(true)}
				onKeyDown={onKeyDown}
			/>
			{showList && (
				<ul
					className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
					role="listbox"
				>
					{matches.map((s, i) => (
						<li key={s}>
							<button
								type="button"
								role="option"
								aria-selected={i === activeIndex}
								// mousedown (not click) so it fires before the input's blur closes the list.
								onMouseDown={(e) => {
									e.preventDefault();
									commit(s);
								}}
								onMouseEnter={() => setActiveIndex(i)}
								className={cn(
									'w-full truncate rounded-sm px-2 py-1.5 text-left text-sm',
									i === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
								)}
							>
								{s}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
};
