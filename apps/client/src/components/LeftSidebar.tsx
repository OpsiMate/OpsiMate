import { Button } from "@/components/ui/button";
import {
  Settings,
  Layers,
  LayoutDashboard,
  Database,
  Puzzle,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "react-router-dom";
import { AppIcon } from "./icons/AppIcon";
import { ProfileButton } from "./ProfileButton";
import { isAdmin, isEditor, isViewer } from "../lib/auth";
import * as Tooltip from "@radix-ui/react-tooltip";

interface LeftSidebarProps {
  collapsed: boolean;
}

function SidebarTooltip({
  collapsed,
  label,
  children,
  side = "right",
  align = "center",
  sideOffset = 10,
}: {
  collapsed: boolean;
  label: string;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
}) {
  if (!collapsed) return <>{children}</>;

  return (
    <Tooltip.Root delayDuration={1} disableHoverableContent>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Content
        side={side}
        align={align}
        sideOffset={sideOffset}
        className="z-50 rounded-md bg-[#051234] text-white px-2 py-1 text-sm m-2"
      >
        {label}
      </Tooltip.Content>
    </Tooltip.Root>
  );
}

export function LeftSidebar({ collapsed }: LeftSidebarProps) {
  const location = useLocation();

  return (
    <div
      className={cn(
        "w-full bg-background flex flex-col h-full overflow-hidden",
        collapsed && "items-center"
      )}
    >
      <Link
        to="/"
        className={cn(
          "flex items-center h-20 px-5 border-b cursor-pointer transition-all duration-200",
          collapsed && "justify-center px-2"
        )}
      >
        <div className="flex items-center">
          <div className="relative w-11 h-11 flex-shrink-0 transition-all duration-200 hover:drop-shadow-lg hover:scale-110">
            <AppIcon className="w-full h-full text-primary" />
          </div>
          <div className={cn("ml-3", collapsed && "sr-only")}>
            <h2 className="text-xl font-bold text-foreground whitespace-nowrap tracking-tight">
              OpsiMate
            </h2>
            <p className="text-xs text-muted-foreground">
              Operational Insights
            </p>
          </div>
        </div>
      </Link>

      <div
        className={cn(
          "px-4 space-y-2 w-full flex-grow flex flex-col",
          collapsed && "px-2 items-center"
        )}
      >
        <SidebarTooltip collapsed={collapsed} label="Dashboard">
          <Button
            variant={location.pathname === "/" ? "default" : "ghost"}
            className={cn(
              "gap-3 h-10",
              collapsed
                ? "w-10 justify-center p-0"
                : "w-full justify-start px-3",
              location.pathname === "/" && "text-primary-foreground"
            )}
            asChild
          >
            <Link to="/">
              <LayoutDashboard className="h-5 w-5 flex-shrink-0" />
              <span className={cn("font-medium", collapsed && "sr-only")}>
                Dashboard
              </span>
            </Link>
          </Button>
        </SidebarTooltip>

        {isEditor() && (
          <SidebarTooltip collapsed={collapsed} label="Add Providers">
            <Button
              variant={location.pathname === "/providers" ? "default" : "ghost"}
              className={cn(
                "gap-3 h-10",
                collapsed
                  ? "w-10 justify-center p-0"
                  : "w-full justify-start px-3",
                location.pathname === "/providers" && "text-primary-foreground"
              )}
              asChild
            >
              <Link to="/providers">
                <Layers className="h-5 w-5 flex-shrink-0" />
                <span className={cn("font-medium", collapsed && "sr-only")}>
                  Add Provider
                </span>
              </Link>
            </Button>
          </SidebarTooltip>
        )}

        {!isViewer() && (
          <SidebarTooltip collapsed={collapsed} label="My Providers">
            <Button
              variant={
                location.pathname === "/my-providers" ? "default" : "ghost"
              }
              className={cn(
                "gap-3 h-10",
                collapsed
                  ? "w-10 justify-center p-0"
                  : "w-full justify-start px-3",
                location.pathname === "/my-providers" &&
                  "text-primary-foreground"
              )}
              asChild
            >
              <Link to="/my-providers">
                <Database className="h-5 w-5 flex-shrink-0" />
                <span className={cn("font-medium", collapsed && "sr-only")}>
                  My Providers
                </span>
              </Link>
            </Button>
          </SidebarTooltip>
        )}

        {isEditor() && (
          <SidebarTooltip collapsed={collapsed} label="Integrations">
            <Button
              variant={
                location.pathname === "/integrations" ? "default" : "ghost"
              }
              className={cn(
                "gap-3 h-10",
                collapsed
                  ? "w-10 justify-center p-0"
                  : "w-full justify-start px-3",
                location.pathname === "/integrations" &&
                  "text-primary-foreground"
              )}
              asChild
            >
              <Link to="/integrations">
                <Puzzle className="h-5 w-5 flex-shrink-0" />
                <span className={cn("font-medium", collapsed && "sr-only")}>
                  Integrations
                </span>
              </Link>
            </Button>
          </SidebarTooltip>
        )}

        <SidebarTooltip collapsed={collapsed} label="Alerts">
          <Button
            variant={location.pathname === "/alerts" ? "default" : "ghost"}
            className={cn(
              "gap-3 h-10",
              collapsed
                ? "w-10 justify-center p-0"
                : "w-full justify-start px-3",
              location.pathname === "/alerts" && "text-primary-foreground"
            )}
            asChild
          >
            <Link to="/alerts">
              <Bell className="h-5 w-5 flex-shrink-0" />
              <span className={cn("font-medium", collapsed && "sr-only")}>
                Alerts
              </span>
            </Link>
          </Button>
        </SidebarTooltip>
      </div>

      <div
        className={cn(
          "p-4 mt-auto flex flex-col gap-3",
          collapsed && "items-center"
        )}
      >
        <div className={cn("flex flex-col gap-2 items-center")}>
          {isAdmin() && (
            <SidebarTooltip collapsed={collapsed} label="Settings">
              <Button
                variant={
                  location.pathname === "/settings" ? "default" : "ghost"
                }
                className={cn(
                  "gap-3 h-10 items-center",
                  collapsed
                    ? "w-10 justify-center p-0"
                    : "w-full justify-start px-1",
                  location.pathname === "/settings" && "text-primary-foreground"
                )}
                asChild
              >
                <Link to="/settings">
                  <Settings className="h-5 w-5 flex-shrink-0 items-center" />
                  <span className={cn("font-medium", collapsed && "sr-only")}>
                    Settings
                  </span>
                </Link>
              </Button>
            </SidebarTooltip>
          )}

          <ProfileButton collapsed={collapsed} />

          {/* Social buttons */}
          <div
            className={cn(
              "flex gap-2",
              collapsed ? "flex-col items-center" : "flex-col sm:flex-row"
            )}
          >
            {/* Slack */}
            <SidebarTooltip
              collapsed={collapsed}
              label="Join our Slack community"
              side="top"
            >
              <Button
                variant="ghost"
                className={cn(
                  "h-8 w-8 p-1 flex items-center justify-center transition-all duration-200",
                  "border-0 shadow-none rounded-lg",
                  collapsed ? "flex-col" : "flex-row"
                )}
                asChild
              >
                <a
                  href="https://join.slack.com/t/opsimate/shared_invite/zt-39bq3x6et-NrVCZzH7xuBGIXmOjJM7gA"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Join our Slack community"
                >
                  <img
                    src="images/slack.png"
                    alt="Slack"
                    className="h-5 w-5 object-contain invert dark:invert-0"
                  />
                </a>
              </Button>
            </SidebarTooltip>

            {/* GitHub */}
            <SidebarTooltip
              collapsed={collapsed}
              label="Star us on GitHub ⭐"
              side="top"
            >
              <Button
                variant="ghost"
                className={cn(
                  "h-8 w-8 p-1 flex items-center justify-center transition-all duration-200",
                  "border-0 shadow-none rounded-lg",
                  collapsed ? "flex-col" : "flex-row"
                )}
              >
                <a
                  href="https://github.com/opsimate/opsimate"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Github link"
                ></a>
                <img
                  src="images/git.png"
                  alt="GitHub"
                  className="h-5 w-5 object-contain invert dark:invert-0"
                />
              </Button>
            </SidebarTooltip>

            <p
              className={cn(
                "text-xs text-muted-foreground",
                collapsed && "sr-only"
              )}
            >
              © 2024 OpsiMate
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
