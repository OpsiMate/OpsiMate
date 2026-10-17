import type { ReactNode } from 'react';

interface SettingsSectionHeaderProps {
	title: string;
	description: ReactNode;
}

export const SettingsSectionHeader = ({ title, description }: SettingsSectionHeaderProps) => (
	<div>
		<h2 className="text-2xl font-semibold text-foreground">{title}</h2>
		<p className="text-muted-foreground">{description}</p>
	</div>
);
