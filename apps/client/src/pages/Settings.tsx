import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { apiRequest } from '../lib/api';
import { User, Role, AuditLog, AuditActionType, AuditResourceType } from '@service-peek/shared';
import { getCurrentUser } from '../lib/auth';
import { ErrorAlert } from '../components/ErrorAlert';
import { useFormErrors } from '../hooks/useFormErrors';
import { Users, FileText, Settings as SettingsIcon } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { AddUserModal } from '../components/AddUserModal';
import { auditApi } from '../lib/api';

const Settings: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const { generalError, clearErrors, handleApiResponse } = useFormErrors();
  const currentUser = getCurrentUser();

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

  const handleRoleUpdate = async (email: string, newRole: 'admin' | 'editor' | 'viewer') => {
    setUpdatingUser(email);
    clearErrors();
    
    try {
      const response = await apiRequest('/users/role', 'PATCH', { email, newRole });
      if (response.success) {
        // Update the local state
        setUsers(prevUsers => 
          prevUsers.map(user => 
            user.email === email ? { ...user, role: newRole as Role } : user
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

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'editor': return 'default';
      case 'viewer': return 'secondary';
      default: return 'outline';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading settings...</div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <SettingsIcon className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Settings</h1>
          </div>
          <p className="text-muted-foreground">Manage your Service Peek configuration and user access.</p>
        </div>

      {generalError && <ErrorAlert message={generalError} className="mb-6" />}

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold">User Management</h2>
              <p className="text-muted-foreground">Manage user access and permissions for your Service Peek instance.</p>
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
                          <Badge variant="outline" className="ml-2 text-xs">
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
                        <Select
                          value={user.role}
                          onValueChange={(newRole) => handleRoleUpdate(user.email, newRole as 'admin' | 'editor' | 'viewer')}
                          disabled={updatingUser === user.email || user.email === currentUser?.email}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
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
            <p className="text-muted-foreground">View activity logs for all dashboard operations and user actions.</p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Activity Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <AuditLogTable />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Add User Modal */}
      <AddUserModal
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        onUserCreated={handleUserCreated}
      />
      </div>
    </DashboardLayout>
  );
};

export default Settings; 

const PAGE_SIZE = 20;
// Helper for natural relative time
function formatRelativeTime(dateString: string) {
  const now = new Date();
  const date = new Date(dateString);
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
    return () => { mounted = false; };
  }, [page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading) return <div className="py-8 text-center">Loading audit logs...</div>;
  if (error) return <ErrorAlert message={error} className="mb-4" />;
  if (!logs.length) return <div className="py-8 text-center text-muted-foreground">No audit logs found.</div>;

  // Helper for action badge color
  const getActionBadgeProps = (action: string) => {
    switch (action) {
      case 'CREATE':
        return { variant: 'secondary', className: 'bg-green-100 text-green-800 border-green-200' };
      case 'UPDATE':
        return { variant: 'secondary', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
      case 'DELETE':
        return { variant: 'destructive', className: '' };
      default:
        return { variant: 'outline', className: '' };
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
                <TableCell>{formatRelativeTime(log.timestamp)}</TableCell>
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
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>&larr; Prev</Button>
          <span className="text-sm">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next &rarr;</Button>
        </div>
      )}
    </div>
  );
}; 