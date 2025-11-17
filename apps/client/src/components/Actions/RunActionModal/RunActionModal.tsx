import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomAction } from '@OpsiMate/custom-actions';
import { useServices, useProviders } from '@/hooks/queries';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

interface RunActionModalProps {
	open: boolean;
	onClose: () => void;
	action: CustomAction | null;
	onRun: (targetId: number, targetType: 'service' | 'provider') => void;
	isRunning: boolean;
}

export const RunActionModal = ({ open, onClose, action, onRun, isRunning }: RunActionModalProps) => {
	const { data: services = [], isLoading: servicesLoading } = useServices();
	const { data: providers = [], isLoading: providersLoading } = useProviders();
	const [selectedTarget, setSelectedTarget] = useState<string>('');

	if (!action) return null;

	const handleRun = () => {
		if (!selectedTarget) return;

		const [targetType, targetId] = selectedTarget.split('-');
		if (targetType === 'service' || targetType === 'provider') {
			onRun(parseInt(targetId), targetType);
		}
	};

	const isLoading = servicesLoading || providersLoading;
	const canRun = selectedTarget && !isRunning;

	const handleOpenChange = (newOpen: boolean) => {
		if (!newOpen && !isRunning) {
			setSelectedTarget('');
			onClose();
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Run Action: {action.name}</DialogTitle>
					<DialogDescription>{action.description || 'Select a target to run this action'}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="target">Select {action.target === 'service' ? 'Service' : 'Provider'}</Label>
						{isLoading ? (
							<div className="flex items-center justify-center py-4">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : (
							<Select value={selectedTarget} onValueChange={setSelectedTarget} disabled={isRunning}>
								<SelectTrigger id="target">
									<SelectValue
										placeholder={`Choose a ${action.target === 'service' ? 'service' : 'provider'}`}
									/>
								</SelectTrigger>
								<SelectContent>
									{action.target === 'service' &&
										services.map((service) => (
											<SelectItem key={service.id} value={`service-${service.id}`}>
												{service.name} ({service.provider.name})
											</SelectItem>
										))}
									{action.target === 'provider' &&
										providers.map((provider) => (
											<SelectItem key={provider.id} value={`provider-${provider.id}`}>
												{provider.name} ({provider.providerType})
											</SelectItem>
										))}
								</SelectContent>
							</Select>
						)}
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isRunning}>
						Cancel
					</Button>
					<Button onClick={handleRun} disabled={!canRun}>
						{isRunning ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Running...
							</>
						) : (
							'Run Action'
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
