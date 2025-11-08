import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRef } from 'react';
import { ActionFormData } from '../ActionModal.types';
import { CustomFieldSelector } from './CustomFieldSelector';

interface BashActionFormProps {
	formData: ActionFormData;
	onChange: (data: Partial<ActionFormData>) => void;
}

export const BashActionForm = ({ formData, onChange }: BashActionFormProps) => {
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleCustomFieldSelect = (fieldName: string) => {
		if (!fieldName) return;

		const textarea = textareaRef.current;
		if (!textarea) return;

		const currentValue = formData.script ?? '';
		const cursorPosition = textarea.selectionStart;
		const insertText = `\${${fieldName}}`;

		const newValue = currentValue.slice(0, cursorPosition) + insertText + currentValue.slice(cursorPosition);

		onChange({ script: newValue || null });

		setTimeout(() => {
			textarea.focus();
			const newCursorPosition = cursorPosition + insertText.length;
			textarea.setSelectionRange(newCursorPosition, newCursorPosition);
		}, 0);
	};

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label htmlFor="script">Script</Label>
					<CustomFieldSelector onFieldSelect={handleCustomFieldSelect} />
				</div>
				<Textarea
					ref={textareaRef}
					id="script"
					value={formData.script ?? ''}
					onChange={(e) => onChange({ script: e.target.value || null })}
					placeholder="#!/bin/bash&#10;echo 'Hello World'&#10;&#10;Use custom fields like: ${fieldName}"
					rows={10}
					className="font-mono text-sm"
				/>
			</div>
		</div>
	);
};
