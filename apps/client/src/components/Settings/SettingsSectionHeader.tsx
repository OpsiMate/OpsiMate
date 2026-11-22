import { ReactNode } from 'react';

export interface SettingsSectionHeaderProps {
	title: string;
	description: ReactNode;
}

// One header for every Settings tab, so the top of each tab looks the same.
// Headings that sit *inside* a tab (LDAP, Root cause) keep their smaller size.
export const SettingsSectionHeader = ({ title, description }: SettingsSectionHeaderProps) => (
	<div>
		<h2 className="text-2xl font-semibold text-foreground">{title}</h2>
		<p className="text-muted-foreground">{description}</p>
	</div>
);
