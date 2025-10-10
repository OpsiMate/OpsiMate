import { Button } from "@/components/ui/button";
import { Play, Square, RotateCcw } from "lucide-react";
import { Service } from "./ServiceTable";

interface ActionButtonsProps {
  selectedService: Service | null;
  selectedServices: Service[];
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
}

export function ActionButtons({
  selectedService,
  selectedServices,
  onStart,
  onStop,
  onRestart,
}: ActionButtonsProps) {
  const isDisabled = selectedServices.length === 0;

  return (
    <div className="bg-card border-t border-border p-3 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-sm font-medium px-1">
          {selectedServices.length > 0 ? (
            <span>
              Selected:{" "}
              <span className="text-primary">
                {selectedServices.length} service
                {selectedServices.length !== 1 ? "s" : ""}
              </span>
              {selectedServices.length === 1 && (
                <span className="text-muted-foreground">
                  ({selectedServices[0].name})
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">No services selected</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isDisabled}
            onClick={onStart}
            className="gap-2 h-9"
          >
            <Play className="h-4 w-4" />
            Start
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={isDisabled}
            onClick={onStop}
            className="gap-2 h-9"
          >
            <Square className="h-4 w-4" />
            Stop
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={isDisabled}
            onClick={onRestart}
            className="gap-2 h-9"
          >
            <RotateCcw className="h-4 w-4" />
            Restart
          </Button>
        </div>
      </div>
    </div>
  );
}
