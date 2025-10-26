import React, { useState } from "react";
import { ApiKey } from "@OpsiMate/shared";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import {
  useUpdateApiKey,
  useDeleteApiKey,
} from "../hooks/queries/apiKeys/useApiKeys";
import { ErrorAlert } from "./ErrorAlert";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Calendar,
  Clock,
  Key,
  AlertTriangle,
  CheckCircle2,
  Copy,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface ApiKeyCardProps {
  apiKey: ApiKey;
}

export function ApiKeyCard({ apiKey }: ApiKeyCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(apiKey.name);
  const [isActive, setIsActive] = useState(apiKey.isActive);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [copied, setCopied] = useState(false);

  const updateApiKeyMutation = useUpdateApiKey();
  const deleteApiKeyMutation = useDeleteApiKey();

  const handleUpdate = async () => {
    try {
      await updateApiKeyMutation.mutateAsync({
        apiKeyId: apiKey.id,
        updates: {
          name: editName.trim(),
          isActive,
        },
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update API key:", error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteApiKeyMutation.mutateAsync(apiKey.id);
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Failed to delete API key:", error);
    }
  };

  const handleCopyKeyHash = () => {
    navigator.clipboard.writeText(apiKey.keyHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60)
      return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return formatDate(dateString);
  };

  const isExpired = apiKey.expiresAt
    ? new Date(apiKey.expiresAt) < new Date()
    : false;
  const isExpiringSoon = apiKey.expiresAt
    ? new Date(apiKey.expiresAt).getTime() - Date.now() <
        7 * 24 * 60 * 60 * 1000 && !isExpired
    : false;

  const resetEditDialog = () => {
    setIsEditing(false);
    setEditName(apiKey.name);
    setIsActive(apiKey.isActive);
  };

  return (
    <>
      <Card
        className={`transition-all hover:shadow-md ${isExpired ? "border-destructive/50 bg-destructive/5" : ""}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div
                className={`p-2.5 rounded-lg flex-shrink-0 ${apiKey.isActive && !isExpired ? "bg-primary/10 dark:bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                <Key className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg font-semibold leading-snug mb-1.5">
                  {apiKey.name}
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  {apiKey.isActive && !isExpired ? (
                    <Badge
                      variant="default"
                      className="flex items-center gap-1 text-xs">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Active</span>
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Inactive
                    </Badge>
                  )}
                  {isExpired && (
                    <Badge
                      variant="destructive"
                      className="flex items-center gap-1 text-xs">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Expired</span>
                    </Badge>
                  )}
                  {isExpiringSoon && (
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1 border-orange-500 text-orange-600 text-xs">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Expiring Soon</span>
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="pt-0 pb-4 px-6">
          <div className="space-y-3">
            {/* Created Date */}
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">Created</span>
              </div>
              <p className="text-sm font-semibold">
                {formatDate(apiKey.createdAt)}
              </p>
            </div>

            {/* Last Used */}
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Last Used</span>
              </div>
              {apiKey.lastUsedAt ? (
                <p
                  className="text-sm font-semibold"
                  title={formatDate(apiKey.lastUsedAt)}>
                  {getRelativeTime(apiKey.lastUsedAt)}
                </p>
              ) : (
                <p className="text-sm font-semibold text-muted-foreground">
                  Never used
                </p>
              )}
            </div>

            {/* Expiration */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                {isExpired || isExpiringSoon ? (
                  <AlertTriangle
                    className={`h-4 w-4 ${
                      isExpired ? "text-destructive" : "text-orange-500"
                    }`}
                  />
                ) : (
                  <Calendar className="h-4 w-4" />
                )}
                <span className="text-sm font-medium">
                  {isExpired ? "Expired" : "Expires"}
                </span>
              </div>
              <span
                className={`text-sm font-semibold ${
                  isExpired
                    ? "text-destructive"
                    : isExpiringSoon
                      ? "text-orange-600 dark:text-orange-400"
                      : ""
                }`}>
                {apiKey.expiresAt
                  ? formatDate(apiKey.expiresAt)
                  : "No expiration"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={resetEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit API Key</DialogTitle>
            <DialogDescription>
              Update the name and status of this API key. The key value itself
              cannot be changed.
            </DialogDescription>
          </DialogHeader>

          {updateApiKeyMutation.error && (
            <ErrorAlert
              message={
                updateApiKeyMutation.error.message || "Failed to update API key"
              }
            />
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                placeholder="e.g., Production API, CI/CD Pipeline"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={updateApiKeyMutation.isPending}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Choose a descriptive name to identify this key.
              </p>
            </div>

            <div className="flex items-center justify-between py-3 px-3 rounded-lg border bg-muted/50">
              <div className="space-y-0.5">
                <Label
                  htmlFor="edit-active"
                  className="text-base cursor-pointer">
                  Active Status
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isActive
                    ? "Key can be used for authentication"
                    : "Key is disabled and cannot be used"}
                </p>
              </div>
              <Switch
                id="edit-active"
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={updateApiKeyMutation.isPending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={resetEditDialog}
              disabled={updateApiKeyMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateApiKeyMutation.isPending || !editName.trim()}>
              {updateApiKeyMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete API Key
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>"{apiKey.name}"</strong>?
              This action will immediately revoke access and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteApiKeyMutation.error && (
            <ErrorAlert
              message={
                deleteApiKeyMutation.error.message || "Failed to delete API key"
              }
            />
          )}

          <div className="flex items-center gap-3 py-3 px-3 bg-muted/50 rounded-lg">
            <div className="p-2 rounded-lg bg-destructive/10">
              <Key className="h-4 w-4 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{apiKey.name}</p>
            </div>
          </div>

          <div className="py-3 px-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm">
              <strong>Warning:</strong> Any applications using this key will
              immediately lose access.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteApiKeyMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteApiKeyMutation.isPending}>
              {deleteApiKeyMutation.isPending
                ? "Deleting..."
                : "Delete API Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}