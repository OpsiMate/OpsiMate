import React, { useState, useRef, useEffect } from 'react';
import { Input } from './ui/input';
import { Edit, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface EditableCustomFieldProps {
  fieldId: number;
  fieldName: string;
  value: string | undefined;
  serviceId: number;
  onValueChange: (fieldId: number, value: string) => Promise<void>;
  className?: string;
}

export const EditableCustomField: React.FC<EditableCustomFieldProps> = ({
  fieldId,
  fieldName,
  value,
  serviceId,
  onValueChange,
  className
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [isHovered, setIsHovered] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleEdit = () => {
    setEditValue(value || '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (editValue.trim() === value?.trim()) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onValueChange(fieldId, editValue.trim());
      setIsEditing(false);
      toast({
        title: "Success",
        description: `${fieldName} updated successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to update ${fieldName}`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const displayValue = value || '-';

  return (
    <div
      className={cn("relative group", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isEditing ? (
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={isSaving}
          className="h-6 text-sm font-mono w-full"
          placeholder="Enter value..."
        />
      ) : (
        <div className="flex items-center justify-between min-h-[1.5rem]">
          <div className="font-medium text-foreground font-mono text-sm flex-1">
            {displayValue}
          </div>
          {isHovered && !isSaving && (
            <button
              onClick={handleEdit}
              className="p-1 rounded hover:bg-blue-100 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0"
              title={`Edit ${fieldName}`}
            >
              <Edit className="h-3 w-3" />
            </button>
          )}
          {isSaving && (
            <div className="text-xs text-muted-foreground ml-2 flex-shrink-0">Saving...</div>
          )}
        </div>
      )}
    </div>
  );
};
