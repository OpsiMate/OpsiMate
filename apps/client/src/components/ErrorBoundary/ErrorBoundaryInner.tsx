import { Button } from '@/components/ui/button';
import { Logger } from '@OpsiMate/shared';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component, ErrorInfo, ReactNode } from 'react';

const logger = new Logger('ErrorBoundary');

export interface ErrorBoundaryInnerProps {
	children: ReactNode;
}

interface ErrorBoundaryInnerState {
	error: Error | null;
}

// Last line of defense for render-time exceptions: without a boundary React unmounts
// the entire tree and the user gets an unexplained white screen. This renders a
// readable error card instead, with recovery actions. The full stack goes to the
// logger; the card shows the message always and the stack only in dev builds.
export class ErrorBoundaryInner extends Component<ErrorBoundaryInnerProps, ErrorBoundaryInnerState> {
	state: ErrorBoundaryInnerState = { error: null };

	static getDerivedStateFromError(error: Error): ErrorBoundaryInnerState {
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
						{import.meta.env.DEV && error.stack
							? `\n\n${error.stack.split('\n').slice(1, 6).join('\n')}`
							: ''}
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
