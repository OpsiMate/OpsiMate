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

const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const hostnameRegex =
	/^(?![\d.]+$)(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const isValidHostnameOrIP = (value: string): boolean => ipRegex.test(value) || hostnameRegex.test(value);

export const ValidationFeedback: React.FC<ValidationFeedbackProps> = ({ value, rules, showValid = true }) => {
	return (
		<div className='space-y-1 mt-1'>
			{rules.map(rule => {
				const isValid = rule.validator(value);
				const shouldShow = !isValid || showValid;

				if (!shouldShow) return null;

				return (
					<div
						key={rule.id}
						className={`flex items-center gap-2 text-sm ${isValid ? 'text-green-600' : 'text-red-500'}`}
					>
						{isValid ? <Check className='h-4 w-4' /> : <X className='h-4 w-4' />}
						<span>{rule.label}</span>
					</div>
				);
			})}
		</div>
	);
};

// Predefined validation rules for common fields
export const validationRules = {
	email: [
		{
			id: 'email-required',
			label: 'Email is required',
			validator: (value: string) => value.length > 0,
		},
		{
			id: 'email-format',
			label: 'Must be a valid email address',
			validator: (value: string) => {
				if (value.length === 0) return true; // Don't validate empty
				const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
				return emailRegex.test(value);
			},
		},
	],
	password: [
		{
			id: 'password-required',
			label: 'Password is required',
			validator: (value: string) => value.length > 0,
		},
		{
			id: 'password-length',
			label: 'Must be at least 6 characters',
			validator: (value: string) => value.length >= 6,
		},
		{
			id: 'password-no-spaces',
			label: 'Must not contain spaces',
			validator: (value: string) => !/\s/.test(value),
		},
	],
	fullName: [
		{
			id: 'fullname-required',
			label: 'Full name is required',
			validator: (value: string) => value.length > 0,
		},
	],
	providerName: [
		{
			id: 'name-required',
			label: 'Provider name is required',
			validator: (value: string) => value.length > 0,
		},
	],
	providerIP: [
		{
			id: 'ip-required',
			label: 'IP address is required',
			validator: (value: string) => value.length > 0,
		},
		{
			id: 'ip-format',
			label: 'Must be a valid IP address or hostname',
			validator: (value: string) => {
				if (value.length === 0) return true; // Don't validate empty
				return isValidHostnameOrIP(value);
			},
		},
	],
	username: [
		{
			id: 'username-required',
			label: 'Username is required',
			validator: (value: string) => value.length > 0,
		},
		{
			id: 'username-no-whitespace',
			label: 'Username cannot contain whitespace',
			validator: (value: string) => {
				if (value.length === 0) return true; // Don't validate empty
				return !/\s/.test(value);
			},
		},
	],
	SSHPort: [
		{
			id: 'port-range',
			label: 'Port must be between 1 and 65535',
			validator: (value: string) => {
				if (value.length === 0) return true; // Don't validate empty
				const port = parseInt(value);
				return !isNaN(port) && port >= 1 && port <= 65535;
			},
		},
	],
	tagName: [
		{
			id: 'tag-required',
			label: 'Tag name is required',
			validator: (value: string) => value.length > 0,
		},
		{
			id: 'tag-length',
			label: 'Must be less than 50 characters',
			validator: (value: string) => value.length <= 50,
		},
	],
	color: [
		{
			id: 'color-required',
			label: 'Color is required',
			validator: (value: string) => value.length > 0,
		},
		{
			id: 'color-format',
			label: 'Must be a valid hex color (e.g., #FF0000)',
			validator: (value: string) => {
				if (value.length === 0) return true; // Don't validate empty
				const hexRegex = /^#[0-9A-F]{6}$/i;
				return hexRegex.test(value);
			},
		},
	],
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
