import { AlertType } from '@OpsiMate/shared';
import { ReactNode } from 'react';

export type AlertIntegrationKind = Lowercase<AlertType>;

export interface IntegrationDefinition {
	label: string;
	bgClass: string;
	borderClass: string;
	textClass: string;
	render: (iconSizeClass: string) => ReactNode;
}

export const sizeMap = {
	sm: 'h-6 w-6',
	md: 'h-7 w-7',
	lg: 'h-10 w-10',
} as const;

export const iconSizeMap = {
	sm: 'h-3.5 w-3.5',
	md: 'h-4 w-4',
	lg: 'h-6 w-6',
} as const;
