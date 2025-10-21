import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SavedView } from '@/types/SavedView';
import { Filters } from '@/components/Dashboard';
import { BookmarkPlus, Check, ChevronDown, Edit, Search, Trash, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SavedViewsManagerProps {
  currentFilters: Filters;
  currentVisibleColumns: Record<string, boolean>;
  currentSearchTerm: string;
  savedViews: SavedView[];
  onSaveView: (view: SavedView) => Promise<void>;
  onDeleteView: (viewId: string) => Promise<void>;
  onLoadView: (view: SavedView) => Promise<void>;
  activeViewId?: string;
}

export const SavedViewsManager = ({
  currentFilters,
  currentVisibleColumns,
  currentSearchTerm,
  savedViews,
  onSaveView,
  onDeleteView,
  onLoadView,
  activeViewId,
}: SavedViewsManagerProps) => {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [viewDescription, setViewDescription] = useState('');
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const hasActiveFilters = useMemo(() => {
    return (
      Object.values(currentFilters).some(
        filterValues => Array.isArray(filterValues) && filterValues.length > 0
      ) || currentSearchTerm.trim() !== ''
    );
  }, [currentFilters, currentSearchTerm]);

  const displayViewName = useMemo(() => {
    if (activeViewId) {
      const view = savedViews.find(v => v.id === activeViewId);
      return view?.name || 'Current View';
    }
    if (hasActiveFilters) {
      return 'Custom View';
    }
    return 'All Services';
  }, [activeViewId, savedViews, hasActiveFilters]);

  const filteredViews = useMemo(() => {
    if (!searchQuery.trim()) return savedViews;

    const query = searchQuery.toLowerCase();
    return savedViews.filter(
      view =>
        view.name.toLowerCase().includes(query) ||
        (view.description && view.description.toLowerCase().includes(query))
    );
  }, [savedViews, searchQuery]);

  const handleSaveView = async () => {
    if (!viewName.trim()) {
      toast({
        title: 'Error',
        description: 'View name is required',
        variant: 'destructive',
      });
      return;
    }

    const newView: SavedView = {
      id: editingViewId || crypto.randomUUID(),
      name: viewName,
      description: viewDescription,
      createdAt: new Date().toISOString(),
      filters: currentFilters,
      visibleColumns: currentVisibleColumns,
      searchTerm: currentSearchTerm,
    };

    try {
      await onSaveView(newView);
      setIsDialogOpen(false);
      resetForm();

      toast({
        title: 'View Saved',
        description: `"${viewName}" has been saved successfully.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save view. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleEditView = (view: SavedView) => {
    setViewName(view.name);
    setViewDescription(view.description || '');
    setEditingViewId(view.id);
    setIsDialogOpen(true);
  };

  const handleDeleteView = async (view: SavedView) => {
    try {
      await onDeleteView(view.id);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete view',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setViewName('');
    setViewDescription('');
    setEditingViewId(null);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  return (
    <div>
      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline' className='gap-2'>
              <span className='flex items-center gap-1'>
                {activeViewId && <Check className='h-4 w-4' />}
                {displayViewName}
              </span>
              <ChevronDown className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-72'>
            <div className='px-2 py-2'>
              <div className='relative'>
                <Search className='absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder='Search views...'
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className='pl-8 pr-8 h-8'
                />
                {searchQuery && (
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => setSearchQuery('')}
                    className='absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0'
                  >
                    <Trash className='h-3 w-3' />
                  </Button>
                )}
              </div>
            </div>
            <DropdownMenuLabel className='flex justify-between items-center'>
              <span>Saved Views</span>
              {savedViews.length > 0 && (
                <span className='text-xs text-muted-foreground'>
                  {filteredViews.length} of {savedViews.length}
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {filteredViews.length === 0 ? (
              <DropdownMenuItem disabled>
                {savedViews.length === 0 ? 'No saved views' : 'No matching views'}
              </DropdownMenuItem>
            ) : (
              filteredViews.map(view => (
                <DropdownMenuItem
                  key={view.id}
                  className='flex justify-between items-center'
                  onSelect={async e => {
                    e.preventDefault();
                    try {
                      await onLoadView(view);
                    } catch (error) {
                      toast({
                        title: 'Error',
                        description: 'Failed to apply view',
                        variant: 'destructive',
                      });
                    }
                  }}
                >
                  <span className='flex-1 truncate'>{view.name}</span>
                  <div className='flex gap-1'>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-6 w-6'
                      onClick={e => {
                        e.stopPropagation();
                        handleEditView(view);
                      }}
                    >
                      <Edit className='h-3 w-3' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-6 w-6 text-destructive'
                      onClick={async e => {
                        e.stopPropagation();
                        try {
                          await onDeleteView(view.id);
                        } catch (error) {
                          toast({
                            title: 'Error',
                            description: 'Failed to delete view',
                            variant: 'destructive',
                          });
                        }
                      }}
                    >
                      <Trash className='h-3 w-3' />
                    </Button>
                  </div>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DialogTrigger asChild>
              <DropdownMenuItem onSelect={e => e.preventDefault()}>
                <BookmarkPlus className='mr-2 h-4 w-4' />
                <span>Save Current View</span>
              </DropdownMenuItem>
            </DialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>

        <DialogContent className='sm:max-w-[425px]'>
          <DialogHeader>
            <DialogTitle>{editingViewId ? 'Edit View' : 'Save Current View'}</DialogTitle>
            <DialogDescription>
              Save your current filters, column selections, and search term for quick access later.
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='name' className='text-right'>
                Name
              </Label>
              <Input
                id='name'
                value={viewName}
                onChange={e => setViewName(e.target.value)}
                className='col-span-3'
                placeholder='My Custom View'
              />
            </div>
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='description' className='text-right'>
                Description
              </Label>
              <Textarea
                id='description'
                value={viewDescription}
                onChange={e => setViewDescription(e.target.value)}
                className='col-span-3'
                placeholder='Optional description of this view'
              />
            </div>
          </div>
          <DialogFooter>
            <Button type='submit' onClick={handleSaveView}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
