import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ServiceConfig } from "./AddServiceDialog";
import { ChevronDown, ChevronUp, Play, Square, RotateCcw, Terminal, Container, Server, MoreVertical, Trash } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";

interface ServicesListProps {
  services: ServiceConfig[];
  onStatusChange: (serviceId: string, newStatus: "running" | "stopped" | "error") => void;
  onServiceClick: (service: ServiceConfig) => void;
  onDeleteService?: (serviceId: string) => void;
}

export function ServicesList({ services, onStatusChange, onServiceClick, onDeleteService }: ServicesListProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(true);
  // Track open dropdown menu for each service separately
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Function to toggle dropdown menu
  const toggleDropdown = (e: React.MouseEvent, serviceId: string) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === serviceId ? null : serviceId);
  };

  if (services.length === 0) {
    return null;
  }

  const handleAction = (serviceId: string, status: "running" | "stopped" | "error", action: string) => {
    toast({
      title: `${action} service`,
      description: `Service is ${action.toLowerCase()}...`
    });

    setTimeout(() => {
      onStatusChange(serviceId, status);
      toast({
        title: `Service ${action}`,
        description: `Service has been ${action.toLowerCase()}`
      });
    }, 1000);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="flex w-full justify-between p-0 h-8">
          <span className="font-medium">Services ({services.length})</span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 space-y-1">
        {services.map((service) => (
          <div key={service.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer">
            {/* Service info - clickable to view details */}
            <div
              className="flex items-center gap-2 flex-1"
              onClick={() => onServiceClick(service)}
            >
              {service.type === "DOCKER" ? (
                <Container className="h-4 w-4 text-blue-500" />
              ) : service.type === "SYSTEMD" ? (
                <Terminal className="h-4 w-4 text-green-500" />
              ) : (
                <Server className="h-4 w-4 text-purple-500" />
              )}
              <div>
                <div className="font-medium text-sm">{service.name}</div>
                <div className="text-xs text-muted-foreground">
                  {service.type === "DOCKER"
                    ? `Container: ${service.containerDetails?.image || service.name}`
                    : service.serviceIP
                      ? `IP: ${service.serviceIP}`
                      : "Manual service"
                  }
                </div>
              </div>
            </div>

            {/* Status badge and dropdown menu */}
            <div className="flex items-center gap-1">
              <Badge
                className={cn(
                  "text-xs",
                  service.status === "running" && "bg-green-500/20 text-green-700",
                  service.status === "stopped" && "bg-gray-500/20 text-gray-700",
                  service.status === "error" && "bg-red-500/20 text-red-700",
                  (!service.status || service.status === "unknown") && "bg-gray-500/20 text-gray-700"
                )}
              >
                {service.status || 'unknown'}
              </Badge>

              {/* Dropdown menu */}
              <DropdownMenu open={openMenuId === service.id} onOpenChange={(isOpen) => setOpenMenuId(isOpen ? service.id : null)}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => toggleDropdown(e, service.id)}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => onServiceClick(service)}>
                    <Terminal className="mr-2 h-4 w-4" /> View Details
                  </DropdownMenuItem>
                  {service.status !== 'running' && (
                    <DropdownMenuItem onClick={() => handleAction(service.id, 'running', 'Starting')}>
                      <Play className="mr-2 h-4 w-4" /> Start
                    </DropdownMenuItem>
                  )}
                  {service.status === 'running' && (
                    <DropdownMenuItem onClick={() => handleAction(service.id, 'stopped', 'Stopping')}>
                      <Square className="mr-2 h-4 w-4" /> Stop
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => handleAction(service.id, 'running', 'Restarting')}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Restart
                  </DropdownMenuItem>
                  {onDeleteService && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Delete button clicked for service:', service.id);
                        // Close dropdown menu after clicking delete
                        setOpenMenuId(null);
                        // Call the delete handler
                        onDeleteService(service.id);
                      }}
                      className="text-red-500 focus:text-red-500"
                    >
                      <Trash className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
