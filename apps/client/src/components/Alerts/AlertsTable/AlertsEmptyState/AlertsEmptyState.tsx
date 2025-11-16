import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AlertsEmptyState = () => {
	const navigate = useNavigate();

	const handleGoToIntegrations = () => {
		navigate('/integrations?category=alerts');
	};

	return (
		<div className="flex flex-col items-center justify-center py-12 px-4">
			<div className="rounded-full bg-muted p-6 mb-4">
				<Bell className="h-12 w-12 text-muted-foreground" />
			</div>
			<h3 className="text-lg font-semibold mb-2">No Alerts Connected</h3>
			<p className="text-sm text-muted-foreground text-center max-w-md mb-6">
				You don't have any alert integrations set up yet. Connect your monitoring tools to start receiving
				alerts.
			</p>
			<Button onClick={handleGoToIntegrations}>Connect Alert Integration</Button>
		</div>
	);
};
