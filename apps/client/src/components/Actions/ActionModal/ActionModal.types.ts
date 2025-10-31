import { CustomAction } from '@OpsiMate/custom-actions';

export interface ActionModalProps {
	open: boolean;
	onClose: () => void;
	action?: CustomAction;
}

export interface ActionFormData {
	name: string;
	description: string;
	type: 'bash' | 'http';
	target: 'service' | 'provider';
	script?: string | null;
	url?: string;
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	headers?: Record<string, string> | null;
	body?: string | null;
}
