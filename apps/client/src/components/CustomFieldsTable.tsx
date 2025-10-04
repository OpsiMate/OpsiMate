import React, { useState, useMemo } from 'react';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Trash2, Edit, Plus, Search, X } from 'lucide-react';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
    AlertDialog,
    AlertDialogTrigger,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogAction,
    AlertDialogCancel
} from './ui/alert-dialog';
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
    const [searchQuery, setSearchQuery] = useState('');

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

    // Filter fields based on search
    const filteredFields = useMemo(() => {
        if (!customFields) return [];
        return customFields.filter(field => {
            const matchesSearch = field.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesSearch;
        });
    }, [customFields, searchQuery]);

    const clearFilters = () => {
        setSearchQuery('');
    };

    const hasActiveFilters = searchQuery;

    if (isLoading) {
        return <div className="py-6 text-center">Loading custom fields...</div>;
    }

    if (error) {
        return <div className="py-6 text-center text-red-600">Error loading custom fields</div>;
    }

    if (!customFields || customFields.length === 0) {
        return (
            <>
                <div className="py-6 text-center">
                    <div className="text-muted-foreground mb-4">No custom fields created yet.</div>
                    <Button onClick={() => setShowCreateModal(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Field
                    </Button>
                </div>
                <CustomFieldModal
                    open={showCreateModal}
                    onOpenChange={handleCloseModal}
                />
            </>
        );
    }

    return (
        <>
            {/* Search Section */}
            <div className="space-y-3 mb-4">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                            placeholder="Search custom fields..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    {searchQuery && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            Clear
                        </Button>
                    )}
                </div>

                <div className="flex gap-2 items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        Showing {filteredFields.length} of {customFields.length} fields
                    </div>

                    <Button onClick={() => setShowCreateModal(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Field
                    </Button>
                </div>
            </div>

            {filteredFields.length === 0 ? (
                <div className="py-12 text-center">
                    <Search className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground font-medium">No custom fields found</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        {hasActiveFilters ? 'Try adjusting your search' : 'No custom fields match your criteria'}
                    </p>
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Field Name</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredFields.map(field => (
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
                                                        Are you sure you want to delete "<b>{field.name}</b>"? This action
                                                        cannot be undone and will remove this field from all services.
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
            )}
            <CustomFieldModal
                open={showCreateModal || !!editingField}
                onOpenChange={handleCloseModal}
                editingField={editingField}
            />
        </>
    );
};