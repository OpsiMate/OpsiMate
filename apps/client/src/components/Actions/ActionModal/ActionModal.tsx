import { Button } from '@/components/ui/button';
import { useCreateCustomAction, useUpdateCustomAction } from '@/hooks/queries/custom-actions';
import { useToast } from '@/hooks/use-toast';
import {
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
} from '@chakra-ui/react';
import { CustomAction } from '@OpsiMate/custom-actions';
import { useEffect, useState } from 'react';
import { ActionBasicForm } from './ActionBasicForm';
import { ActionFormData, FormErrors } from './ActionModal.types';
import { BashActionForm } from './BashActionForm';
import { HttpActionForm } from './HttpActionForm';
import { actionToFormData, formDataToAction } from './useActionModal.utils';

type HeaderPair = { key: string; value: string };

const headersToPairs = (headers: Record<string, string> | null | undefined): HeaderPair[] => {
	if (!headers) return [];
	return Object.entries(headers).map(([key, value]) => ({ key, value }));
};

interface ActionModalProps {
	open: boolean;
	onClose: () => void;
	action?: CustomAction;
}

export const ActionModal = ({ open, onClose, action }: ActionModalProps) => {
	const { toast } = useToast();
	const createMutation = useCreateCustomAction();
	const updateMutation = useUpdateCustomAction();

	const [step, setStep] = useState(1);
	const [formData, setFormData] = useState<ActionFormData>(actionToFormData(action));
	const [errors, setErrors] = useState<FormErrors>({});
	const [headersPairs, setHeadersPairs] = useState<HeaderPair[]>([]);

	useEffect(() => {
		if (open) {
			const newFormData = actionToFormData(action);
			setFormData(newFormData);
			setStep(1);
			setErrors({});
			setHeadersPairs(headersToPairs(newFormData.headers));
		}
	}, [open, action]);

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

	const handleHeadersPairsChange = (pairs: HeaderPair[]) => {
		setHeadersPairs(pairs);
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
				await updateMutation.mutateAsync({ actionId: action.id, action: actionData });
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

	const dialogDescription =
		step === 1
			? 'Configure basic action details'
			: step === 2 && formData.type === 'bash'
				? 'Configure bash script'
				: step === 2 && formData.type === 'http'
					? 'Configure HTTP request'
					: '';

	const renderFormContent = () => {
		if (step === 1) {
			return (
				<ActionBasicForm
					formData={formData}
					errors={errors}
					onChange={handleFormDataChange}
					onErrorChange={handleErrorChange}
				/>
			);
		}
		if (formData.type === 'bash') {
			return <BashActionForm formData={formData} onChange={handleFormDataChange} />;
		}
		return (
			<HttpActionForm
				formData={formData}
				headersPairs={headersPairs}
				errors={errors}
				onChange={handleFormDataChange}
				onHeadersPairsChange={handleHeadersPairsChange}
				onErrorChange={handleErrorChange}
			/>
		);
	};

	return (
		<Modal isOpen={open} onClose={onClose} isCentered>
			<ModalOverlay />
			<ModalContent maxW="600px">
				<ModalCloseButton />
				<ModalHeader pb={4}>
					<h2 className="text-lg font-semibold leading-none tracking-tight">
						{action ? 'Edit Action' : 'Create New Action'}
					</h2>
					<p className="text-sm text-muted-foreground mt-1.5">{dialogDescription}</p>
				</ModalHeader>

				<ModalBody pt={0}>{renderFormContent()}</ModalBody>

				<ModalFooter pt={4}>
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
								<Button onClick={handleNext}>Next</Button>
							)}
						</div>
					</div>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
};
