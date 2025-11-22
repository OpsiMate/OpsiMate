import { Service } from '@/components/ServiceTable';
import { useRunCustomActionForService } from '@/hooks/queries/custom-actions';
import { useToast } from '@/hooks/use-toast';
import { CustomAction } from '@OpsiMate/custom-actions';
import { useState } from 'react';

export const useCustomActionExecution = () => {
	const { toast } = useToast();
	const runActionMutation = useRunCustomActionForService();
	const [isRunning, setIsRunning] = useState(false);

	const handleRunAction = async (action: CustomAction, service: Service) => {
		if (!service.id) {
			toast({
				title: 'Error',
				description: 'Service ID is missing',
				variant: 'destructive',
			});
			return;
		}

		setIsRunning(true);
		try {
			await runActionMutation.mutateAsync({
				serviceId: parseInt(service.id, 10),
				actionId: action.id,
			});

			toast({
				title: 'Success',
				description: `Action "${action.name}" executed successfully on service "${service.name}"`,
			});
		} catch (error) {
			toast({
				title: 'Error',
				description: error instanceof Error ? error.message : 'Failed to execute action',
				variant: 'destructive',
			});
		} finally {
			setIsRunning(false);
		}
	};

	return {
		handleRunAction,
		isRunning,
	};
};
