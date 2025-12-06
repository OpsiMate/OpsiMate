import { GCPIcon } from '@/components/icons/GCPIcon';
import { GrafanaIcon } from '@/components/icons/GrafanaIcon';
import { UptimeKumaIcon } from '@/components/icons/UptimeKumaIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Alert, AlertStatus } from '@OpsiMate/shared';
import { format } from 'date-fns';
import { Archive, Bell, Book, Calendar, Check, Clock, ExternalLink, RotateCcw, Trash2, X } from 'lucide-react';
import { getAlertTagEntries, hasAlertTags } from '../utils/alertTags.utils';

interface AlertDetailsProps {
	isActive: boolean;
	alert: Alert | null;
	onClose: () => void;
	onDismiss?: (alertId: string) => void;
	onUndismiss?: (alertId: string) => void;
	onDelete?: (alertId: string) => void;
	className?: string;
}

export const AlertDetails = ({
	isActive,
	alert,
	onClose,
	onDismiss,
	onUndismiss,
	onDelete,
	className,
}: AlertDetailsProps) => {
	if (!alert) return null;

	const getAlertType = (alert: Alert): string => {
		return alert.type || 'Custom';
	};

	const getAlertTypeIcon = (type: string) => {
		switch (type.toLowerCase()) {
			case 'grafana':
				return <GrafanaIcon className="w-6 h-6" />;
			case 'gcp':
				return <GCPIcon className="w-6 h-6" />;
			case 'uptimekuma':
				return <UptimeKumaIcon className="w-6 h-6" />;
			default:
				return (
					<div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center border border-border">
						<Bell className="w-4 h-4 text-foreground" />
					</div>
				);
		}
	};

	const alertType = getAlertType(alert);

	return (
		<div className={cn('h-full flex flex-col bg-background border-l', className)}>
			<div className="flex items-center justify-between p-4 border-b">
				<h2 className="text-lg font-semibold text-foreground">Alert Details</h2>
				<Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-foreground">
					<X className="h-4 w-4" />
				</Button>
			</div>

			<ScrollArea className="flex-1">
				<div className="p-4 space-y-4">
					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-3">
							<div className="flex-shrink-0">{getAlertTypeIcon(alertType)}</div>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2 flex-wrap">
									<h3 className="text-lg font-semibold break-words flex-1 min-w-0 text-foreground">
										{alert.alertName}
									</h3>
									<Badge
										variant={
											alert.isDismissed
												? 'secondary'
												: alert.status === AlertStatus.FIRING
													? 'destructive'
													: 'secondary'
										}
										className="flex-shrink-0"
									>
										{alert.isDismissed ? 'Dismissed' : alert.status}
									</Badge>
								</div>
							</div>
						</div>
					{hasAlertTags(alert) && (
						<div className="flex items-center gap-1 flex-wrap">
							{getAlertTagEntries(alert).map(({ key, value }) => (
								<Badge key={key} variant="outline" className="text-xs">
									{key}: {value}
								</Badge>
							))}
						</div>
					)}
					</div>

					{alert.summary && (
						<>
							<Separator />
							<div>
								<p className="text-sm text-foreground leading-relaxed">{alert.summary}</p>
							</div>
						</>
					)}

					<Separator />

					<div className="space-y-3">
						<div className="flex items-start gap-3">
							<Calendar className="h-4 w-4 text-foreground mt-0.5 flex-shrink-0" />
							<div className="flex-1 min-w-0">
								<div className="text-xs font-medium text-foreground mb-1">Started At</div>
								<div className="text-sm text-foreground">
									{(() => {
										const date = new Date(alert.startsAt);
										return isNaN(date.getTime()) ? 'Invalid Date' : format(date, 'PPpp');
									})()}
								</div>
							</div>
						</div>

						{alert.updatedAt && (
							<div className="flex items-start gap-3">
								<Clock className="h-4 w-4 text-foreground mt-0.5 flex-shrink-0" />
								<div className="flex-1 min-w-0">
									<div className="text-xs font-medium text-foreground mb-1">Last Updated</div>
									<div className="text-sm text-foreground">
										{(() => {
											const date = new Date(alert.updatedAt);
											return isNaN(date.getTime()) ? 'Invalid Date' : format(date, 'PPpp');
										})()}
									</div>
								</div>
							</div>
						)}
					</div>

					<Separator />

					<div className="grid grid-cols-2 gap-2">
						{alert.alertUrl && (
							<Button
								size="sm"
								className="w-full justify-start gap-2 text-xs h-8"
								onClick={() => window.open(alert.alertUrl, '_blank', 'noopener,noreferrer')}
							>
								<ExternalLink className="h-3 w-3 flex-shrink-0" />
								<span className="truncate">View Source</span>
							</Button>
						)}

						{alert.runbookUrl && (
							<Button
								size="sm"
								className="w-full justify-start gap-2 text-xs h-8"
								onClick={() => window.open(alert.runbookUrl, '_blank', 'noopener,noreferrer')}
							>
								<Book className="h-3 w-3 flex-shrink-0" />
								<span className="truncate">Runbook</span>
							</Button>
						)}
					</div>

					<Separator />

					{isActive ? (
						<div className="space-y-2">
							{alert.isDismissed ? (
								<Button
									size="sm"
									className="w-full justify-start gap-2"
									onClick={() => onUndismiss?.(alert.id)}
								>
									<RotateCcw className="h-3 w-3" />
									Undismiss Alert
								</Button>
							) : (
								<Button
									size="sm"
									className="w-full justify-start gap-2"
									onClick={() => onDismiss?.(alert.id)}
								>
									<Check className="h-3 w-3" />
									Dismiss Alert
								</Button>
							)}
							<Button
								size="sm"
								variant="outline"
								className="w-full justify-start gap-2"
								onClick={() => onDelete?.(alert.id)}
							>
								<Archive className="h-3 w-3" />
								Archive Alert
							</Button>
						</div>
					) : (
						<div className="space-y-2">
							<Button
								size="sm"
								variant="destructive"
								className="w-full justify-start gap-2"
								onClick={() => onDelete?.(alert.id)}
							>
								<Trash2 className="h-3 w-3" />
								Delete Alert
							</Button>
						</div>
					)}

					<div className="pt-2">
						<div className="text-xs font-medium text-foreground mb-1">Alert ID</div>
						<code className="text-xs bg-muted px-2 py-1 rounded break-all block text-foreground">
							{alert.id}
						</code>
					</div>
				</div>
			</ScrollArea>
		</div>
	);
};
