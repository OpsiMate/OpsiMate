import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import {
	AlertCircle,
	Bell,
	BellOff,
	Calendar,
	Clock,
	ExternalLink,
	FileText,
	Globe,
	Info,
	Link,
	RotateCcw,
	Tag,
	X,
} from 'lucide-react';
import { format } from 'date-fns';

interface AlertDetailsProps {
	alert: Alert | null;
	onClose: () => void;
	onDismiss?: (alertId: string) => void;
	onUndismiss?: (alertId: string) => void;
	className?: string;
}

export const AlertDetails = ({
	alert,
	onClose,
	onDismiss,
	onUndismiss,
	className,
}: AlertDetailsProps) => {
	if (!alert) return null;

	const getAlertType = (alert: Alert): string => {
		// Extract type from alert ID or tag
		if (alert.id.toLowerCase().includes('grafana')) return 'Grafana';
		if (alert.tag?.toLowerCase().includes('prometheus')) return 'Prometheus';
		if (alert.tag?.toLowerCase().includes('datadog')) return 'Datadog';
		return 'Custom';
	};

	const getAlertTypeIcon = (type: string) => {
		switch (type.toLowerCase()) {
			case 'grafana':
				return (
					<div className="w-5 h-5 flex items-center justify-center">
						<svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
							<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
						</svg>
					</div>
				);
			case 'prometheus':
				return <AlertCircle className="w-5 h-5" />;
			case 'datadog':
				return <Globe className="w-5 h-5" />;
			default:
				return <Bell className="w-5 h-5" />;
		}
	};

	const alertType = getAlertType(alert);

	return (
		<div className={cn('h-full flex flex-col bg-background border-l', className)}>
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b">
				<div className="flex items-center gap-2">
					{getAlertTypeIcon(alertType)}
					<h2 className="text-lg font-semibold">Alert Details</h2>
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={onClose}
					className="h-8 w-8"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>

			{/* Content */}
			<ScrollArea className="flex-1">
				<div className="p-4 space-y-6">
					{/* Alert Name and Status */}
					<div>
						<h3 className="text-xl font-semibold mb-2">{alert.alertName}</h3>
						<div className="flex items-center gap-2">
							<Badge
								variant={alert.isDismissed ? 'secondary' : 'destructive'}
								className="gap-1"
							>
								{alert.isDismissed ? (
									<BellOff className="h-3 w-3" />
								) : (
									<Bell className="h-3 w-3" />
								)}
								{alert.isDismissed ? 'Dismissed' : 'Firing'}
							</Badge>
							<Badge variant="outline" className="gap-1">
								{getAlertTypeIcon(alertType)}
								{alertType}
							</Badge>
						</div>
					</div>

					<Separator />

					{/* Summary */}
					{alert.summary && (
						<div className="space-y-2">
							<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
								<Info className="h-4 w-4" />
								Summary
							</div>
							<p className="text-sm">{alert.summary}</p>
						</div>
					)}

					{/* Tag */}
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
							<Tag className="h-4 w-4" />
							Tag
						</div>
						<Badge variant="secondary">{alert.tag}</Badge>
					</div>

					{/* Timestamps */}
					<div className="space-y-3">
						<div className="space-y-2">
							<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
								<Calendar className="h-4 w-4" />
								Started At
							</div>
							<p className="text-sm">
								{format(new Date(alert.startsAt), 'PPpp')}
							</p>
						</div>

						{alert.updatedAt && (
							<div className="space-y-2">
								<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
									<Clock className="h-4 w-4" />
									Last Updated
								</div>
								<p className="text-sm">
									{format(new Date(alert.updatedAt), 'PPpp')}
								</p>
							</div>
						)}

						{alert.createdAt && (
							<div className="space-y-2">
								<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
									<Clock className="h-4 w-4" />
									Created At
								</div>
								<p className="text-sm">
									{format(new Date(alert.createdAt), 'PPpp')}
								</p>
							</div>
						)}
					</div>

					<Separator />

					{/* Links */}
					<div className="space-y-3">
						{alert.alertUrl && (
							<div className="space-y-2">
								<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
									<Link className="h-4 w-4" />
									Alert URL
								</div>
								<Button
									variant="outline"
									size="sm"
									className="w-full justify-start gap-2"
									onClick={() => window.open(alert.alertUrl, '_blank', 'noopener,noreferrer')}
								>
									<ExternalLink className="h-3 w-3" />
									View in Source
								</Button>
							</div>
						)}

						{alert.runbookUrl && (
							<div className="space-y-2">
								<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
									<FileText className="h-4 w-4" />
									Runbook
								</div>
								<Button
									variant="outline"
									size="sm"
									className="w-full justify-start gap-2"
									onClick={() => window.open(alert.runbookUrl, '_blank', 'noopener,noreferrer')}
								>
									<ExternalLink className="h-3 w-3" />
									Open Runbook
								</Button>
							</div>
						)}
					</div>

					<Separator />

					{/* Actions */}
					<div className="space-y-2">
						<div className="text-sm font-medium text-muted-foreground mb-2">Actions</div>
						{alert.isDismissed ? (
							<Button
								variant="outline"
								size="sm"
								className="w-full justify-start gap-2"
								onClick={() => onUndismiss?.(alert.id)}
							>
								<RotateCcw className="h-3 w-3" />
								Undismiss Alert
							</Button>
						) : (
							<Button
								variant="outline"
								size="sm"
								className="w-full justify-start gap-2"
								onClick={() => onDismiss?.(alert.id)}
							>
								<X className="h-3 w-3" />
								Dismiss Alert
							</Button>
						)}
					</div>

					{/* Alert ID */}
					<div className="space-y-2">
						<div className="text-sm font-medium text-muted-foreground">Alert ID</div>
						<code className="text-xs bg-muted px-2 py-1 rounded break-all">{alert.id}</code>
					</div>
				</div>
			</ScrollArea>
		</div>
	);
};
