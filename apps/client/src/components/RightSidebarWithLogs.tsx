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
  Copy,
  ExternalLink,
  FileText,
  Package,
  RefreshCw,
  Server,
  Tag as TagIcon,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LogSearchInput } from "./LogSearchInput";
import { AlertsSection } from "./AlertsSection";
import { IntegrationDashboardDropdown } from "./IntegrationDashboardDropdown";
import { Service } from "./ServiceTable";
import { TagSelector } from "./TagSelector";
import { EditableCustomField } from "./EditableCustomField";
import { useCustomFields, useUpsertCustomFieldValue } from "../hooks/queries/custom-fields";
import { ServiceCustomField } from "@OpsiMate/shared";
import { useServiceLogs, formatDateTimeLocal } from "../hooks/useServiceLogs";


interface RightSidebarProps {
  service: Service | null;
  onClose: () => void;
  collapsed: boolean;
  onServiceUpdate?: (updatedService: Service) => void;
  alerts?: Alert[];
  onAlertDismiss?: (alertId: string) => void;
}

export function RightSidebarWithLogs({ service, onClose, collapsed, onServiceUpdate, alerts = [], onAlertDismiss }: RightSidebarProps) {
  const { toast } = useToast();
  const [pods, setPods] = useState<{ name: string }[]>([]);
  const [podsLoading, setPodsLoading] = useState(false);
  const [podsError, setPodsError] = useState<string | null>(null);
  const [serviceTags, setServiceTags] = useState<Tag[]>(service?.tags || []);

  // Use the custom hook for logs-related functionality
  const {
    logs,
    filteredLogs,
    loading,
    error,
    searchKeyword,
    timeFilter,
    customTimeRange,
    showCustomTimeDialog,
    setSearchKeyword,
    setTimeFilter,
    setCustomTimeRange,
    setShowCustomTimeDialog,
    fetchLogs,
    copyLogsToClipboard,
    highlightLog,
  } = useServiceLogs({ serviceId: service?.id });

  // Custom fields hooks
  const { data: customFields } = useCustomFields();
  const upsertCustomFieldValue = useUpsertCustomFieldValue();

  // Create mapping from field ID to field name for display
  const customFieldMap = useMemo(() => {
    const map = new Map<number, string>();
    if (customFields) {
      customFields.forEach(field => {
        map.set(field.id, field.name);
      });
    }
    return map;
  }, [customFields]);

  // Handle custom field value changes
  const handleCustomFieldValueChange = async (fieldId: number, value: string) => {
    if (!service) return;

    try {
      await upsertCustomFieldValue.mutateAsync({
        serviceId: parseInt(service.id),
        customFieldId: fieldId,
        value: value
      });
    } catch (error) {
      console.error('Failed to update custom field value:', error);
      throw error; // Re-throw to let EditableCustomField handle the error
    }
  };

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

  const fetchPods = useCallback(async () => {
    if (!service) return;
    
    // Only fetch pods for Kubernetes services
    if (service.provider?.providerType !== 'kubernetes' && service.provider?.providerType !== 'K8S') {
      return;
    }

    setPodsLoading(true);
    setPodsError(null);
    try {
      const response = await providerApi.getServicePods(parseInt(service.id));

      if (response.success && response.data) {
          setPods(response.data);
      } else {
        setPodsError(response.error || "Failed to fetch pods");
        toast({
          title: "Error fetching pods",
          description: response.error || "Failed to fetch pods",
          variant: "destructive"
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setPodsError(errorMessage);
      toast({
        title: "Error fetching pods",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setPodsLoading(false);
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

  // fetch tags when service changes (fetchLogs is already handled by useServiceLogs hook)
  useEffect(() => {
    fetchTags();
  }, [service?.id, fetchTags]);

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
            <p className="text-muted-foreground text-sm">{service.serviceType.replace('DOCKER', 'Docker').replace('SYSTEMD', 'Systemd').replace('MANUAL', 'Manual')}</p>
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
            <div className="grid grid-cols-2 gap-4 p-3">
              <div>
                <div className="text-muted-foreground text-xs mb-1">IP Address</div>
                <div className="font-medium text-foreground font-mono text-sm">{service.serviceIP || '-'}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs mb-1">Provider</div>
                <div className="font-medium text-foreground text-sm">{service.provider.name}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs mb-1">Provider Type</div>
                <div className="font-medium text-foreground text-sm">{service.provider.providerType}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs mb-1">Created</div>
                <div className="font-medium text-foreground text-sm">{new Date(service.createdAt).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Custom Fields - Integrated into main grid */}
            {customFields && customFields.map(field => {
              const currentValue = service.customFields?.[field.id] || '';

              return (
                <div key={field.id}>
                  <div className="text-muted-foreground text-xs mb-1">{field.name}</div>
                  <EditableCustomField
                    fieldId={field.id}
                    fieldName={field.name}
                    value={currentValue}
                    serviceId={parseInt(service.id)}
                    onValueChange={handleCustomFieldValueChange}
                    className="w-full"
                  />
                </div>
              );
            })}
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
            <div className="pt-2 space-y-2">
              {/* Header with counter, copy, and refresh */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">
                  Recent logs{logs.length > 0 ?
                    ` (${filteredLogs.length}/${logs.length})` :
                    ': No current logs'}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyLogsToClipboard}
                    disabled={filteredLogs.length === 0}
                    className="h-6 w-6 p-0"
                    title="Copy filtered logs to clipboard"
                    aria-label="Copy filtered logs to clipboard"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchLogs}
                    disabled={loading}
                    className="h-6 w-6 p-0"
                    title="Refresh logs"
                    aria-label="Refresh logs"
                  >
                    <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {/* persists across remounts using sessionStorage */}
                <LogSearchInput
                  persistKey={`service-${service?.id || 'unknown'}`}
                  onSearchChange={setSearchKeyword}
                  placeholder="Search logs..."
                />

                {/* Time filter */}
                <div className="flex gap-1">
                  <select
                    value={timeFilter}
                    onChange={(e) => {
                      const value = e.target.value as typeof timeFilter;
                      if (value === "custom") {
                        setShowCustomTimeDialog(true);
                      } else {
                        setTimeFilter(value);
                        // Clear custom range when selecting other options
                        if (customTimeRange) {
                          setCustomTimeRange(null);
                        }
                      }
                    }}
                    className="flex-1 h-7 px-2 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="custom">{customTimeRange ? '✓ Custom range' : 'Custom range...'}</option>
                    <option value="30m">Last 30 minutes</option>
                    <option value="1h">Last 1 hour</option>
                    <option value="6h">Last 6 hours</option>
                    <option value="12h">Last 12 hours</option>
                    <option value="24h">Last 24 hours</option>
                    <option value="all">All time</option>
                    {/* additional time ranges - uncomment if needed
                    <option value="3d">Last 3 days</option>
                    <option value="7d">Last 7 days</option>
                    */}
                  </select>
                  {timeFilter === "custom" && customTimeRange && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setTimeFilter("all");
                        setCustomTimeRange(null);
                      }}
                      className="h-7 px-2"
                      title="Clear custom range"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Custom Time Range Dialog */}
              {showCustomTimeDialog && (
                <div 
                  className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                  onClick={() => setShowCustomTimeDialog(false)}
                >
                  <div 
                    className="bg-background border border-border rounded-lg p-4 w-[320px] shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="text-sm font-semibold mb-3">Custom Time Range</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Start Time</label>
                        <input
                          type="datetime-local"
                          value={customTimeRange?.start || formatDateTimeLocal(new Date(Date.now() - 5 * 60 * 1000))}
                          onChange={(e) => {
                            const newStart = e.target.value;
                            const newEnd = customTimeRange?.end || formatDateTimeLocal(new Date());
                            setCustomTimeRange({ start: newStart, end: newEnd });
                          }}
                          className="w-full h-8 px-2 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">End Time</label>
                        <input
                          type="datetime-local"
                          value={customTimeRange?.end || formatDateTimeLocal(new Date())}
                          onChange={(e) => {
                            const newEnd = e.target.value;
                            const newStart = customTimeRange?.start || formatDateTimeLocal(new Date(Date.now() - 5 * 60 * 1000));
                            setCustomTimeRange({ start: newStart, end: newEnd });
                          }}
                          className="w-full h-8 px-2 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div className="flex gap-2 justify-end pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowCustomTimeDialog(false)}
                          className="h-7 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            // Auto-set defaults if not set (using local time)
                            const start = customTimeRange?.start || formatDateTimeLocal(new Date(Date.now() - 5 * 60 * 1000));
                            const end = customTimeRange?.end || formatDateTimeLocal(new Date());
                            
                            // ensure start <= end (swap if needed)
                            const startDate = new Date(start);
                            const endDate = new Date(end);
                            const normalized = startDate > endDate ? { start: end, end: start } : { start, end };
                            
                            setCustomTimeRange(normalized);
                            setTimeFilter("custom");
                            setShowCustomTimeDialog(false);
                          }}
                          className="h-7 text-xs"
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {loading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-pulse text-muted-foreground text-xs">Loading logs...</div>
                </div>
              ) : error ? (
                <div className="text-red-500 py-2 text-xs bg-red-50 dark:bg-red-950 rounded p-2">{error}</div>
              ) : logs.length === 0 ? (
                <div className="text-muted-foreground py-2 text-xs bg-muted/30 rounded p-2 text-center">No logs available</div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-muted-foreground py-2 text-xs bg-muted/30 rounded p-2 text-center">
                  No logs match your search
                </div>
              ) : (
                <div className="bg-muted rounded-md p-3 overflow-auto max-h-[300px] border">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-foreground leading-relaxed">
                    {filteredLogs.map((log, i) => {
                      const highlighted = highlightLog(log);
                      const parts = highlighted.split('⚡');
                      return (
                        <div key={i} className="hover:bg-muted/50 px-1 -mx-1 rounded">
                          {parts.map((part, j) => 
                            j % 2 === 1 ? (
                              <span key={j} className="bg-yellow-200 dark:bg-yellow-500/30 text-foreground font-semibold px-0.5 rounded">{part}</span>
                            ) : (
                              <span key={j}>{part}</span>
                            )
                          )}
                        </div>
                      );
                    })}
                  </pre>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Service Pods Section - Only show for Kubernetes services */}
          {(service?.provider?.providerType === 'kubernetes' || service?.provider?.providerType === 'K8S') && (
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
}
