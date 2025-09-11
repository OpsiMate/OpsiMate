import React, { useState } from 'react';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Trash2, Edit, Plus } from 'lucide-react';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from './ui/alert-dialog';
import { useCustomFields, useDeleteCustomField } from '../hooks/queries/custom-fields';
import { useToast } from '@/hooks/use-toast';
import { ServiceCustomField } from '@OpsiMate/shared';
import { CustomFieldModal } from './CustomFieldModal';

export const CustomFieldsTable: React.FC = () => {
  const { data: customFields, isLoading, error } = useCustomFields();
  const deleteCustomField = useDeleteCustomField();
  const { toast } = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingField, setEditingField] = useState<ServiceCustomField | null>(null);

  const handleDelete = async (fieldId: number, fieldName: string) => {
    try {
      await deleteCustomField.mutateAsync(fieldId);
      toast({
        title: "Success",
        description: `Custom field "${fieldName}" deleted successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to delete custom field "${fieldName}"`,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (field: ServiceCustomField) => {
    setEditingField(field);
  };

  const handleCloseModal = (open: boolean) => {
    setShowCreateModal(open);
    if (!open) {
      setEditingField(null);
    }
  };

  if (isLoading) {
    return <div className="py-6 text-center">Loading custom fields...</div>;
  }

  if (error) {
    return <div className="py-6 text-center text-red-600">Error loading custom fields</div>;
  }

  if (!customFields || customFields.length === 0) {
    return (
      <div className="py-6 text-center">
        <div className="text-muted-foreground mb-4">No custom fields created yet.</div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create First Field
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">
          {customFields.length} custom field{customFields.length !== 1 ? 's' : ''} available
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Field
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Field Name</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customFields.map(field => (
            <TableRow key={field.id}>
              <TableCell>
                <div className="font-medium">{field.name}</div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {new Date(field.createdAt).toLocaleDateString()}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(field)}
                    title="Edit custom field"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete custom field"
                        disabled={deleteCustomField.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Custom Field</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "<b>{field.name}</b>"? This action cannot be undone and will remove this field from all services.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteCustomField.isPending}>
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700 focus:ring-red-400"
                          disabled={deleteCustomField.isPending}
                          onClick={() => handleDelete(field.id, field.name)}
                        >
                          {deleteCustomField.isPending ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CustomFieldModal
        open={showCreateModal || !!editingField}
        onOpenChange={handleCloseModal}
        editingField={editingField}
      />
    </>
  );
};
