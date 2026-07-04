import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Info, MessageSquare } from 'lucide-react';

export const PanelTabsList = () => (
	<TabsList className="mx-4 mt-3 grid w-auto grid-cols-2">
		<TabsTrigger value="details" className="gap-1.5">
			<Info className="h-4 w-4" />
			Details
		</TabsTrigger>
		<TabsTrigger value="comments" className="gap-1.5">
			<MessageSquare className="h-4 w-4" />
			Comments
		</TabsTrigger>
	</TabsList>
);
