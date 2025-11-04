import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

interface AccountSectionProps {
	onLogout: () => void;
}

export const AccountSection = ({ onLogout }: AccountSectionProps) => {
	return (
		<div className="border-t pt-6">
			<div className="flex items-center gap-3 mb-4">
				<LogOut className="h-5 w-5 text-gray-500" />
				<h3 className="font-semibold">Account</h3>
			</div>
			<Button
				variant="outline"
				onClick={onLogout}
				className="flex items-center gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
			>
				<LogOut className="h-4 w-4" />
				Logout
			</Button>
		</div>
	);
};
