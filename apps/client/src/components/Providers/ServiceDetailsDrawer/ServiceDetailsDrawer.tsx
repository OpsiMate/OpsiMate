import { RightSidebarWithLogs } from '@/components/RightSidebarWithLogs';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import type { Service } from '@/components/ServiceTable';

interface ServiceDetailsDrawerProps {
	open: boolean;
	service: Service | null;
	onClose: () => void;
}

export const ServiceDetailsDrawer = ({ open, service, onClose }: ServiceDetailsDrawerProps) => {
	return (
		<Sheet open={open} onOpenChange={onClose}>
			<SheetContent side="right" className="w-[400px] p-0" closable={false}>
				{service && <RightSidebarWithLogs service={service} onClose={onClose} collapsed={false} />}
			</SheetContent>
		</Sheet>
	);
};
