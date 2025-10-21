import { Filters } from '@/components/Dashboard';

export interface SavedView {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  filters: Filters;
  visibleColumns: Record<string, boolean>;
  searchTerm: string;
  isDefault?: number;
}
