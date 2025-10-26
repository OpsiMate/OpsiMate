import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useCreateApiKey } from '../hooks/queries/apiKeys/useApiKeys';
import { ErrorAlert } from './ErrorAlert';
import { Copy, Check, Key, AlertTriangle, Shield } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

interface CreateApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApiKeyCreated?: () => void;
}

export function CreateApiKeyModal({ open, onOpenChange, onApiKeyCreated }: CreateApiKeyModalProps) {
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const createApiKeyMutation = useCreateApiKey();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) return;

    try {
      // Convert datetime-local to ISO string if provided
      let isoExpiresAt: string | undefined = undefined;
      if (expiresAt) {
        // The datetime-local input gives us "YYYY-MM-DDTHH:mm"
        // We need to convert it to ISO 8601 format with timezone
        const localDate = new Date(expiresAt);
        isoExpiresAt = localDate.toISOString();
      }

      const result = await createApiKeyMutation.mutateAsync({
        name: name.trim(),
        expiresAt: isoExpiresAt,
      });
      
      setCreatedApiKey(result.key);
      setName('');
      setExpiresAt('');
      
      if (onApiKeyCreated) {
        onApiKeyCreated();
      }
    } catch (error) {
      console.error('Failed to create API key:', error);
    }
  };

  const handleClose = () => {
    setCreatedApiKey(null);
    setCopied(false);
    setName('');
    setExpiresAt('');
    onOpenChange(false);
  };

  const copyToClipboard = async () => {
    if (createdApiKey) {
      try {
        await navigator.clipboard.writeText(createdApiKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
      }
    }
  };

  const isSubmitting = createApiKeyMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Key className="h-5 w-5" />
            <span>{createdApiKey ? 'API Key Created Successfully' : 'Create New API Key'}</span>
          </DialogTitle>
          <DialogDescription>
            {createdApiKey 
              ? 'Save this key securely. You won\'t be able to see it again.'
              : 'Create a new API key for programmatic access to OpsiMate.'
            }
          </DialogDescription>
        </DialogHeader>

        {createApiKeyMutation.error && (
          <ErrorAlert 
            message={createApiKeyMutation.error.message || 'Failed to create API key'} 
            className="mb-4" 
          />
        )}

        {createdApiKey ? (
          <div className="space-y-4 py-4">
            <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>Important:</strong> Copy this key now. For security reasons, you won't be able to view it again.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="api-key" className="text-base font-semibold">Your API Key</Label>
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Input
                    id="api-key"
                    value={createdApiKey}
                    readOnly
                    className="font-mono text-sm pr-10 bg-muted"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Key className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                <Button
                  type="button"
                  variant={copied ? "default" : "outline"}
                  size="icon"
                  onClick={copyToClipboard}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  <span className="sr-only">{copied ? 'Copied' : 'Copy to clipboard'}</span>
                </Button>
              </div>
              {copied && (
                <p className="text-sm text-green-600 dark:text-green-400 flex items-center space-x-1">
                  <Check className="h-4 w-4" />
                  <span>Copied to clipboard!</span>
                </p>
              )}
            </div>

            <div className="space-y-2 p-4 rounded-lg border bg-muted/50">
              <div className="flex items-start space-x-2">
                <Shield className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold">Security Best Practices</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Store this key in a secure password manager or secrets vault</li>
                    <li>Never commit API keys to version control</li>
                    <li>Use environment variables to store keys in your applications</li>
                    <li>Rotate keys regularly and delete unused keys</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-base">
                  Key Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g., Production Server, CI/CD Pipeline, Mobile App"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  autoFocus
                  required
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">
                  Choose a descriptive name to help you identify this API key later.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="expires-at" className="text-base">Expiration Date (Optional)</Label>
                <Input
                  id="expires-at"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  disabled={isSubmitting}
                  min={new Date().toISOString().slice(0, 16)}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for no expiration. Recommended: Set an expiration date for better security.
                </p>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !name.trim()}
              >
                {isSubmitting ? 'Creating...' : 'Create API Key'}
              </Button>
            </DialogFooter>
          </form>
        )}

        {createdApiKey && (
          <DialogFooter>
            <Button onClick={handleClose} className="w-full sm:w-auto">
              I've Saved My Key
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
