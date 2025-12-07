import { Logger } from '@OpsiMate/shared';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const logger = new Logger('NotFound');

const NotFound = () => {
	const location = useLocation();

	useEffect(() => {
		logger.warn('404 Error: User attempted to access non-existent route:', location.pathname);
	}, [location.pathname]);

	return (
		<div className="min-h-screen flex items-center justify-center bg-background">
			<div className="text-center">
				<h1 className="text-4xl font-bold mb-4 text-foreground">404</h1>
				<p className="text-xl text-muted-foreground mb-4">Oops! Page not found</p>
				<a href="/" className="text-primary hover:text-primary/80 underline">
					Return to Home
				</a>
			</div>
		</div>
	);
};

export default NotFound;
