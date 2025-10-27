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

export function LeftSidebar({ collapsed }: LeftSidebarProps) {
  const location = useLocation();

  return (
    <div
      className={cn(
        "w-full bg-background flex flex-col h-full overflow-hidden",
        collapsed && "items-center"
      )}
    >
      {/* Logo section */}
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

      {/* Navigation section */}
      <div
        className={cn(
          "px-4 space-y-2 w-full flex-grow flex flex-col",
          collapsed && "px-2 items-center"
        )}
      >
        <Tooltip.Provider delayDuration={100}>
          {/* Dashboard */}
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
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
            </Tooltip.Trigger>
            <Tooltip.Content
              side="top"
              align="center"
              sideOffset={6}
              className="z-50 rounded-md bg-gray-800 text-white px-2 py-1 text-sm shadow-lg"
            >
              Dashboard
              <Tooltip.Arrow className="fill-gray-800" />
            </Tooltip.Content>
          </Tooltip.Root>

          {/* Add Providers */}
          {isEditor() && (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <Button
                  variant={
                    location.pathname === "/providers" ? "default" : "ghost"
                  }
                  className={cn(
                    "gap-3 h-10",
                    collapsed
                      ? "w-10 justify-center p-0"
                      : "w-full justify-start px-3",
                    location.pathname === "/providers" &&
                      "text-primary-foreground"
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
              </Tooltip.Trigger>
              <Tooltip.Content
                side="top"
                align="center"
                sideOffset={6}
                className="z-50 rounded-md bg-gray-800 text-white px-2 py-1 text-sm shadow-lg"
              >
                Add Providers
                <Tooltip.Arrow className="fill-gray-800" />
              </Tooltip.Content>
            </Tooltip.Root>
          )}

          {/* My Providers */}
          {!isViewer() && (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
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
              </Tooltip.Trigger>
              <Tooltip.Content
                side="top"
                align="center"
                sideOffset={6}
                className="z-50 rounded-md bg-gray-800 text-white px-2 py-1 text-sm shadow-lg"
              >
                My Providers
                <Tooltip.Arrow className="fill-gray-800" />
              </Tooltip.Content>
            </Tooltip.Root>
          )}

          {/* Integrations */}
          {isEditor() && (
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
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
              </Tooltip.Trigger>
              <Tooltip.Content
                side="top"
                align="center"
                sideOffset={6}
                className="z-50 rounded-md bg-gray-800 text-white px-2 py-1 text-sm shadow-lg"
              >
                Integrations
                <Tooltip.Arrow className="fill-gray-800" />
              </Tooltip.Content>
            </Tooltip.Root>
          )}

          {/* Alerts */}
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
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
            </Tooltip.Trigger>
            <Tooltip.Content
              side="top"
              align="center"
              sideOffset={6}
              className="z-50 rounded-md bg-gray-800 text-white px-2 py-1 text-sm shadow-lg"
            >
              Alerts
              <Tooltip.Arrow className="fill-gray-800" />
            </Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>

      {/* Bottom section */}
      <div
        className={cn(
          "p-4 mt-auto flex flex-col gap-3",
          collapsed && "items-center"
        )}
      >
        <div className={cn("flex flex-col gap-2 items-center")}>
          {isAdmin() && (
            <Tooltip.Provider>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <Button
                    variant={
                      location.pathname === "/settings" ? "default" : "ghost"
                    }
                    className={cn(
                      "gap-3 h-10 items-center",
                      collapsed
                        ? "w-10 justify-center p-0"
                        : "w-full justify-start px-1",
                      location.pathname === "/settings" &&
                        "text-primary-foreground"
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
                </Tooltip.Trigger>
                <Tooltip.Content
                  side="top"
                  align="center"
                  sideOffset={6}
                  className="z-50 rounded-md bg-gray-800 text-white px-2 py-1 text-sm shadow-lg"
                >
                  Settings
                  <Tooltip.Arrow className="fill-gray-800" />
                </Tooltip.Content>
              </Tooltip.Root>
            </Tooltip.Provider>
          )}

          <ProfileButton collapsed={collapsed} />

          {/* Social buttons */}
          <Tooltip.Provider delayDuration={100}>
            <div
              className={cn(
                "flex gap-2",
                collapsed ? "flex-col items-center" : "flex-col sm:flex-row"
              )}
            >
              {/* Slack */}
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-8 w-8 p-1 flex items-center justify-center transition-all duration-200",
                      collapsed ? "flex-col" : "flex-row"
                    )}
                    onClick={() =>
                      window.open(
                        "https://join.slack.com/t/opsimate/shared_invite/zt-39bq3x6et-NrVCZzH7xuBGIXmOjJM7gA",
                        "_blank"
                      )
                    }
                  >
                    <img
                      src="images/slack.png"
                      alt="Slack"
                      className="h-5 w-5 object-contain invert dark:invert-0"
                    />
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content
                  side="top"
                  align="center"
                  sideOffset={6}
                  className="z-50 rounded-md bg-gray-800 text-white px-2 py-1 text-sm shadow-lg"
                >
                  Join our Slack community
                  <Tooltip.Arrow className="fill-gray-800" />
                </Tooltip.Content>
              </Tooltip.Root>

              {/* GitHub */}
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-8 w-8 p-1 flex items-center justify-center transition-all duration-200",
                      collapsed ? "flex-col" : "flex-row"
                    )}
                    onClick={() =>
                      window.open("https://github.com/opsimate/opsimate", "_blank")
                    }
                  >
                    <img
                      src="images/git.png"
                      alt="GitHub"
                      className="h-5 w-5 object-contain invert dark:invert-0"
                    />
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content
                  side="top"
                  align="center"
                  sideOffset={6}
                  className="z-50 rounded-md bg-gray-800 text-white px-2 py-1 text-sm shadow-lg"
                >
                  Star us on GitHub ⭐
                  <Tooltip.Arrow className="fill-gray-800" />
                </Tooltip.Content>
              </Tooltip.Root>

              <p
                className={cn(
                  "text-xs text-muted-foreground",
                  collapsed && "sr-only"
                )}
              >
                © 2024 OpsiMate
              </p>
            </div>
          </Tooltip.Provider>
        </div>
      </div>
    </div>
  );
}
