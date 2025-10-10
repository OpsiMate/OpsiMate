import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LogoutButtonProps {
  collapsed: boolean;
  onLogout: () => void;
}

export function LogoutButton({ collapsed, onLogout }: LogoutButtonProps) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "gap-3 h-10",
        collapsed ? "w-10 justify-center p-0" : "w-full justify-center px-3",
      )}
      onClick={onLogout}
    >
      <LogOut className="h-5 w-5 flex-shrink-0" />
      <span className={cn("font-medium", collapsed && "sr-only")}>Log out</span>
    </Button>
  );
}
