import { ServiceConfig } from '@/components/AddServiceDialog';
import { Provider as SharedProvider } from '@OpsiMate/shared';

export interface Provider extends SharedProvider {
	services?: ServiceConfig[];
	status?: 'online' | 'offline' | 'warning' | 'unknown';
}

export type ProviderCategory = 'all' | 'server' | 'kubernetes' | 'cloud';
