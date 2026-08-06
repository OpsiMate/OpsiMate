import { Button } from '@/components/ui/button';
import { Logger } from '@OpsiMate/shared';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component, ErrorInfo, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

const logger = new Logger('ErrorBoundary');

interface ErrorBoundaryProps {
	children: ReactNode;
}

interface ErrorBoundaryState {
	error: Error | null;
}

// Last line of defense for render-time exceptions: without a boundary React unmounts
// the entire tree and the user gets an unexplained white screen. This renders a
// readable error card instead (message + component stack) with recovery actions.
class ErrorBoundaryInner extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	state: ErrorBoundaryState = { error: null };

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		logger.error(`Unhandled render error: ${error.message}\n${info.componentStack ?? ''}`, error);
	}

	render() {
		const { error } = this.state;
		if (!error) {
			return this.props.children;
		}

		return (
			<div className="flex h-screen items-center justify-center bg-background p-6">
				<div className="w-full max-w-xl rounded-lg border bg-card p-6 shadow-sm">
					<div className="flex items-center gap-3">
						<AlertTriangle className="h-6 w-6 shrink-0 text-destructive" />
						<h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
					</div>
					<p className="mt-2 text-sm text-muted-foreground">
						The page hit an unexpected error while rendering. You can try again, or reload the app.
					</p>
					<pre className="mt-4 max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs text-foreground whitespace-pre-wrap break-words">
						{error.message}
						{error.stack ? `\n\n${error.stack.split('\n').slice(1, 6).join('\n')}` : ''}
					</pre>
					<div className="mt-4 flex gap-2">
						<Button onClick={() => window.location.reload()} className="gap-1.5">
							<RefreshCw className="h-4 w-4" />
							Reload app
						</Button>
						<Button variant="outline" onClick={() => this.setState({ error: null })}>
							Try again
						</Button>
					</div>
				</div>
			</div>
		);
	}
}

// Keyed by pathname so navigating to another page automatically clears a caught error —
// a crash on one route must not brick the rest of the app.
export const ErrorBoundary = ({ children }: ErrorBoundaryProps) => {
	const location = useLocation();
	return <ErrorBoundaryInner key={location.pathname}>{children}</ErrorBoundaryInner>;
};
