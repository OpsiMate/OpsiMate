import {
	Modal as ChakraModal,
	ModalCloseButton as ChakraModalCloseButton,
	ModalContent as ChakraModalContent,
	ModalFooter as ChakraModalFooter,
	ModalHeader as ChakraModalHeader,
	ModalOverlay as ChakraModalOverlay
} from '@chakra-ui/react';
import * as React from 'react';

import { cn } from '@/lib/utils';

interface DialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: React.ReactNode;
}

const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
	return (
		<ChakraModal isOpen={open} onClose={() => onOpenChange(false)} isCentered>
			{children}
		</ChakraModal>
	);
};

const DialogTrigger = React.forwardRef<
	HTMLButtonElement,
	React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ children, onClick, ...props }, ref) => {
	return (
		<button ref={ref} onClick={onClick} {...props}>
			{children}
		</button>
	);
});
DialogTrigger.displayName = 'DialogTrigger';

const DialogPortal = ({ children }: { children: React.ReactNode }) => {
	return <>{children}</>;
};

const DialogClose = React.forwardRef<
	HTMLButtonElement,
	React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, onClick, ...props }, ref) => {
	return (
		<button ref={ref} onClick={onClick} {...props}>
			{children}
		</button>
	);
});
DialogClose.displayName = 'DialogClose';

const DialogOverlay = () => {
	return <ChakraModalOverlay bg="blackAlpha.300" backdropFilter="blur(4px)" />;
};

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
	className?: string;
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
	({ className, children, ...props }, ref) => {
		const maxWidth = className?.includes('max-w-[600px]') ? '600px' : className?.includes('max-w-') ? undefined : 'lg';

		return (
			<>
				<DialogOverlay />
				<ChakraModalContent ref={ref} className={className} maxW={maxWidth} {...props}>
					<ChakraModalCloseButton />
					{children}
				</ChakraModalContent>
			</>
		);
	}
);
DialogContent.displayName = 'DialogContent';

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
	return (
		<ChakraModalHeader className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
	);
};

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
	return (
		<ChakraModalFooter className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />
	);
};

const DialogTitle = React.forwardRef<
	HTMLHeadingElement,
	React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
	return (
		<h2
			ref={ref}
			className={cn('text-lg font-semibold leading-none tracking-tight', className)}
			{...props}
		/>
	);
});
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
	return (
		<p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
	);
});
DialogDescription.displayName = 'DialogDescription';

export {
	Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger
};
