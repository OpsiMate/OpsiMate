import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export const ThemePreferences = () => {
	const { theme, setTheme } = useTheme();

	return (
		<div className="space-y-4 border-t pt-6">
			<div className="flex items-center gap-3">
				<Sun className="h-5 w-5 text-gray-500" />
				<h3 className="font-semibold">Theme Preferences</h3>
			</div>

			<div className="flex gap-2">
				<Button
					variant={theme === 'light' ? 'default' : 'outline'}
					onClick={() => setTheme('light')}
					className="flex items-center gap-2"
				>
					<Sun className="h-4 w-4" />
					Light
				</Button>
				<Button
					variant={theme === 'dark' ? 'default' : 'outline'}
					onClick={() => setTheme('dark')}
					className="flex items-center gap-2"
				>
					<Moon className="h-4 w-4" />
					Dark
				</Button>
				<Button
					variant={theme === 'system' ? 'default' : 'outline'}
					onClick={() => setTheme('system')}
					className="flex items-center gap-2"
				>
					<div className="h-4 w-4 rounded border-2 border-current" />
					System
				</Button>
			</div>
		</div>
	);
};
