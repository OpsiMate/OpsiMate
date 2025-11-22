import { LeftSidebar } from '@/components/LeftSidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface DashboardLayoutProps {
	children: React.ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
	const [isSidebarCollapsed, setSidebarCollapsed] = useState(() => {
		const savedState = localStorage.getItem('sidebarCollapsed');
		return savedState ? JSON.parse(savedState) : false;
	});
	const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

	useEffect(() => {
		localStorage.setItem('sidebarCollapsed', JSON.stringify(isSidebarCollapsed));
	}, [isSidebarCollapsed]);

	useEffect(() => {
		const handleResize = () => {
			// 850px is a reasonable breakpoint to ensure there's enough space for the main content
			if (window.innerWidth < 850 && !isSidebarCollapsed) {
				setSidebarCollapsed(true);
			}
		};

		handleResize();
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, [isSidebarCollapsed]);

	return (
		<div className="flex flex-col h-screen">
			{/* Mobile Header */}
			<div className="md:hidden flex items-center justify-between p-4 border-b border-border">
				<Button
					variant="ghost"
					size="icon"
					onClick={() => setMobileSidebarOpen(true)}
					className="h-9 w-9 rounded-md"
				>
					<Menu className="h-5 w-5" />
					<span className="sr-only">Toggle Menu</span>
				</Button>
				<h1 className="text-lg font-semibold">OpsiMate</h1>
			</div>

			{/* Mobile Sidebar (Overlay) */}
			<div
				className={`md:hidden fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${mobileSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
				onClick={() => setMobileSidebarOpen(false)}
			>
				<div
					className={`fixed left-0 top-0 h-full z-50 bg-card w-72 shadow-xl transition-transform duration-200 ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
					onClick={(e) => e.stopPropagation()}
				>
					<LeftSidebar collapsed={false} />
					<button
						className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted transition-colors"
						onClick={() => setMobileSidebarOpen(false)}
						aria-label="Close sidebar"
					>
						<X className="h-5 w-5" />
					</button>
				</div>
			</div>

			{/* Main Content Area */}
			<div className="flex flex-1 overflow-hidden">
				{/* Desktop Sidebar */}
				<div
					className={cn(
						'bg-background border-r border-border transition-all duration-300 ease-in-out hidden md:block',
						isSidebarCollapsed ? 'w-[70px]' : 'w-[207px]'
					)}
				>
					<LeftSidebar collapsed={isSidebarCollapsed} />
				</div>

				<div className="flex-1 min-w-0 relative bg-muted/20 w-full">
					{/* Desktop Sidebar Toggle Button */}
					<Button
						onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
						variant="ghost"
						size="icon"
						className="z-10 absolute top-1/2 -left-4 -translate-y-1/2 border bg-background hover:bg-muted rounded-full h-8 w-8 hidden md:flex items-center justify-center !p-0"
					>
						{isSidebarCollapsed ? (
							<ChevronRight className="h-4 w-4" />
						) : (
							<ChevronLeft className="h-4 w-4" />
						)}
					</Button>
					<main className="h-full overflow-auto w-full">{children}</main>
				</div>
			</div>
		</div>
	);
};
