import { ActionTarget, CustomAction } from '@OpsiMate/custom-actions';
import { ActionFormData } from './ActionModal.types';

export const actionToFormData = (action?: CustomAction): ActionFormData => {
	if (!action) {
		return {
			name: '',
			description: '',
			type: 'bash',
			target: 'service',
			script: null,
			url: '',
			method: 'GET',
			headers: null,
			body: null,
		};
	}

	if (action.type === 'bash') {
		return {
			name: action.name,
			description: action.description,
			type: 'bash',
			target: action.target,
			script: action.script,
		};
	}

	return {
		name: action.name,
		description: action.description,
		type: 'http',
		target: action.target,
		url: action.url,
		method: action.method || 'GET',
		headers: action.headers ?? null,
		body: action.body ?? null,
	};
};

export const formDataToAction = (formData: ActionFormData): CustomAction => {
	const base = {
		name: formData.name,
		description: formData.description,
		target: formData.target as ActionTarget,
	};

	if (formData.type === 'bash') {
		return {
			...base,
			type: 'bash',
			script: formData.script ?? null,
		};
	}

	return {
		...base,
		type: 'http',
		url: formData.url!,
		method: formData.method!,
		headers: formData.headers ?? null,
		body: formData.body ?? null,
	};
};
