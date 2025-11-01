import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ActionFormData } from '../ActionModal.types';

interface BashActionFormProps {
	formData: ActionFormData;
	onChange: (data: Partial<ActionFormData>) => void;
}

export const BashActionForm = ({ formData, onChange }: BashActionFormProps) => {
	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="script">Script</Label>
				<Textarea
					id="script"
					value={formData.script ?? ''}
					onChange={(e) => onChange({ script: e.target.value || null })}
					placeholder="#!/bin/bash&#10;echo 'Hello World'"
					rows={10}
					className="font-mono text-sm"
				/>
			</div>
		</div>
	);
};
