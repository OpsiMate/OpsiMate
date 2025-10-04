import React, { useState } from 'react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { FileDropzone } from './ui/file-dropzone';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Plus, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createSecretOnServer } from '@/lib/sslKeys';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from './ui/dialog';

interface AddSecretModalProps {
    triggerText?: string;
    secretType?: 'ssh' | 'kubeconfig';
    onSecretCreated?: (secretId: number) => void;
    children?: React.ReactNode;
}

export function AddSecretModal({ 
    triggerText = "Add Secret", 
    secretType: defaultSecretType = 'ssh',
    onSecretCreated,
    children 
}: AddSecretModalProps) {
    const [open, setOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const [displayName, setDisplayName] = useState<string>("");
    const [secretType, setSecretType] = useState<'ssh' | 'kubeconfig'>(defaultSecretType);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isFileValid, setIsFileValid] = useState<boolean | null>(null);
    const { toast } = useToast();

    const handleFile = async (file: File) => {
        setIsFileValid(true);
        setSelectedFile(file);
        setFileName(file.name);
    };

    const handleSave = async () => {
        if (!selectedFile) return;

        setUploading(true);
        try {
            const name = displayName.trim() || fileName || "key";
            const result = await createSecretOnServer(name, selectedFile, secretType);

            if (result.success && result.id) {
                toast({
                    title: "Success",
                    description: "Secret created successfully",
                });
                
                // Notify parent component of new secret
                if (onSecretCreated) {
                    onSecretCreated(result.id);
                }
                
                // Dispatch global event for other components
                window.dispatchEvent(new Event('secrets-updated'));
                
                setOpen(false);
                resetForm();
            } else {
                toast({
                    title: "Error",
                    description: result.error || "Failed to create secret",
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error('Error creating secret:', error);
            toast({
                title: "Error",
                description: "An unexpected error occurred while creating the secret",
                variant: "destructive",
            });
        } finally {
            setUploading(false);
        }
    };

    const resetForm = () => {
        setFileName(null);
        setDisplayName("");
        setSecretType(defaultSecretType);
        setSelectedFile(null);
        setIsFileValid(null);
    };

    return (
        <Dialog open={open} onOpenChange={(newOpen) => {
            setOpen(newOpen);
            if (!newOpen) {
                resetForm();
            }
        }}>
            <DialogTrigger asChild>
                {children || (
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        {triggerText}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Secret</DialogTitle>
                    <DialogDescription>
                        Upload a secret file (SSH key or kubeconfig). It will be encrypted and stored securely.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-2">
                        <Label htmlFor="secret-name">Secret name</Label>
                        <Input 
                            id="secret-name" 
                            placeholder={secretType === 'kubeconfig' ? "My Kubeconfig" : "My SSH Key"}
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="secret-type">Type</Label>
                        <Select value={secretType}
                                onValueChange={(value: 'ssh' | 'kubeconfig') => setSecretType(value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ssh">SSH Key</SelectItem>
                                <SelectItem value="kubeconfig">Kubeconfig</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <FileDropzone
                        id="secret-upload"
                        accept="*"
                        loading={uploading}
                        onFile={handleFile}
                        multiple={false}
                    />
                    {fileName && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                                <span>Selected: <b>{fileName}</b></span>
                                {isFileValid !== null && (
                                    isFileValid ? (
                                        <Check className="h-4 w-4 text-green-600" />
                                    ) : (
                                        <X className="h-4 w-4 text-red-600" />
                                    )
                                )}
                            </div>
                            {isFileValid === false && (
                                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                                    <X className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm text-red-700">
                                        <p className="font-medium">Invalid file format</p>
                                        <p className="text-red-600 mt-1">
                                            This file doesn't appear to be a valid secret file. Please ensure you're
                                            uploading an SSH key or kubeconfig file.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button 
                        disabled={!fileName || isFileValid === false || uploading} 
                        onClick={handleSave}
                    >
                        {uploading ? "Creating..." : "Save"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}