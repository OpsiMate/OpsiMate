import { TriangleAlert } from 'lucide-react';
import { ReactNode } from 'react';

interface SeveritySetupNoteProps {
	// Integration-specific instructions for where to put the severity value.
	children: ReactNode;
}

// Shared "how to set alert severity" box for the integration setup modals. The
// integration-specific part comes in as children; the allowed values and default
// behavior are the same everywhere.
export const SeveritySetupNote = ({ children }: SeveritySetupNoteProps) => (
	<div className="bg-muted/40 border rounded-lg p-4 space-y-2">
		<h4 className="font-semibold text-sm flex items-center gap-2 text-foreground">
			<TriangleAlert className="h-4 w-4 text-amber-500" />
			Setting alert severity
		</h4>
		<div className="text-sm text-muted-foreground space-y-1">{children}</div>
		<p className="text-xs text-muted-foreground">
			Allowed values: <code>critical</code>, <code>warning</code>, <code>info</code>. Common synonyms (
			<code>P1</code>, <code>error</code>, <code>high</code>, <code>disaster</code>, <code>low</code>, …) are
			mapped automatically. Alerts without a recognized severity default to <code>warning</code>.
		</p>
	</div>
);
