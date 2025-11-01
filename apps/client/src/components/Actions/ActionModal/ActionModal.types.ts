import { ActionTarget, ActionType } from '@OpsiMate/custom-actions';

export interface ActionFormData {
	name: string;
	description: string;
	type: ActionType;
	target: Exclude<ActionTarget, null>;
	script?: string | null;
	url?: string;
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	headers?: Record<string, string> | null;
	body?: string | null;
}

export interface FormErrors {
	name?: string;
	description?: string;
	url?: string;
	method?: string;
	headers?: string;
}
