import { DashboardLayout } from '@/components/DashboardLayout';

export const ProfileLoadingState = () => {
	return (
		<DashboardLayout>
			<div className="flex items-center justify-center h-full">
				<div className="text-lg">Loading profile...</div>
			</div>
		</DashboardLayout>
	);
};
