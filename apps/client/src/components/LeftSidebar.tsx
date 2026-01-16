import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Bell, LayoutDashboard, Puzzle, Settings } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { isAdmin, isEditor } from '../lib/auth';
import { AppIcon } from './icons/AppIcon';
import { ALERTS_PATHS } from './LeftSidebar.constants';
import { PreserveQueryLink } from './PreserveQueryLink';
import { ProfileButton } from './ProfileButton';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@radix-ui/react-tooltip';

interface LeftSidebarProps {
	collapsed: boolean;
}

export const LeftSidebar = ({ collapsed }: LeftSidebarProps) => {
	const location = useLocation();
	const isAlertsActive = ALERTS_PATHS.includes(location.pathname as (typeof ALERTS_PATHS)[number]);
	const showIntegrations = isEditor();
	const showSettings = isAdmin();
	return (
		<div className={cn('w-full bg-background flex flex-col h-full overflow-hidden', collapsed && 'items-center')}>
			<PreserveQueryLink
				to="/"
				className={cn(
					'flex items-center h-20 px-5 border-b cursor-pointer transition-all duration-200',
					collapsed && 'justify-center px-2'
				)}
			>
				<div className="flex items-center">
					<div className="relative w-11 h-11 flex-shrink-0 transition-all duration-200 hover:drop-shadow-lg hover:scale-110">
						<AppIcon className="w-full h-full text-primary" />
					</div>
					<div className={cn('ml-3', collapsed && 'sr-only')}>
						<h2 className="text-xl font-bold text-foreground whitespace-nowrap tracking-tight">OpsiMate</h2>
						<p className="text-xs text-foreground">Operational Insights</p>
					</div>
				</div>
			</PreserveQueryLink>

			<div
				className={cn(
					'px-4 space-y-2 w-full flex-grow flex flex-col pt-4',
					collapsed && 'px-2 items-center space-y-1'
				)}
			>
				<Button
					variant={isAlertsActive ? 'default' : 'ghost'}
					className={cn(
						'gap-3 h-10 text-foreground hover:bg-muted hover:text-foreground',
						collapsed ? 'w-10 justify-center p-0' : 'w-full justify-start px-3',
						isAlertsActive && 'text-primary-foreground'
					)}
					asChild
				>
					<PreserveQueryLink to="/">
						<Bell className="h-5 w-5 flex-shrink-0" />
						<span className={cn('font-medium', collapsed && 'sr-only')}>Alerts</span>
					</PreserveQueryLink>
				</Button>

				<Button
					variant={location.pathname === '/dashboards' ? 'default' : 'ghost'}
					className={cn(
						'gap-3 h-10 text-foreground hover:bg-muted hover:text-foreground',
						collapsed ? 'w-10 justify-center p-0' : 'w-full justify-start px-3',
						location.pathname === '/dashboards' && 'text-primary-foreground'
					)}
					asChild
				>
					<PreserveQueryLink to="/dashboards">
						<LayoutDashboard className="h-5 w-5 flex-shrink-0" />
						<span className={cn('font-medium', collapsed && 'sr-only')}>Dashboards</span>
					</PreserveQueryLink>
				</Button>
			</div>

			<div className={cn('p-4 mt-auto flex flex-col gap-3', collapsed && 'items-center')}>
				<div className={cn('flex flex-col gap-2 items-center')}>
					{showIntegrations && (
						<Button
							variant={location.pathname === '/integrations' ? 'default' : 'ghost'}
							className={cn(
								'gap-3 h-10 items-center text-foreground hover:bg-muted hover:text-foreground',
								collapsed ? 'w-10 justify-center p-0' : 'w-full justify-start px-3',
								location.pathname === '/integrations' && 'text-primary-foreground'
							)}
							asChild
						>
							<PreserveQueryLink to="/integrations">
								<Puzzle className="h-5 w-5 flex-shrink-0" />
								<span className={cn('font-medium', collapsed && 'sr-only')}>Integrations</span>
							</PreserveQueryLink>
						</Button>
					)}
					{showSettings && (
						<Button
							variant={location.pathname === '/settings' ? 'default' : 'ghost'}
							className={cn(
								'gap-3 h-10 items-center text-foreground hover:bg-muted hover:text-foreground',
								collapsed ? 'w-10 justify-center p-0' : 'w-full justify-start px-3',
								location.pathname === '/settings' && 'text-primary-foreground'
							)}
							asChild
						>
							<PreserveQueryLink to="/settings">
								<Settings className="h-5 w-5 flex-shrink-0 items-center" />
								<span className={cn('font-medium', collapsed && 'sr-only')}>Settings</span>
							</PreserveQueryLink>
						</Button>
					)}
					<ProfileButton collapsed={collapsed} />

					<TooltipProvider>
						<div className="flex flex-col items-center gap-2">
							<div className={cn('flex gap-2', collapsed && 'gap-0.5')}>
								<Tooltip>
									<TooltipTrigger asChild>
										<div
											className="h-8 w-8 p-1 flex items-center justify-center transition-all duration-200 cursor-pointer hover:bg-muted rounded-md"
											onClick={() =>
												window.open(
													'https://join.slack.com/t/opsimate/shared_invite/zt-39bq3x6et-NrVCZzH7xuBGIXmOjJM7gA',
													'_blank'
												)
											}
										>
											<img
												src="images/slack.png"
												alt="Slack"
												className="h-5 w-5 object-contain invert dark:invert-0"
											/>
										</div>
									</TooltipTrigger>
									<TooltipContent
										side="top"
										align="center"
										className="rounded-md bg-popover text-popover-foreground px-2 py-1 text-sm border"
									>
										Join our Slack community
									</TooltipContent>
								</Tooltip>

								<Tooltip>
									<TooltipTrigger asChild>
										<div
											className="h-8 w-8 p-1 flex items-center justify-center transition-all duration-200 cursor-pointer hover:bg-muted rounded-md"
											onClick={() =>
												window.open('https://github.com/opsimate/opsimate', '_blank')
											}
										>
											<img
												src="images/git.png"
												alt="GitHub"
												className="h-5 w-5 object-contain invert dark:invert-0"
											/>
										</div>
									</TooltipTrigger>
									<TooltipContent
										side="top"
										align="center"
										className="rounded-md bg-popover text-popover-foreground px-2 py-1 text-sm border"
									>
										Star us on GitHub ⭐
									</TooltipContent>
								</Tooltip>
							</div>

							<p className={cn('text-xs text-foreground', collapsed && 'sr-only')}>© 2024 OpsiMate</p>
						</div>
					</TooltipProvider>
				</div>
			</div>
		</div>
	);
};
