import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

export interface ClearButtonProps extends React.HTMLAttributes<HTMLSpanElement> {
	onClear?: (e: React.SyntheticEvent) => void;
}

const ClearButton = React.forwardRef<HTMLSpanElement, ClearButtonProps>(
	({ className, onClick, onClear, onKeyDown, ...props }, ref) => {
		const handleActivate = (e: React.SyntheticEvent) => {
			e.stopPropagation();
			e.preventDefault();
			if (onClear) {
				onClear(e);
			}
			if (onClick) {
				onClick(e as React.MouseEvent<HTMLSpanElement>);
			}
		};

		const handleKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				handleActivate(e);
			}
			onKeyDown?.(e);
		};

		return (
			<span
				ref={ref}
				role="button"
				tabIndex={0}
				aria-label="Clear filter"
				onClick={handleActivate}
				onKeyDown={handleKeyDown}
				{...props}
				className={cn(
					'flex cursor-pointer items-center justify-center shrink-0 rounded-sm opacity-70 hover:opacity-100 focus:outline-hidden hover:bg-primary hover:text-primary-foreground transition-colors',
					className
				)}
			>
				<X aria-hidden="true" className="h-3.5 w-3.5" />
			</span>
		);
	}
);
ClearButton.displayName = 'ClearButton';

export { ClearButton };
