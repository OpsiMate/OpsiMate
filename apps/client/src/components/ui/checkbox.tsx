import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

const Checkbox = React.forwardRef<
	React.ElementRef<typeof CheckboxPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
	<CheckboxPrimitive.Root
		ref={ref}
		className={cn(
			'peer h-4 w-4 shrink-0 rounded-sm border-2 border-primary ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground hover:bg-primary/10 transition-colors cursor-pointer',
			className
		)}
		{...props}
	>
		{/* The icon follows the indicator's own data-state, so controlled and uncontrolled
		    (defaultChecked="indeterminate") checkboxes show the same thing. */}
		<CheckboxPrimitive.Indicator className="group/indicator flex items-center justify-center text-current w-full h-full">
			<Minus className="hidden h-3 w-3 group-data-[state=indeterminate]/indicator:block" strokeWidth={3} />
			<Check className="h-3 w-3 group-data-[state=indeterminate]/indicator:hidden" strokeWidth={3} />
		</CheckboxPrimitive.Indicator>
	</CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
