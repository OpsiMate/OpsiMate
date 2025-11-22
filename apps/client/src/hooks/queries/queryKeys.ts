// Query keys for consistent caching across the application
export const queryKeys = {
	services: ['services'] as const,
	alerts: ['alerts'] as const,
	providers: ['providers'] as const,
	tags: ['tags'] as const,
	integrations: ['integrations'] as const,
	views: ['views'] as const,
	usersExist: ['usersExist'] as const,
	customActions: ['customActions'] as const,
	service: (id: number) => ['service', id] as const,
	provider: (id: number) => ['provider', id] as const,
	serviceLogs: (id: number) => ['serviceLogs', id] as const,
	serviceTags: (id: number) => ['serviceTags', id] as const,
	auditLogs: (page: number, pageSize: number) => ['audit', page, pageSize] as const,
	customAction: (id: number) => ['customAction', id] as const,
};
