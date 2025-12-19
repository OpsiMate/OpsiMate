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
			<div className="rounded-full bg-green-100 p-6 mb-4">
				<Bell className="h-12 w-12 text-green-600" />
			</div>
			<h3 className="text-lg font-semibold mb-2 text-foreground">You're All Set!</h3>
			<p className="text-sm text-muted-foreground text-center max-w-md mb-6">
				Everything's running smoothly. No alerts to worry about right now.
			</p>

			<div className="mt-4 p-4 bg-muted rounded-lg max-w-md">
				<p className="text-sm text-muted-foreground text-center mb-3">
					Want to stay on top of issues? Connect your monitoring tools to receive alerts here.
				</p>
				<Button onClick={handleGoToIntegrations} variant="outline" className="w-full">
					Connect Alert Integration
				</Button>
			</div>
		</div>
	);
};
