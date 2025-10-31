import { useState, useEffect } from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useCreateCustomAction, useUpdateCustomAction } from '@/hooks/queries/custom-actions';
import { ActionModalProps, ActionFormData } from './ActionModal.types';
import { actionToFormData, formDataToAction } from './useActionModal.utils';
import { Code, Globe } from 'lucide-react';

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

	const handleHeadersChange = (value: string) => {
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
						<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="name">Name</Label>
									<Input
										id="name"
										value={formData.name}
										onChange={(e) => {
											setFormData({ ...formData, name: e.target.value });
											if (errors.name) setErrors({ ...errors, name: undefined });
										}}
										placeholder="Action name"
										className={errors.name ? 'border-destructive' : ''}
									/>
									{errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
								</div>
								<div className="space-y-2">
									<Label htmlFor="description">Description</Label>
									<Textarea
										id="description"
										value={formData.description}
										onChange={(e) => {
											setFormData({ ...formData, description: e.target.value });
											if (errors.description) setErrors({ ...errors, description: undefined });
										}}
										placeholder="Action description"
										rows={3}
										className={errors.description ? 'border-destructive' : ''}
									/>
									{errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
								</div>
								<div className="space-y-2">
									<Label htmlFor="target">Target</Label>
									<Select
										value={formData.target ?? 'service'}
										onValueChange={(value) =>
											setFormData({
												...formData,
												target: value as 'service' | 'provider',
											})
										}
									>
										<SelectTrigger id="target">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="service">Service</SelectItem>
											<SelectItem value="provider">Provider</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label htmlFor="type">Type</Label>
									<Tabs
										value={formData.type}
										onValueChange={(value) =>
											setFormData({ ...formData, type: value as 'bash' | 'http' })
										}
									>
										<TabsList className="grid w-full grid-cols-2">
											<TabsTrigger value="bash" className="gap-2">
												<Code className="h-4 w-4" />
												Bash
											</TabsTrigger>
											<TabsTrigger value="http" className="gap-2">
												<Globe className="h-4 w-4" />
												HTTP
											</TabsTrigger>
										</TabsList>
									</Tabs>
								</div>
							</div>
					)}

					{step === 2 && formData.type === 'bash' && (
						<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="script">Script</Label>
									<Textarea
										id="script"
										value={formData.script ?? ''}
										onChange={(e) =>
											setFormData({ ...formData, script: e.target.value || null })
										}
										placeholder="#!/bin/bash&#10;echo 'Hello World'"
										rows={10}
										className="font-mono text-sm"
									/>
								</div>
							</div>
					)}

					{step === 2 && formData.type === 'http' && (
						<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="url">URL</Label>
									<Input
										id="url"
										value={formData.url ?? ''}
										onChange={(e) => {
											setFormData({ ...formData, url: e.target.value });
											if (errors.url) setErrors({ ...errors, url: undefined });
										}}
										placeholder="https://api.example.com/endpoint"
										className={errors.url ? 'border-destructive' : ''}
									/>
									{errors.url && <p className="text-sm text-destructive">{errors.url}</p>}
								</div>
								<div className="space-y-2">
									<Label htmlFor="method">Method</Label>
									<Select
										value={formData.method ?? 'GET'}
										onValueChange={(value) => {
											setFormData({
												...formData,
												method: value as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
											});
											if (errors.method) setErrors({ ...errors, method: undefined });
										}}
									>
										<SelectTrigger id="method" className={errors.method ? 'border-destructive' : ''}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="GET">GET</SelectItem>
											<SelectItem value="POST">POST</SelectItem>
											<SelectItem value="PUT">PUT</SelectItem>
											<SelectItem value="DELETE">DELETE</SelectItem>
											<SelectItem value="PATCH">PATCH</SelectItem>
										</SelectContent>
									</Select>
									{errors.method && <p className="text-sm text-destructive">{errors.method}</p>}
								</div>
								<div className="space-y-2">
									<Label htmlFor="headers">Headers (JSON)</Label>
									<Textarea
										id="headers"
										value={headersText}
										onChange={(e) => handleHeadersChange(e.target.value)}
										placeholder='{"Content-Type": "application/json"}'
										rows={4}
										className={`font-mono text-sm ${errors.headers ? 'border-destructive' : ''}`}
									/>
									{errors.headers && <p className="text-sm text-destructive">{errors.headers}</p>}
								</div>
								{(formData.method === 'POST' || formData.method === 'PUT' || formData.method === 'PATCH') && (
									<div className="space-y-2">
										<Label htmlFor="body">Body</Label>
										<Textarea
											id="body"
											value={formData.body ?? ''}
											onChange={(e) => setFormData({ ...formData, body: e.target.value || null })}
											placeholder="Request body"
											rows={6}
											className="font-mono text-sm"
										/>
									</div>
								)}
							</div>
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
