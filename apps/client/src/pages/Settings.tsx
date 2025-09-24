import React, {useState, useEffect} from 'react';
import {Button} from '../components/ui/button';
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '../components/ui/table';
import {Badge} from '../components/ui/badge';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '../components/ui/select';
import {Card, CardContent, CardHeader, CardTitle} from '../components/ui/card';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '../components/ui/tabs';
import {apiRequest} from '../lib/api';
import {User, Role} from '../types';
import {getCurrentUser} from '../lib/auth';
import {ErrorAlert} from '../components/ErrorAlert';
import {useFormErrors} from '../hooks/useFormErrors';
import {Users, FileText, KeyRound, Trash2, Plus, Check, X, Edit} from 'lucide-react';
import {DashboardLayout} from '../components/DashboardLayout';
import {AddUserModal} from '../components/AddUserModal';
import {auditApi} from '../lib/api';
import {FileDropzone} from "@/components/ui/file-dropzone";
import {getSecretsFromServer, createSecretOnServer, deleteSecretOnServer, updateSecretOnServer } from "@/lib/sslKeys";
import {SecretMetadata, SecretType} from "@OpsiMate/shared";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
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
} from '../components/ui/alert-dialog';
import {AuditLog} from "@OpsiMate/shared";
import {useToast} from "@/hooks/use-toast";
import {Settings as SettingsIcon} from "lucide-react";
import {CustomFieldsTable} from "../components/CustomFieldsTable";

const PAGE_SIZE = 20;

const Settings: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingUser, setUpdatingUser] = useState<string | null>(null);
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const {generalError, clearErrors, handleApiResponse} = useFormErrors();
    const currentUser = getCurrentUser();
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await apiRequest<User[]>('/users', 'GET');
            if (response.success && response.data) {
                setUsers(response.data);
            } else {
                handleApiResponse(response);
            }
        } catch (error) {
            handleApiResponse({
                success: false,
                error: 'Failed to fetch users'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleRoleUpdate = async (email: string, newRole: Role) => {
        setUpdatingUser(email);
        clearErrors();

        try {
            const response = await apiRequest('/users/role', 'PATCH', {email, newRole});
            if (response.success) {
                // Update the local state
                setUsers(prevUsers =>
                    prevUsers.map(user =>
                        user.email === email ? {...user, role: newRole as Role} : user
                    )
                );
            } else {
                handleApiResponse(response);
            }
        } catch (error) {
            handleApiResponse({
                success: false,
                error: 'Failed to update user role'
            });
        } finally {
            setUpdatingUser(null);
        }
    };

    const handleUserCreated = (newUser: User) => {
        setUsers(prevUsers => [...prevUsers, newUser]);
    };

    const getRoleBadgeVariant = (role: Role) => {
        switch (role) {
            case Role.Admin:
                return 'destructive';
            case Role.Editor:
                return 'default';
            case Role.Viewer:
                return 'secondary';
            default:
                return 'outline';
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const isAdmin = currentUser?.role === Role.Admin;

    const handleDeleteUser = async (userId: number) => {
        setDeleting(true);
        try {
            const response = await apiRequest(`/users/${userId}`, 'DELETE');
            if (response.success) {
                setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
                setUserToDelete(null);
            } else {
                handleApiResponse(response);
            }
        } catch (error) {
            handleApiResponse({success: false, error: 'Failed to delete user'});
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg">Loading settings...</div>
            </div>
        );
    }

    return (
        <DashboardLayout>
            <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex-shrink-0 bg-background border-b border-border px-6 py-4">
                    <h1 className="text-2xl font-bold">Settings</h1>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    <div className="max-w-6xl mx-auto">

                        {generalError && <ErrorAlert message={generalError} className="mb-6"/>}

                        <Tabs defaultValue={(function () {
                            const h = (location.hash || '').replace('#', '');
                            if (h === 'Users') return 'users';
                            if (h === 'Audit_Log') return 'audit';
                            if (h === 'secrets') return 'secrets';
                            if (h === 'custom-fields') return 'custom-fields';
                            return 'users';
                        })()} onValueChange={(v) => {
                            const map: Record<string, string> = {
                                users: 'Users',
                                audit: 'Audit_Log',
                                secrets: 'secrets',
                                'custom-fields': 'custom-fields'
                            };
                            const next = map[v] || v;
                            if (next) window.location.hash = next;
                        }} className="space-y-6">
                            <div className="flex gap-6">
                                <div className="w-64 flex-shrink-0">
                                    <TabsList className="flex flex-col items-stretch h-auto p-2 gap-2">
                                        <TabsTrigger value="users" className="justify-start gap-2">
                                            <Users className="h-4 w-4"/>
                                            Users
                                        </TabsTrigger>
                                        <TabsTrigger value="audit" className="justify-start gap-2">
                                            <FileText className="h-4 w-4"/>
                                            Audit Log
                                        </TabsTrigger>
                                        <TabsTrigger value="secrets" className="justify-start gap-2">
                                            <KeyRound className="h-4 w-4"/>
                                            Secrets
                                        </TabsTrigger>
                                        <TabsTrigger value="custom-fields" className="justify-start gap-2">
                                            <SettingsIcon className="h-4 w-4"/>
                                            Custom Service Fields
                                        </TabsTrigger>
                                    </TabsList>
                                </div>
                                <div className="flex-1">

                                    <TabsContent value="users" className="space-y-6">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h2 className="text-2xl font-semibold">User Management</h2>
                                                <p className="text-muted-foreground">Manage user access and permissions
                                                    for your Service instance.</p>
                                            </div>
                                            <Button
                                                onClick={() => setShowAddUserModal(true)}
                                                variant="default"
                                            >
                                                Add User
                                            </Button>
                                        </div>

                                        {/* Users Table */}
                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Current Users</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>User</TableHead>
                                                            <TableHead>Email</TableHead>
                                                            <TableHead>Role</TableHead>
                                                            <TableHead>Created</TableHead>
                                                            <TableHead>Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {users.map((user) => (
                                                            <TableRow key={user.id}>
                                                                <TableCell className="font-medium">
                                                                    {user.fullName}
                                                                    {user.email === currentUser?.email && (
                                                                        <Badge variant="outline"
                                                                               className="ml-2 text-xs">
                                                                            (me)
                                                                        </Badge>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>{user.email}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant={getRoleBadgeVariant(user.role)}>
                                                                        {user.role}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell>{formatDate(user.createdAt)}</TableCell>
                                                                <TableCell>
                                                                    <div className="flex items-center gap-2">
                                                                        <Select
                                                                            value={user.role}
                                                                            onValueChange={(newRole) => handleRoleUpdate(user.email, newRole as Role)}
                                                                            disabled={updatingUser === user.email || user.email === currentUser?.email}
                                                                        >
                                                                            <SelectTrigger className="w-32">
                                                                                <SelectValue/>
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem
                                                                                    value={Role.Viewer}>Viewer</SelectItem>
                                                                                <SelectItem
                                                                                    value={Role.Editor}>Editor</SelectItem>
                                                                                <SelectItem
                                                                                    value={Role.Admin}>Admin</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                        {isAdmin && user.email !== currentUser?.email && (
                                                                            <AlertDialog>
                                                                                <AlertDialogTrigger asChild>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        className="text-red-600 hover:bg-red-100 focus:bg-red-100 focus:ring-2 focus:ring-red-400 ml-auto"
                                                                                        title="Delete user"
                                                                                        onClick={() => setUserToDelete(user)}
                                                                                    >
                                                                                        <Trash2 className="h-4 w-4"/>
                                                                                    </Button>
                                                                                </AlertDialogTrigger>
                                                                                <AlertDialogContent>
                                                                                    <AlertDialogHeader>
                                                                                        <AlertDialogTitle>Delete
                                                                                            User</AlertDialogTitle>
                                                                                        <AlertDialogDescription>
                                                                                            Are you sure you want to
                                                                                            delete <b>{userToDelete?.fullName}</b>?
                                                                                            This action cannot be
                                                                                            undone.
                                                                                        </AlertDialogDescription>
                                                                                    </AlertDialogHeader>
                                                                                    <AlertDialogFooter>
                                                                                        <AlertDialogCancel
                                                                                            disabled={deleting}
                                                                                            onClick={() => setUserToDelete(null)}>
                                                                                            Cancel
                                                                                        </AlertDialogCancel>
                                                                                        <AlertDialogAction
                                                                                            className="bg-red-600 hover:bg-red-700 focus:ring-red-400"
                                                                                            disabled={deleting}
                                                                                            onClick={() => handleDeleteUser(userToDelete!.id)}
                                                                                        >
                                                                                            {deleting ? 'Deleting...' : 'Delete'}
                                                                                        </AlertDialogAction>
                                                                                    </AlertDialogFooter>
                                                                                </AlertDialogContent>
                                                                            </AlertDialog>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent value="audit" className="space-y-6">
                                        <div>
                                            <h2 className="text-2xl font-semibold">Audit Log</h2>
                                            <p className="text-muted-foreground">View activity logs for all dashboard
                                                operations and user actions.</p>
                                        </div>
                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Activity Logs</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <AuditLogTable/>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent value="secrets" className="space-y-6">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h2 className="text-2xl font-semibold">Secrets</h2>
                                                <p className="text-muted-foreground">Manage SSH keys and kubeconfig
                                                    files used to access providers and services securely.</p>
                                            </div>
                                            <AddSecretButton/>
                                        </div>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Secrets</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <SslKeysTable/>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent value="custom-fields" className="space-y-6">
                                        <div>
                                            <h2 className="text-2xl font-semibold">Custom Service Fields</h2>
                                            <p className="text-muted-foreground">Create and manage custom fields for
                                                your services. These fields can store additional information like
                                                environment, version, or any other metadata.</p>
                                        </div>
                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Custom Fields</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <CustomFieldsTable/>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                </div>
                            </div>
                        </Tabs>

                        {/* Add User Modal */}
                        <AddUserModal
                            isOpen={showAddUserModal}
                            onClose={() => setShowAddUserModal(false)}
                            onUserCreated={handleUserCreated}
                        />
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default Settings;

// Helper to parse SQLite UTC timestamp as ISO 8601
function parseUTCDate(dateString: string) {
    return new Date(dateString.replace(' ', 'T') + 'Z');
}

function formatRelativeTime(dateString: string) {
    const now = new Date();
    const date = parseUTCDate(dateString);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000); // in seconds
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minute${Math.floor(diff / 60) === 1 ? '' : 's'} ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hour${Math.floor(diff / 3600) === 1 ? '' : 's'} ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
}

const AuditLogTable: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        auditApi.getAuditLogs(page, PAGE_SIZE).then(res => {
            if (mounted) {
                if (res && Array.isArray(res.logs)) {
                    setLogs(res.logs);
                    setTotal(res.total || 0);
                    setError(null);
                } else {
                    setError(res?.error || 'Failed to fetch audit logs');
                }
                setLoading(false);
            }
        });
        return () => {
            mounted = false;
        };
    }, [page]);

    const totalPages = Math.ceil(total / PAGE_SIZE);

    if (loading) return <div className="py-8 text-center">Loading audit logs...</div>;
    if (error) return <ErrorAlert message={error} className="mb-4"/>;
    if (!logs.length) return <div className="py-8 text-center text-muted-foreground">No audit logs found.</div>;

    // Helper for action badge color
    const getActionBadgeProps = (action: string) => {
        switch (action) {
            case 'CREATE':
                return {variant: 'secondary', className: 'bg-green-100 text-green-800 border-green-200'};
            case 'UPDATE':
                return {variant: 'secondary', className: 'bg-yellow-100 text-yellow-800 border-yellow-200'};
            case 'DELETE':
                return {variant: 'destructive', className: ''};
            default:
                return {variant: 'outline', className: ''};
        }
    };

    return (
        <div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead>Resource Name</TableHead>
                        <TableHead>User</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {logs.map(log => {
                        const actionProps = getActionBadgeProps(log.actionType);
                        return (
                            <TableRow key={log.id}>
                                <TableCell>
                  <span title={parseUTCDate(log.timestamp).toLocaleString()}>
                    {formatRelativeTime(log.timestamp)}
                  </span>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={actionProps.variant as any} className={actionProps.className}>
                                        {log.actionType}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary">{log.resourceType}</Badge>
                                </TableCell>
                                <TableCell>{log.resourceName || '-'}</TableCell>
                                <TableCell>{log.userName || '-'}</TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
            {totalPages > 1 && (
                <div className="flex justify-end items-center gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}>&larr; Prev</Button>
                    <span className="text-sm">Page {page} of {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}>Next &rarr;</Button>
                </div>
            )}
        </div>
    );
};

const AddSecretButton: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const [displayName, setDisplayName] = useState<string>("");
    const [secretType, setSecretType] = useState<'ssh' | 'kubeconfig'>('ssh');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isFileValid, setIsFileValid] = useState<boolean | null>(null);
    const {toast} = useToast();

    const handleFile = async (file: File) => {
        // todo: implement file validation
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

            if (result.success) {
                toast({
                    title: "Success",
                    description: "Secret created successfully",
                });
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
            console.error('Error creating SSL key:', error);
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
        setSecretType('ssh');
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
                <Button>
                    <Plus className="h-4 w-4 mr-2"/> Add Secret
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Secret</DialogTitle>
                    <DialogDescription>Upload a secret file (SSH key or kubeconfig). It will be encrypted and stored
                        securely.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-2">
                        <Label htmlFor="secret-name">Secret name</Label>
                        <Input id="secret-name" placeholder="My SSH Key" value={displayName}
                               onChange={(e) => setDisplayName(e.target.value)}/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="secret-type">Type</Label>
                        <Select value={secretType}
                                onValueChange={(value: 'ssh' | 'kubeconfig') => setSecretType(value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select type"/>
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
                                        <Check className="h-4 w-4 text-green-600"/>
                                    ) : (
                                        <X className="h-4 w-4 text-red-600"/>
                                    )
                                )}
                            </div>
                            {isFileValid === false && (
                                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                                    <X className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0"/>
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
                    <Button disabled={!fileName || isFileValid === false} onClick={handleSave}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const SslKeysTable: React.FC = () => {
    const [secrets, setSecrets] = useState<SecretMetadata[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<number | null>(null);
    const [editingSecretId, setEditingSecretId] = useState<string | null>(null);
    const [editingSecret, setEditingSecret] = useState<SecretMetadata | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    
    const {toast} = useToast();

    const loadSecrets = async () => {
        setLoading(true);
        try {
            const secretsData = await getSecretsFromServer();
            setSecrets(secretsData);
            setError(null);
        } catch (error) {
            console.error('Error loading secrets:', error);
            setError('Failed to load secrets');
        } finally {
            setLoading(false);
        }
    };

    const handleEditSecret = (secret: SecretMetadata) => {
        setEditingSecretId(secret.id.toString());
        setEditingSecret({...secret});
        setEditDialogOpen(true);
    };

    const handleSaveEdit = (updatedSecret: SecretMetadata) => {
        // Update the secrets array
        setSecrets(prevSecrets => 
            prevSecrets.map(secret => 
                secret.id === updatedSecret.id ? updatedSecret : secret
            )
        );

        setEditingSecretId(null);
        setEditingSecret(null);
        setEditDialogOpen(false);
    };

    const handleCancelEdit = () => {
        setEditingSecretId(null);
        setEditingSecret(null);
        setEditDialogOpen(false);
    };

    const handleDeleteSecret = async (secretId: number) => {
        setDeleting(secretId);
        try {
            const result = await deleteSecretOnServer(secretId);
            if (result.success) {
                toast({
                    title: "Success",
                    description: "Secret deleted successfully",
                });
                loadSecrets(); // Refresh the list
            } else {
                toast({
                    title: "Error",
                    description: result.error || "Failed to delete secret",
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error('Error deleting SSL key:', error);
            toast({
                title: "Error",
                description: "An unexpected error occurred while deleting the secret",
                variant: "destructive",
            });
        } finally {
            setDeleting(null);
        }
    };

    useEffect(() => {
        loadSecrets();

        // Listen for updates
        const handleSecretsUpdated = () => {
            loadSecrets();
        };

        window.addEventListener('secrets-updated', handleSecretsUpdated);
        return () => window.removeEventListener('secrets-updated', handleSecretsUpdated);
    }, []);

    if (loading) return <div className="py-6 text-center">Loading secrets...</div>;
    if (error) return <div className="py-6 text-center text-red-600">{error}</div>;
    if (!secrets.length) return <div className="py-6 text-center text-muted-foreground">No secrets added yet.</div>;

    return (
        <>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Secret Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {secrets.map(secret => (
                        <TableRow key={secret.id}>
                            <TableCell><b>{secret.name}</b></TableCell>
                            <TableCell>
                                <Badge variant={secret.type === 'kubeconfig' ? 'secondary' : 'default'}>
                                    {secret.type === 'kubeconfig' ? 'Kubeconfig' : 'SSH Key'}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditSecret(secret)}
                                        className="text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                        title="Edit secret"
                                    >
                                        <Edit className="h-4 w-4" />
                                    </Button>

                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                                                title="Delete SSL key"
                                                disabled={deleting === secret.id}
                                            >
                                                <Trash2 className="h-4 w-4"/>
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete Secret</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Are you sure you want to delete "<b>{secret.name}</b>"? This action cannot
                                                    be undone and will permanently remove the secret file.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel disabled={deleting === secret.id}>
                                                    Cancel
                                                </AlertDialogCancel>
                                                <AlertDialogAction
                                                    className="bg-red-600 hover:bg-red-700 focus:ring-red-400"
                                                    disabled={deleting === secret.id}
                                                    onClick={() => handleDeleteSecret(secret.id)}
                                                >
                                                    {deleting === secret.id ? 'Deleting...' : 'Delete'}
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

            <EditSecretDialog
                secret={editingSecret}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                onSave={handleSaveEdit}
            />
        </>
    );
};

const EditSecretDialog: React.FC<{
    secret: SecretMetadata | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (updatedSecret: SecretMetadata) => void;
}> = ({ secret, open, onOpenChange, onSave }) => {
    const [displayName, setDisplayName] = useState<string>("");
    // CHANGE THIS LINE - use SecretType enum instead of string literals
    const [secretType, setSecretType] = useState<SecretType>(SecretType.SSH);
    const [fileName, setFileName] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isFileValid, setIsFileValid] = useState<boolean | null>(null);
    const [fileChanged, setFileChanged] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    
    const { toast } = useToast();
    
    // Store original values to detect changes - UPDATED TYPES
    const [originalValues, setOriginalValues] = useState<{
        name: string;
        type: SecretType;  // Changed from string literal to SecretType
    } | null>(null);

    useEffect(() => {
        if (secret && open) {
            setDisplayName(secret.name || "");
            setSecretType(secret.type || SecretType.SSH); // Use enum value
            setFileName(secret.fileName || null);
            setFileChanged(false);
            setSelectedFile(null);
            setIsFileValid(null);
            setHasUnsavedChanges(false);
            
            // Store original values
            setOriginalValues({
                name: secret.name || "",
                type: secret.type || SecretType.SSH  // Use enum value
            });
        }
    }, [secret, open]);

    // Check for unsaved changes
    useEffect(() => {
        if (!originalValues) return;
        
        const hasChanges = 
            displayName !== originalValues.name ||
            secretType !== originalValues.type ||
            fileChanged;
            
        setHasUnsavedChanges(hasChanges);
    }, [displayName, secretType, fileChanged, originalValues]);

    const handleFile = async (file: File) => {
        setIsFileValid(true);
        setSelectedFile(file);
        setFileName(file.name);
        setFileChanged(true);
    };

    const handleDialogClose = (newOpen: boolean) => {
        if (!newOpen && hasUnsavedChanges) {
            const confirmClose = window.confirm('You have unsaved changes. Are you sure you want to close?');
            if (!confirmClose) return;
        }
        
        if (!newOpen) {
            setFileName(null);
            setDisplayName("");
            setSecretType(SecretType.SSH); // Use enum value
            setSelectedFile(null);
            setIsFileValid(null);
            setFileChanged(false);
            setHasUnsavedChanges(false);
            setOriginalValues(null);
        }
        
        onOpenChange(newOpen);
    };

    const handleSave = async () => {
        if (!secret) return;

        setUploading(true);
        try {
            // Prepare update data - UPDATED TYPES
            const updateData: {
                displayName?: string;
                secretType?: SecretType;  // Changed from string literal to SecretType
                file?: File;
            } = {};

            // Only include displayName if it changed
            if (displayName.trim() !== originalValues?.name) {
                updateData.displayName = displayName.trim();
            }

            // Only include secretType if it changed
            if (secretType !== originalValues?.type) {
                updateData.secretType = secretType;
            }

            // Only include file if a new one was selected
            if (selectedFile) {
                updateData.file = selectedFile;
            }

            // If no changes were made, just close the dialog
            if (Object.keys(updateData).length === 0) {
                toast({
                    title: "No Changes",
                    description: "No changes were made to the secret.",
                });
                handleDialogClose(false);
                return;
            }

            // Make API call to update the secret
            const result = await updateSecretOnServer(secret.id, updateData);

            if (result.success) {
                toast({
                    title: "Success",
                    description: "Secret updated successfully",
                });

                // Create updated secret object for local state
                const updatedSecret: SecretMetadata = {
                    ...secret,
                    name: updateData.displayName || secret.name,
                    type: updateData.secretType || secret.type,  // This should now match SecretType
                };

                // Update local state
                onSave(updatedSecret);
                
                // Close dialog
                handleDialogClose(false);
            } else {
                toast({
                    title: "Error",
                    description: result.error || "Failed to update secret",
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error('Error updating secret:', error);
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "An unexpected error occurred",
                variant: "destructive",
            });
        } finally {
            setUploading(false);
        }
    };

    if (!secret) return null;

    return (
        <Dialog open={open} onOpenChange={handleDialogClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        Edit Secret
                        {hasUnsavedChanges && (
                            <span className="ml-2 h-2 w-2 bg-orange-500 rounded-full inline-block" 
                                  title="Unsaved changes" />
                        )}
                    </DialogTitle>
                    <DialogDescription>Update the secret details.</DialogDescription>
                </DialogHeader>
                
                <div className="space-y-3">
                    <div className="space-y-2">
                        <Label htmlFor="edit-secret-name">Secret name</Label>
                        <Input 
                            id="edit-secret-name" 
                            placeholder="My SSH Key" 
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            disabled={uploading}
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="edit-secret-type">Type</Label>
                        <Select 
                            value={secretType}
                            onValueChange={(value: SecretType) => setSecretType(value)}  // Updated type
                            disabled={uploading}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select type"/>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={SecretType.SSH}>SSH Key</SelectItem>
                                <SelectItem value={SecretType.KUBECONFIG}>Kubeconfig</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Update File (Optional)</Label>
                        <FileDropzone
                            id="edit-secret-upload"
                            accept="*"
                            loading={uploading}
                            onFile={handleFile}
                            multiple={false}
                        />
                        {!fileChanged && (
                            <p className="text-sm text-muted-foreground">
                                Current file will be kept if no new file is uploaded
                            </p>
                        )}
                    </div>

                    {fileName && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                                <span>
                                    {fileChanged ? 'New file: ' : 'Current file: '}
                                    <b>{fileName}</b>
                                </span>
                                {isFileValid !== null && (
                                    isFileValid ? (
                                        <Check className="h-4 w-4 text-green-600"/>
                                    ) : (
                                        <X className="h-4 w-4 text-red-600"/>
                                    )
                                )}
                            </div>
                            {isFileValid === false && (
                                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                                    <X className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0"/>
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
                    <Button variant="ghost" onClick={() => handleDialogClose(false)} disabled={uploading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={uploading || (fileChanged && isFileValid === false)}>
                        {uploading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Saving...
                            </>
                        ) : (
                            "Save Changes"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
