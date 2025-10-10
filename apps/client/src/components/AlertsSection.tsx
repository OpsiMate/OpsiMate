import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  X,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { GrafanaIcon } from "@/components/icons/GrafanaIcon";
import { Alert as SharedAlert } from "@OpsiMate/shared";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AlertsSectionProps {
  alerts: SharedAlert[];
  onAlertDismiss?: (alertId: string) => void;
  className?: string;
}

export function AlertsSection({
  alerts,
  onAlertDismiss,
  className,
}: AlertsSectionProps) {
  const { toast } = useToast();
  const [dismissingAlerts, setDismissingAlerts] = useState<Set<string>>(
    new Set(),
  );
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  const activeAlerts = alerts.filter((alert) => !alert.isDismissed);

  const handleDismissAlert = async (alertId: string) => {
    try {
      setDismissingAlerts((prev) => new Set(prev).add(alertId));

      if (onAlertDismiss) {
        await onAlertDismiss(alertId);
        toast({
          title: "Alert dismissed",
          description: "The alert has been marked as dismissed.",
        });
      }
    } catch (error) {
      console.error("Error dismissing alert:", error);
      toast({
        title: "Error dismissing alert",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setDismissingAlerts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(alertId);
        return newSet;
      });
    }
  };

  const handleAlertClick = (alertUrl: string) => {
    if (alertUrl) {
      window.open(alertUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Remove the internal Alerts title bar, just render the list */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {activeAlerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No active alerts
          </div>
        ) : (
          activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "rounded-lg border transition-colors flex items-center justify-between gap-2 p-3",
                "bg-card border-border hover:bg-muted/50",
              )}
            >
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex items-center justify-center h-7 w-7 rounded-full bg-muted">
                    <GrafanaIcon className="h-5 w-5 text-[#F46800]" />
                  </span>
                  <h4 className="font-semibold text-base text-foreground truncate">
                    {alert.alertName}
                  </h4>
                </div>
                {alert.summary && (
                  <div className="text-xs text-muted-foreground mt-1 whitespace-pre-line break-words w-full">
                    {alert.summary}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {alert.runbookUrl && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 p-0 text-muted-foreground hover:bg-accent focus:bg-accent focus:ring-2 focus:ring-primary"
                    title="Open Runbook"
                    onClick={() =>
                      window.open(
                        alert.runbookUrl,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    <span className="sr-only">Open Runbook</span>
                    📖
                  </Button>
                )}
                {alert.alertUrl && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 p-0 text-muted-foreground hover:bg-accent focus:bg-accent focus:ring-2 focus:ring-primary"
                    title="View in Grafana"
                    onClick={() => handleAlertClick(alert.alertUrl)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
                {onAlertDismiss && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 p-0 text-muted-foreground hover:bg-accent focus:bg-accent focus:ring-2 focus:ring-primary"
                    title="Dismiss Alert"
                    onClick={() => handleDismissAlert(alert.id)}
                    disabled={dismissingAlerts.has(alert.id)}
                  >
                    {dismissingAlerts.has(alert.id) ? (
                      <div className="h-3 w-3 rounded-full border-2 border-t-transparent animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
