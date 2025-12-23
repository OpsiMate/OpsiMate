import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

export interface ClearButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	onClear?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const ClearButton = React.forwardRef<HTMLButtonElement, ClearButtonProps>(
	({ className, onClick, onClear, ...props }, ref) => {
		const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
			e.stopPropagation();
			e.preventDefault();
			if (onClear) {
				onClear(e);
			}
			if (onClick) {
				onClick(e);
			}
		};

		return (
			<button
				ref={ref}
				type="button"
				onClick={handleClick}
				className={cn(
					'flex items-center justify-center flex-shrink-0 rounded-sm opacity-70 hover:opacity-100 focus:outline-none hover:bg-primary hover:text-primary-foreground transition-colors',
					className
				)}
				{...props}
			>
				<X className="h-3.5 w-3.5" />
			</button>
		);
	}
);
ClearButton.displayName = 'ClearButton';

export { ClearButton };
