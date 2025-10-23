import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { cn } from '@/lib/utils';

interface ErrorAlertProps {
	message: string;
	className?: string;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, className }) => {
	return (
		<Alert
			variant='destructive'
			className={cn(
				'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/50 dark:border-red-800 dark:text-red-200',
				className
			)}
		>
			<AlertCircle className='h-4 w-4 text-red-600 dark:text-red-400' />
			<AlertDescription className='text-red-800 dark:text-red-200'>{message}</AlertDescription>
		</Alert>
	);
};
