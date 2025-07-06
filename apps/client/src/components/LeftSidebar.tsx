import { Button } from "@/components/ui/button"
import { Settings, Layers, LayoutDashboard, Database, Puzzle, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { Link, useLocation } from "react-router-dom"
import { AppIcon } from "./icons/AppIcon"

interface LeftSidebarProps {
  collapsed: boolean
}

export function LeftSidebar({ collapsed }: LeftSidebarProps) {
  const location = useLocation();
  return (
    <div className={cn("w-full bg-background flex flex-col h-full overflow-hidden", collapsed && "items-center")}>
      <div className={cn("flex items-center h-16 px-4", collapsed && "justify-center px-2")}>
        <AppIcon className="h-7 w-7 text-primary flex-shrink-0" />
        <h2 className={cn("ml-2 text-xl font-bold text-foreground whitespace-nowrap", collapsed && "sr-only")}>Service Peek</h2>
      </div>
      
      <div className={cn("px-4 space-y-2 w-full flex-grow flex flex-col", collapsed && "px-2 items-center")}>
        <Button 
          variant={location.pathname === "/" ? "default" : "ghost"}
          className={cn(
            "gap-3 h-10", 
            collapsed ? "w-10 justify-center p-0" : "w-full justify-start px-3",
            location.pathname === "/" && "text-primary-foreground"
          )}
          asChild
        >
          <Link to="/">
            <LayoutDashboard className="h-5 w-5 flex-shrink-0" />
            <span className={cn("font-medium", collapsed && "sr-only")}>Dashboard</span>
          </Link>
        </Button>
        
        <Button 
          variant={location.pathname === "/providers" ? "default" : "ghost"}
          className={cn(
            "gap-3 h-10", 
            collapsed ? "w-10 justify-center p-0" : "w-full justify-start px-3",
            location.pathname === "/providers" && "text-primary-foreground"
          )}
          asChild
        >
          <Link to="/providers">
            <Layers className="h-5 w-5 flex-shrink-0" />
            <span className={cn("font-medium", collapsed && "sr-only")}>Add Provider</span>
          </Link>
        </Button>
        
        <Button 
          variant={location.pathname === "/my-providers" ? "default" : "ghost"}
          className={cn(
            "gap-3 h-10", 
            collapsed ? "w-10 justify-center p-0" : "w-full justify-start px-3",
            location.pathname === "/my-providers" && "text-primary-foreground"
          )}
          asChild
        >
          <Link to="/my-providers">
            <Database className="h-5 w-5 flex-shrink-0" />
            <span className={cn("font-medium", collapsed && "sr-only")}>My Providers</span>
          </Link>
        </Button>
        
        <Button 
          variant={location.pathname === "/integrations" ? "default" : "ghost"}
          className={cn(
            "gap-3 h-10", 
            collapsed ? "w-10 justify-center p-0" : "w-full justify-start px-3",
            location.pathname === "/integrations" && "text-primary-foreground"
          )}
          asChild
        >
          <Link to="/integrations">
            <Puzzle className="h-5 w-5 flex-shrink-0" />
            <span className={cn("font-medium", collapsed && "sr-only")}>Integrations</span>
          </Link>
        </Button>
        
        <Button 
          variant={location.pathname === "/actions" ? "default" : "ghost"}
          className={cn(
            "gap-3 h-10", 
            collapsed ? "w-10 justify-center p-0" : "w-full justify-start px-3",
            location.pathname === "/actions" && "text-primary-foreground"
          )}
          asChild
        >
          <Link to="/actions">
            <Zap className="h-5 w-5 flex-shrink-0" />
            <span className={cn("font-medium", collapsed && "sr-only")}>Actions</span>
          </Link>
        </Button>
      </div>
      
      <div className={cn("p-4 mt-auto text-xs text-muted-foreground", collapsed && "sr-only")}>
        <p>© 2024 Service Peek</p>
      </div>
    </div>
  )
}