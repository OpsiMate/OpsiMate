// Query keys for consistent caching across the application
export const queryKeys = {
  services: ['services'] as const,
  alerts: ['alerts'] as const,
  providers: ['providers'] as const,
  tags: ['tags'] as const,
  integrations: ['integrations'] as const,
  views: ['views'] as const,
  usersExist: ['usersExist'] as const,
  service: (id: number) => ['service', id] as const,
  provider: (id: number) => ['provider', id] as const,
  serviceLogs: (id: number, filters?: any) => ['serviceLogs', id, filters ? JSON.stringify(filters) : 'all'] as const,
  serviceTags: (id: number) => ['serviceTags', id] as const,
  auditLogs: (page: number, pageSize: number) => ['audit', page, pageSize] as const,
}; 