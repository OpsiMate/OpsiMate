import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { useCreateCustomAction, useUpdateCustomAction } from '@/hooks/queries/custom-actions';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { ActionBasicForm } from './ActionBasicForm';
import { ActionFormData, ActionModalProps } from './ActionModal.types';
import { BashActionForm } from './BashActionForm';
import { HttpActionForm } from './HttpActionForm';
import { actionToFormData, formDataToAction } from './useActionModal.utils';

interface FormErrors {
	name?: string;
	description?: string;
	url?: string;
	method?: string;
	headers?: string;
}

export const ActionModal = ({ open, onClose, action }: ActionModalProps) => {
	const { toast } = useToast();
	const createMutation = useCreateCustomAction();
	const updateMutation = useUpdateCustomAction();
	const [step, setStep] = useState(1);
	const [formData, setFormData] = useState<ActionFormData>(actionToFormData(action));
	const [errors, setErrors] = useState<FormErrors>({});
	const [headersText, setHeadersText] = useState('');

	useEffect(() => {
		if (open) {
			setFormData(actionToFormData(action));
			setStep(1);
			setErrors({});
			setHeadersText(action && (action as any).type === 'http' && (action as any).headers ? JSON.stringify((action as any).headers, null, 2) : '');
		}
	}, [open, action]);

	useEffect(() => {
		if (formData.headers) {
			setHeadersText(JSON.stringify(formData.headers, null, 2));
		} else {
			setHeadersText('');
		}
	}, [formData.headers]);

	const validateStep1 = (): boolean => {
		const newErrors: FormErrors = {};
		if (!formData.name.trim()) {
			newErrors.name = 'Name is required';
		}
		if (!formData.description.trim()) {
			newErrors.description = 'Description is required';
		}
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const validateStep2 = (): boolean => {
		const newErrors: FormErrors = {};
		if (formData.type === 'http') {
			if (!formData.url?.trim()) {
				newErrors.url = 'URL is required';
			}
			if (!formData.method) {
				newErrors.method = 'Method is required';
			}
		}
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleFormDataChange = (data: Partial<ActionFormData>) => {
		setFormData({ ...formData, ...data });
	};

	const handleHeadersTextChange = (value: string) => {
		setHeadersText(value);
		if (!value.trim()) {
			setFormData({ ...formData, headers: null });
			setErrors({ ...errors, headers: undefined });
			return;
		}
		try {
			const parsed = JSON.parse(value);
			if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
				setFormData({ ...formData, headers: parsed });
				setErrors({ ...errors, headers: undefined });
			} else {
				setErrors({ ...errors, headers: 'Headers must be a valid JSON object' });
			}
		} catch {
			setErrors({ ...errors, headers: 'Invalid JSON format' });
		}
	};

	const handleErrorChange = (newErrors: Partial<FormErrors>) => {
		setErrors({ ...errors, ...newErrors });
	};

	const handleNext = () => {
		if (validateStep1()) {
			setStep(2);
		}
	};

	const handleSubmit = async () => {
		if (!validateStep2()) {
			return;
		}

		try {
			const actionData = formDataToAction(formData);
			if (action) {
				await updateMutation.mutateAsync({ actionId: (action as any).id, action: actionData });
				toast({
					title: 'Success',
					description: 'Action updated successfully',
				});
			} else {
				await createMutation.mutateAsync(actionData);
				toast({
					title: 'Success',
					description: 'Action created successfully',
				});
			}
			onClose();
		} catch (error) {
			toast({
				title: 'Error',
				description: error instanceof Error ? error.message : 'Failed to save action',
				variant: 'destructive',
			});
		}
	};

	const isPending = createMutation.isPending || updateMutation.isPending;

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle>{action ? 'Edit Action' : 'Create New Action'}</DialogTitle>
					<DialogDescription>
						{step === 1 && 'Configure basic action details'}
						{step === 2 && formData.type === 'bash' && 'Configure bash script'}
						{step === 2 && formData.type === 'http' && 'Configure HTTP request'}
					</DialogDescription>
				</DialogHeader>

				<div className="py-4">
					{step === 1 && (
						<ActionBasicForm
							formData={formData}
							errors={errors}
							onChange={handleFormDataChange}
							onErrorChange={handleErrorChange}
						/>
					)}

					{step === 2 && formData.type === 'bash' && (
						<BashActionForm formData={formData} onChange={handleFormDataChange} />
					)}

					{step === 2 && formData.type === 'http' && (
						<HttpActionForm
							formData={formData}
							headersText={headersText}
							errors={errors}
							onChange={handleFormDataChange}
							onHeadersTextChange={handleHeadersTextChange}
							onErrorChange={handleErrorChange}
						/>
					)}
				</div>

				<DialogFooter>
					<div className="flex justify-between w-full">
						{step > 1 && (
							<Button variant="outline" onClick={() => setStep(step - 1)}>
								Previous
							</Button>
						)}
						{step === 1 && <div />}
						<div className="flex gap-2">
							<Button variant="outline" onClick={onClose} disabled={isPending}>
								Cancel
							</Button>
							{step === 2 ? (
								<Button onClick={handleSubmit} disabled={isPending}>
									{isPending ? 'Saving...' : action ? 'Update' : 'Create'}
								</Button>
							) : (
								<Button onClick={handleNext}>
									Next
								</Button>
							)}
						</div>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
