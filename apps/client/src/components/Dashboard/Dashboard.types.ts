import { Alert } from '@OpsiMate/shared';
import { Service } from '../ServiceTable';

export interface ServiceWithAlerts extends Service {
	alertsCount: number;
	serviceAlerts: Alert[];
}

export interface ColumnVisibility {
	name: boolean;
	serviceIP: boolean;
	serviceStatus: boolean;
	provider: boolean;
	containerDetails: boolean;
	tags: boolean;
	alerts: boolean;
	[key: string]: boolean;
}
