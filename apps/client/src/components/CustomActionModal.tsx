import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { useCreateCustomAction, useUpdateCustomAction } from '@/hooks/queries/custom-actions';
import { useToast } from '@/hooks/use-toast';
import { CustomAction } from '@OpsiMate/shared';
import Editor from '@monaco-editor/react';

interface CustomActionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingAction?: CustomAction | null;
}

export const CustomActionModal: React.FC<CustomActionModalProps> = ({
    open,
    onOpenChange,
    editingAction,
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [script, setScript] = useState('');
    const [language, setLanguage] = useState('shell');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const createAction = useCreateCustomAction();
    const updateAction = useUpdateCustomAction();
    const { toast } = useToast();

    const isEditing = !!editingAction;

    // Reset form when modal opens/closes or editing action changes
    useEffect(() => {
        if (open) {
            if (editingAction) {
                setName(editingAction.name);
                setDescription(editingAction.description || '');
                setScript(editingAction.script);
                setLanguage(editingAction.language);
            } else {
                setName('');
                setDescription('');
                setScript('');
                setLanguage('shell');
            }
        }
    }, [open, editingAction]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!name.trim()) {
            toast({
                title: "Validation Error",
                description: "Action name is required",
                variant: "destructive",
            });
            return;
        }

        if (!script.trim()) {
            toast({
                title: "Validation Error",
                description: "Script content is required",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);

        try {
            if (isEditing && editingAction) {
                await updateAction.mutateAsync({
                    id: editingAction.id,
                    name: name.trim(),
                    description: description.trim() || undefined,
                    script: script.trim(),
                    language,
                });
                toast({
                    title: "Success",
                    description: "Custom action updated successfully",
                });
            } else {
                await createAction.mutateAsync({
                    name: name.trim(),
                    description: description.trim() || undefined,
                    script: script.trim(),
                    language,
                });
                toast({
                    title: "Success",
                    description: "Custom action created successfully",
                });
            }
            onOpenChange(false);
        } catch (error) {
            toast({
                title: "Error",
                description: `Failed to ${isEditing ? 'update' : 'create'} custom action`,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? 'Edit Custom Action' : 'Create Custom Action'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing 
                            ? 'Update your custom action script and settings.'
                            : 'Create a new custom action script that can be executed on your servers.'
                        }
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-4 min-h-0">
                    <div className="grid grid-cols-2 gap-4 flex-shrink-0">
                        <div className="space-y-2">
                            <Label htmlFor="action-name">Action Name *</Label>
                            <Input
                                id="action-name"
                                placeholder="My Custom Action"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={isSubmitting}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="action-language">Language</Label>
                            <Select value={language} onValueChange={setLanguage} disabled={isSubmitting}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select language" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="shell">Shell</SelectItem>
                                    <SelectItem value="bash">Bash</SelectItem>
                                    <SelectItem value="python">Python</SelectItem>
                                    <SelectItem value="javascript">JavaScript</SelectItem>
                                    <SelectItem value="powershell">PowerShell</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2 flex-shrink-0">
                        <Label htmlFor="action-description">Description</Label>
                        <Textarea
                            id="action-description"
                            placeholder="Describe what this action does..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={isSubmitting}
                            rows={2}
                        />
                    </div>

                    <div className="space-y-2 flex-1 flex flex-col min-h-0">
                        <Label htmlFor="action-script">Script *</Label>
                        <div className="flex-1 border rounded-md overflow-hidden">
                            <Editor
                                height="100%"
                                language={language}
                                value={script}
                                onChange={(value) => setScript(value || '')}
                                theme="vs-dark"
                                options={{
                                    minimap: { enabled: false },
                                    scrollBeyondLastLine: false,
                                    fontSize: 14,
                                    lineNumbers: 'on',
                                    wordWrap: 'on',
                                    automaticLayout: true,
                                }}
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex-shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting 
                                ? (isEditing ? 'Updating...' : 'Creating...') 
                                : (isEditing ? 'Update Action' : 'Create Action')
                            }
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
