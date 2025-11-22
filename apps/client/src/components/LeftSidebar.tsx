import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Bell, Database, Layers, LayoutDashboard, Puzzle, Settings, Zap } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { isAdmin, isEditor } from '../lib/auth';
import { AppIcon } from './icons/AppIcon';
import { ProfileButton } from './ProfileButton';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@radix-ui/react-tooltip';

interface LeftSidebarProps {
	collapsed: boolean;
}

export const LeftSidebar = ({ collapsed }: LeftSidebarProps) => {
	const location = useLocation();
	return (
		<div className={cn('w-full bg-background flex flex-col h-full overflow-hidden', collapsed && 'items-center')}>
			<Link
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
						<p className="text-xs text-muted-foreground">Operational Insights</p>
					</div>
				</div>
			</Link>

			<div
				className={cn(
					'px-4 space-y-2 w-full flex-grow flex flex-col pt-4',
					collapsed && 'px-2 items-center space-y-1'
				)}
			>
				<Button
					variant={location.pathname === '/alerts' ? 'default' : 'ghost'}
					className={cn(
						'gap-3 h-10',
						collapsed ? 'w-10 justify-center p-0' : 'w-full justify-start px-3',
						location.pathname === '/alerts' && 'text-primary-foreground'
					)}
					asChild
				>
					<Link to="/alerts">
						<Bell className="h-5 w-5 flex-shrink-0" />
						<span className={cn('font-medium', collapsed && 'sr-only')}>Alerts</span>
					</Link>
				</Button>

				<Button
					variant={location.pathname === '/' ? 'default' : 'ghost'}
					className={cn(
						'gap-3 h-10',
						collapsed ? 'w-10 justify-center p-0' : 'w-full justify-start px-3',
						location.pathname === '/' && 'text-primary-foreground'
					)}
					asChild
				>
					<Link to="/">
						<LayoutDashboard className="h-5 w-5 flex-shrink-0" />
						<span className={cn('font-medium', collapsed && 'sr-only')}>Dashboard</span>
					</Link>
				</Button>

				{isEditor() && (
					<Button
						variant={location.pathname === '/providers' ? 'default' : 'ghost'}
						className={cn(
							'gap-3 h-10',
							collapsed ? 'w-10 justify-center p-0' : 'w-full justify-start px-3',
							location.pathname === '/providers' && 'text-primary-foreground'
						)}
						asChild
					>
						<Link to="/providers">
							<Database className="h-5 w-5 flex-shrink-0" />
							<span className={cn('font-medium', collapsed && 'sr-only')}>Providers</span>
						</Link>
					</Button>
				)}

				{isEditor() && (
					<Button
						variant={location.pathname === '/integrations' ? 'default' : 'ghost'}
						className={cn(
							'gap-3 h-10',
							collapsed ? 'w-10 justify-center p-0' : 'w-full justify-start px-3',
							location.pathname === '/integrations' && 'text-primary-foreground'
						)}
						asChild
					>
						<Link to="/integrations">
							<Puzzle className="h-5 w-5 flex-shrink-0" />
							<span className={cn('font-medium', collapsed && 'sr-only')}>Integrations</span>
						</Link>
					</Button>
				)}
				{isEditor() && (
					<Button
						variant={location.pathname === '/actions' ? 'default' : 'ghost'}
						className={cn(
							'gap-3 h-10',
							collapsed ? 'w-10 justify-center p-0' : 'w-full justify-start px-3',
							location.pathname === '/actions' && 'text-primary-foreground'
						)}
						asChild
					>
						<Link to="/actions">
							<Zap className="h-5 w-5 flex-shrink-0" />
							<span className={cn('font-medium', collapsed && 'sr-only')}>Actions</span>
						</Link>
					</Button>
				)}
			</div>

			<div className={cn('p-4 mt-auto flex flex-col gap-3', collapsed && 'items-center')}>
				<div className={cn('flex flex-col gap-2 items-center')}>
					{isAdmin() && (
						<Button
							variant={location.pathname === '/settings' ? 'default' : 'ghost'}
							className={cn(
								'gap-3 h-10 items-center',
								collapsed ? 'w-10 justify-center p-0' : 'w-full justify-start px-3',
								location.pathname === '/settings' && 'text-primary-foreground'
							)}
							asChild
						>
							<Link to="/settings">
								<Settings className="h-5 w-5 flex-shrink-0 items-center" />
								<span className={cn('font-medium', collapsed && 'sr-only')}>Settings</span>
							</Link>
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
										className="rounded-md bg-gray-800 text-white px-2 py-1 text-sm"
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
										className="rounded-md bg-gray-800 text-white px-2 py-1 text-sm"
									>
										Star us on GitHub ⭐
									</TooltipContent>
								</Tooltip>
							</div>

							<p className={cn('text-xs text-muted-foreground', collapsed && 'sr-only')}>
								© 2024 OpsiMate
							</p>
						</div>
					</TooltipProvider>
				</div>
			</div>
		</div>
	);
};
