import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { apiRequest } from "../lib/api";
import { User, Role } from "../types";
import { ErrorAlert } from "./ErrorAlert";
import { useFormErrors } from "../hooks/useFormErrors";

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: (user: User) => void;
}

export function AddUserModal({
  isOpen,
  onClose,
  onUserCreated,
}: AddUserModalProps) {
  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    password: "",
    role: Role.Viewer,
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const { generalError, clearErrors, handleApiResponse } = useFormErrors();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    clearErrors();

    try {
      const response = await apiRequest<User>("/users", "POST", formData);
      if (response.success && response.data) {
        onUserCreated(response.data);
        // Reset form
        setFormData({
          email: "",
          fullName: "",
          password: "",
          role: Role.Viewer,
        });
        onClose();
      } else {
        handleApiResponse(response);
      }
    } catch (error) {
      handleApiResponse({
        success: false,
        error: "Failed to create user",
      });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleClose = () => {
    if (!creatingUser) {
      clearErrors();
      setFormData({
        email: "",
        fullName: "",
        password: "",
        role: Role.Viewer,
      });
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account with the specified role and permissions.
          </DialogDescription>
        </DialogHeader>

        {generalError && <ErrorAlert message={generalError} className="mb-4" />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                required
                disabled={creatingUser}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, fullName: e.target.value }))
                }
                required
                disabled={creatingUser}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, password: e.target.value }))
                }
                required
                minLength={6}
                disabled={creatingUser}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, role: value as Role }))
                }
                disabled={creatingUser}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={Role.Viewer}>Viewer</SelectItem>
                  <SelectItem value={Role.Editor}>Editor</SelectItem>
                  <SelectItem value={Role.Admin}>Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={creatingUser}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={creatingUser}>
              {creatingUser ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
