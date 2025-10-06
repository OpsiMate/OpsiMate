import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, X, RefreshCw } from "lucide-react";
import { Provider } from '@OpsiMate/shared';
import { getProviderTypeName, getStatusBadgeColor } from "@/pages/MyProviders";
import { ServiceConfig } from "./AddServiceDialog";
import { ServicesList } from "./ServicesList";
import { providerApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { InteractiveServiceLogs } from './InteractiveServiceLogs';

interface ServiceDetailsSheetProps {
  provider: Provider | null;
  onClose: () => void;
  onDeleteService?: (serviceId: string) => void;
  onStatusChange?: (serviceId: string, newStatus: "running" | "stopped" | "error") => void;
}

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <>
    <div className="text-muted-foreground">{label}</div>
    <div className="text-foreground font-medium">{value}</div>
  </>
);

export function ServiceDetailsSheetWithLogs({
  provider,
  onClose,
  onDeleteService,
  onStatusChange,
}: ServiceDetailsSheetProps) {
  const { toast } = useToast();
  const [selectedServiceForLogs, setSelectedServiceForLogs] = useState<ServiceConfig | null>(null);


  if (!provider) return null;

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl font-bold">
            Provider Details
          </SheetTitle>
        </SheetHeader>
        <Separator className="my-4" />
        <div className="space-y-6 py-2">
          <div>
            <h3 className="text-lg font-semibold">{provider.name}</h3>
            <p className="text-sm text-muted-foreground">{getProviderTypeName(provider.type)}</p>
            <Badge className={`mt-1 capitalize ${getStatusBadgeColor(provider.status ?? 'unknown')}`}>
              {provider.status}
            </Badge>
          </div>

          <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-2">
            {Object.entries(provider.details).map(([key, value]) => (
              <DetailRow key={key} label={`${key.charAt(0).toUpperCase() + key.slice(1)}:`} value={String(value)} />
            ))}
          </div>

          {provider.services && provider.services.length > 0 && (
            <div>
              <h4 className="font-semibold text-lg mb-2">Services</h4>
              <ServicesList 
                services={provider.services} 
                onServiceClick={(service) => {
                  // When a service is clicked, select it for logs display
                  setSelectedServiceForLogs(service);
                }}
                onStatusChange={(serviceId, newStatus) => {
                  if (onStatusChange && provider.id) {
                    onStatusChange(serviceId, newStatus);
                  }
                }}
                onDeleteService={onDeleteService}
              />
            </div>
          )}

          {selectedServiceForLogs && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedServiceForLogs(null)} 
                  className="h-8 w-8 p-0 ml-auto"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <InteractiveServiceLogs
                serviceId={parseInt(selectedServiceForLogs.id)}
                serviceName={selectedServiceForLogs.name}
              />
            </div>
          )}

          <div>
            <h4 className="font-semibold text-lg mb-2">External Links</h4>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href="#" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Metrics
                </a>
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
