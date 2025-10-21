import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { providerApi } from '@/lib/api';
import { Tag } from '@OpsiMate/shared';

interface CreateTagDialogProps {
  open: boolean;
  onClose: () => void;
  onTagCreated: (tag: Tag) => void;
}

const predefinedColors = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // yellow
  '#8B5CF6', // purple
  '#F97316', // orange
  '#06B6D4', // cyan
  '#EC4899', // pink
  '#84CC16', // lime
  '#6B7280', // gray
];

export const CreateTagDialog = ({ open, onClose, onTagCreated }: CreateTagDialogProps) => {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState(predefinedColors[0]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Tag name is required',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await providerApi.createTag({ name: name.trim(), color });

      if (response.success && response.data) {
        onTagCreated(response.data);
        toast({
          title: 'Success',
          description: 'Tag created successfully',
        });
        handleClose();
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Failed to create tag',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create tag',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setColor(predefinedColors[0]);
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Create New Tag</DialogTitle>
          <DialogDescription>
            Create a new tag to organize your services. Choose a name and color for your tag.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className='grid gap-4 py-4'>
            <div className='grid gap-2'>
              <Label htmlFor='name'>Tag Name</Label>
              <Input
                id='name'
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder='Enter tag name'
                maxLength={50}
              />
            </div>
            <div className='grid gap-2'>
              <Label>Color</Label>
              <div className='flex flex-wrap gap-2'>
                {predefinedColors.map(colorOption => (
                  <button
                    key={colorOption}
                    type='button'
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      color === colorOption
                        ? 'border-gray-800 scale-110'
                        : 'border-gray-300 hover:border-gray-500'
                    }`}
                    style={{ backgroundColor: colorOption }}
                    onClick={() => setColor(colorOption)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={handleClose}>
              Cancel
            </Button>
            <Button type='submit' disabled={loading || !name.trim()}>
              {loading ? 'Creating...' : 'Create Tag'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
