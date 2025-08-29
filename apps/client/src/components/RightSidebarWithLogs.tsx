import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { providerApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Alert, Tag } from "@OpsiMate/shared";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Package,
  RefreshCw,
  Server,
  Tag as TagIcon,
  X
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { AlertsSection } from "./AlertsSection";
import { IntegrationDashboardDropdown } from "./IntegrationDashboardDropdown";
import { Service } from "./ServiceTable";
import { TagSelector } from "./TagSelector";

interface RightSidebarProps {
  service: Service | null;
  onClose: () => void;
  collapsed: boolean;
  onServiceUpdate?: (updatedService: Service) => void;
  alerts?: Alert[];
  onAlertDismiss?: (alertId: string) => void;
}

export const RightSidebarWithLogs = memo(function RightSidebarWithLogs({ service, onClose, collapsed, onServiceUpdate, alerts = [], onAlertDismiss }: RightSidebarProps) {
  const { toast } = useToast();
  const [logs, setLogs] = useState<string[]>([]);
  const [pods, setPods] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceTags, setServiceTags] = useState<Tag[]>(service?.tags || []);

  // Collapsible section states - Service Information expanded by default
  const [sectionsOpen, setSectionsOpen] = useState({
    details: true, // Expanded by default
    alerts: false, // Collapsed by default
    externalLinks: false, // Collapsed by default
    logs: false, // Collapsed by default
    tags: false, // Collapsed by default
    pods: false // Collapsed by default
  });

  // Toggle section open/closed state
  const toggleSection = useCallback((section: keyof typeof sectionsOpen) => {
    setSectionsOpen(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  const fetchLogs = useCallback(async () => {
    if (!service) return;

    setLoading(true);
    setError(null);
    try {
      const response = await providerApi.getServiceLogs(parseInt(service.id));

      if (response.success && response.data) {
        setLogs(response.data);
      } else {
        setError(response.error || "Failed to fetch logs");
        toast({
          title: "Error fetching logs",
          description: response.error || "Failed to fetch logs",
          variant: "destructive"
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
      toast({
        title: "Error fetching logs",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [service, toast]);

  const fetchPods = useCallback(async () => {
    if (!service) return;
    
    // Only fetch pods for Kubernetes services
    if (service.provider?.providerType !== 'kubernetes') {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await providerApi.getServicePods(parseInt(service.id));

      if (response.success && response.data) {
          setPods(response.data);
      } else {
        setError(response.error || "Failed to fetch pods");
        toast({
          title: "Error fetching pods",
          description: response.error || "Failed to fetch pods",
          variant: "destructive"
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
      toast({
        title: "Error fetching pods",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [service, toast]);

  const fetchTags = useCallback(async () => {
    if (!service) return;
    try {
      const response = await providerApi.getServiceTags(parseInt(service.id));
      if (response.success && response.data) {
        setServiceTags(response.data);
      } else {
        setServiceTags([]);
      }
    } catch (err) {
      setServiceTags([]);
    }
  }, [service]);

  useEffect(() => {
    fetchLogs();
    fetchTags();
  }, [service?.id, fetchLogs, fetchTags]);

  const handleTagsChange = useCallback((newTags: Tag[]) => {
    setServiceTags(newTags);
    if (service && onServiceUpdate) {
      onServiceUpdate({
        ...service,
        tags: newTags
      });
    }
  }, [service, onServiceUpdate]);

  const handleRemoveTag = useCallback(async (tagToRemove: Tag) => {
    if (!service) return;

    try {
      const response = await providerApi.removeTagFromService(parseInt(service.id), tagToRemove.id);
      if (response.success) {
        const updatedTags = serviceTags.filter(tag => tag.id !== tagToRemove.id);
        setServiceTags(updatedTags);
        if (onServiceUpdate) {
          onServiceUpdate({
            ...service,
            tags: updatedTags
          });
        }
        toast({
          title: "Success",
          description: "Tag removed from service"
        });
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to remove tag",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove tag",
        variant: "destructive"
      });
    }
  }, [service, serviceTags, onServiceUpdate, toast]);

  // Memoize status color calculation
  const getStatusColor = useCallback((status: Service['serviceStatus']) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-800 border-green-200';
      case 'stopped': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }, []);

  // Memoize the integration dropdowns to prevent unnecessary re-renders
  const integrationDropdowns = useMemo(() => {
    // Only render if there are tags
    if (serviceTags.length === 0) {
      return null;
    }

    return (
      <div className="space-y-2 pt-2">
        <IntegrationDashboardDropdown
          tags={serviceTags}
          integrationType="Grafana"
          className="w-full"
        />
        <IntegrationDashboardDropdown
          tags={serviceTags}
          integrationType="Kibana"
          className="w-full"
        />
        <IntegrationDashboardDropdown
          tags={serviceTags}
          integrationType="Datadog"
          className="w-full"
        />
      </div>
    );
  }, [serviceTags]);

  if (!service) return null;

  if (collapsed) {
    return (
      <div className="w-full bg-card border-l border-border p-4 flex flex-col items-center gap-4 overflow-hidden h-full">
        <FileText className="h-6 w-6" />
      </div>
    );
  }

  // Reusable CollapsibleSection component
  const CollapsibleSection = ({
    title,
    icon: Icon,
    isOpen,
    onToggle,
    children,
    badge,
    className = ""
  }: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    badge?: string | number;
    className?: string;
  }) => (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-between p-2 h-auto transition-colors text-foreground hover:text-foreground hover:bg-transparent",
            className
          )}
        >
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{title}</span>
            {badge && (
              <Badge variant="secondary" className="text-xs h-5">
                {badge}
              </Badge>
            )}
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );

  return (
    <div className="w-full bg-card border-l border-border h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Service Details</h3>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Service Name & Status - Always Visible */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-foreground text-lg">{service.name}</h4>
            <p className="text-muted-foreground text-sm">{service.serviceType}</p>
          </div>
          <Badge className={cn(getStatusColor(service.serviceStatus), "text-xs py-1 px-3")}>
            {service.serviceStatus}
          </Badge>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto">
        <div className="space-y-1 p-2">
          {/* Service Details Section - First/Top */}
          <CollapsibleSection
            title="Service Information"
            icon={Server}
            isOpen={sectionsOpen.details}
            onToggle={() => toggleSection('details')}
          >
            <div className="grid grid-cols-1 gap-4 p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Service ID</div>
                  <div className="font-medium text-foreground text-sm">{service.id}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs mb-1">IP Address</div>
                  <div className="font-medium text-foreground font-mono text-sm">{service.serviceIP || '-'}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Provider</div>
                  <div className="font-medium text-foreground text-sm">{service.provider.name}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Provider IP</div>
                  <div className="font-medium text-foreground text-sm">{service.provider.providerIP}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Created</div>
                  <div className="font-medium text-foreground text-sm">{new Date(service.createdAt).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Container ID</div>
                  <div className="font-medium text-foreground text-sm truncate">{service.containerDetails?.id || '-'}</div>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Alerts Section - Smart visibility */}
          {(service?.serviceAlerts?.length || 0) > 0 && (
            <CollapsibleSection
              title="Alerts"
              icon={AlertTriangle}
              isOpen={sectionsOpen.alerts}
              onToggle={() => toggleSection('alerts')}
              badge={service?.serviceAlerts?.filter(a => !a.isDismissed).length || 0}
              className="text-orange-600"
            >
              <AlertsSection
                alerts={service?.serviceAlerts || []}
                onAlertDismiss={onAlertDismiss}
              />
            </CollapsibleSection>
          )}

          {/* External Links Section */}
          <CollapsibleSection
            title="External Links"
            icon={ExternalLink}
            isOpen={sectionsOpen.externalLinks}
            onToggle={() => toggleSection('externalLinks')}
          >
            {integrationDropdowns}
          </CollapsibleSection>

          {/* Service Logs Section */}
          <CollapsibleSection
            title="Service Logs"
            icon={Activity}
            isOpen={sectionsOpen.logs}
            onToggle={() => toggleSection('logs')}
          >
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-muted-foreground text-xs">Recent logs</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchLogs}
                  disabled={loading}
                  className="h-6 w-6 p-0"
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {loading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-pulse text-muted-foreground text-xs">Loading logs...</div>
                </div>
              ) : error ? (
                <div className="text-red-500 py-2 text-xs bg-red-50 rounded p-2">{error}</div>
              ) : logs.length === 0 ? (
                <div className="text-muted-foreground py-2 text-xs bg-muted/30 rounded p-2 text-center">No logs available</div>
              ) : (
                <div className="bg-muted rounded-md p-3 overflow-auto max-h-[200px] border">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
                    {logs.join('\n')}
                  </pre>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Service Pods Section - Only show for Kubernetes services */}
          {service?.provider?.providerType === 'kubernetes' && (
            <CollapsibleSection
              title="Service Pods"
              icon={Package}
              isOpen={sectionsOpen.pods}
              onToggle={() => fetchPods() && toggleSection('pods') }
            >
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-muted-foreground text-xs">Pods List</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchPods}
                  disabled={loading}
                  className="h-6 w-6 p-0"
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {loading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-pulse text-muted-foreground text-xs">Loading pods...</div>
                </div>
              ) : error ? (
                <div className="text-red-500 py-2 text-xs bg-red-50 rounded p-2">{error}</div>
              ) : logs.length === 0 ? (
                <div className="text-muted-foreground py-2 text-xs bg-muted/30 rounded p-2 text-center">No pods available</div>
              ) : (
                <div className="bg-muted rounded-md p-3 overflow-auto max-h-[200px] border">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
                   {pods.map(i=>i.name).join( "\n")}
                  </pre>
                </div>
              )}
            </div>
          </CollapsibleSection>
          )}

          {/* Tags Section - Always visible */}
          <CollapsibleSection
            title="Tags"
            icon={TagIcon}
            isOpen={sectionsOpen.tags}
            onToggle={() => toggleSection('tags')}
            badge={serviceTags.length}
          >
            <div className="pt-2">
              <TagSelector
                selectedTags={serviceTags}
                onTagsChange={handleTagsChange}
                serviceId={parseInt(service.id)}
                className=""
              />
            </div>
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
});
