import React from 'react';
import { Check, X } from 'lucide-react';

export interface ValidationRule {
	id: string;
	label: string;
	validator: (value: string) => boolean;
	errorMessage?: string;
}

interface ValidationFeedbackProps {
	value: string;
	rules: ValidationRule[];
	showValid?: boolean; // Whether to show green checkmarks for valid rules
}

export const ValidationFeedback: React.FC<ValidationFeedbackProps> = ({ value, rules, showValid = true }) => {
	return (
		<div className="space-y-1 mt-1">
			{rules.map((rule) => {
				const isValid = rule.validator(value);
				const shouldShow = !isValid || showValid;

				if (!shouldShow) return null;

				return (
					<div
						key={rule.id}
						className={`flex items-center gap-2 text-sm ${isValid ? 'text-green-600' : 'text-red-500'}`}
					>
						{isValid ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
						<span>{rule.label}</span>
					</div>
				);
			})}
		</div>
	);
};

// Predefined validation rules for common fields
export const validationRules = {
	apiKey: [
		{
			id: 'apikey-no-spaces',
			label: 'API key cannot contain spaces',
			validator: (value: string) => {
				if (value.length === 0) return true;
				return !/\s/.test(value);
			},
		},
	],

	appKey: [
		{
			id: 'appkey-no-spaces',
			label: 'Application key cannot contain spaces',
			validator: (value: string) => {
				if (value.length === 0) return true;
				return !/\s/.test(value);
			},
		},
	],
};
