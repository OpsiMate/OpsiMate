import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProviderCategory } from '../Providers.types';

interface ProviderTabsProps {
	activeTab: ProviderCategory;
	onTabChange: (tab: ProviderCategory) => void;
}

export const ProviderTabs = ({ activeTab, onTabChange }: ProviderTabsProps) => {
	return (
		<Tabs
			value={activeTab}
			onValueChange={(value) => onTabChange(value as ProviderCategory)}
			className="p-4 bg-background"
		>
			<TabsList>
				<TabsTrigger value="all">All</TabsTrigger>
				<TabsTrigger value="server">Servers</TabsTrigger>
				<TabsTrigger value="kubernetes">Kubernetes</TabsTrigger>
				<TabsTrigger value="cloud">Cloud</TabsTrigger>
			</TabsList>
		</Tabs>
	);
};
