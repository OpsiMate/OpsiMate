import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ThemeButtonProps {
  collapsed: boolean;
}

export function ThemeButton({ collapsed }: ThemeButtonProps) {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "gap-3 h-10",
            collapsed ? "w-10 justify-center p-0" : "w-full justify-start px-3",
          )}
        >
          <div className="relative h-5 w-5 flex-shrink-0">
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="h-5 w-5 absolute inset-0 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </div>
          <span className={cn("font-medium", collapsed && "sr-only")}>
            Theme
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={collapsed ? "end" : "start"}>
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
