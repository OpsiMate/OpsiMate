import { DashboardLayout } from '@/components/DashboardLayout';

export const ProfileErrorState = () => {
	return (
		<DashboardLayout>
			<div className="flex items-center justify-center h-full">
				<div className="text-lg text-red-500">Failed to load profile</div>
			</div>
		</DashboardLayout>
	);
};
