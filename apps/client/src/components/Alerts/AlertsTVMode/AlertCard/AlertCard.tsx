import { Alert } from '@OpsiMate/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Archive, Book, Check, ExternalLink, MoreVertical, RotateCcw, X } from 'lucide-react';
import { CardSize } from '../AlertsTVMode.constants';
import { AlertCardIcon } from '../AlertCardIcon';

interface AlertCardProps {
	alert: Alert;
	cardSize: CardSize;
	serviceName: string;
	onDismissAlert: (alertId: string) => void;
	onUndismissAlert: (alertId: string) => void;
}

export const AlertCard = ({ alert, cardSize, serviceName, onDismissAlert, onUndismissAlert }: AlertCardProps) => {
	const showDetails = cardSize === 'large' || cardSize === 'medium';
	const showSummary = cardSize === 'large';
	const statusColor = alert.isDismissed ? 'border-muted bg-muted/10' : 'border-destructive bg-destructive/10';

	return (
		<Card
			key={alert.id}
			className={cn('transition-all hover:shadow-lg cursor-pointer relative overflow-hidden', statusColor)}
		>
			<CardHeader className={cn('pb-2', cardSize === 'extra-small' ? 'p-2' : 'p-3')}>
				<div className="flex items-start justify-between gap-1">
					<div className="flex items-start gap-2 flex-1 min-w-0">
						<AlertCardIcon alert={alert} />
						<div className="flex-1 min-w-0">
							<h3
								className={cn(
									'font-semibold truncate text-foreground',
									cardSize === 'extra-small' ? 'text-xs' : 'text-sm'
								)}
								title={alert.alertName}
							>
								{alert.alertName}
							</h3>
							{showDetails && (
								<div className="flex items-center gap-2 mt-1">
									<Badge variant="outline" className="text-[10px] px-1 py-0">
										{alert.tag}
									</Badge>
									{serviceName !== '-' && (
										<span className="text-[10px] text-foreground truncate">{serviceName}</span>
									)}
								</div>
							)}
						</div>
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className={cn('h-5 w-5 p-0', cardSize === 'extra-small' && 'h-4 w-4')}
								onClick={(e) => e.stopPropagation()}
							>
								<MoreVertical className="h-3 w-3" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{alert.runbookUrl && (
								<DropdownMenuItem
									onClick={() => window.open(alert.runbookUrl, '_blank', 'noopener,noreferrer')}
								>
									<Book className="mr-2 h-3 w-3" />
									Open Runbook
								</DropdownMenuItem>
							)}
							{alert.alertUrl && (
								<DropdownMenuItem
									onClick={() => window.open(alert.alertUrl, '_blank', 'noopener,noreferrer')}
								>
									<ExternalLink className="mr-2 h-3 w-3" />
									View in Grafana
								</DropdownMenuItem>
							)}
							{alert.isDismissed ? (
								<DropdownMenuItem onClick={() => onUndismissAlert(alert.id)}>
									<RotateCcw className="mr-2 h-3 w-3" />
									Undismiss Alert
								</DropdownMenuItem>
							) : (
								<DropdownMenuItem onClick={() => onDismissAlert(alert.id)}>
									<Check className="mr-2 h-3 w-3" />
									Dismiss Alert
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</CardHeader>
			{showSummary && alert.summary && (
				<CardContent className="pt-0 pb-3 px-3">
					<p className="text-xs text-foreground line-clamp-2">{alert.summary}</p>
				</CardContent>
			)}
			{showDetails && (
				<div className="px-3 pb-2">
					<p className="text-[10px] text-foreground">
						Started:{' '}
						{(() => {
							const date = new Date(alert.startsAt);
							return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleString();
						})()}
					</p>
				</div>
			)}
		</Card>
	);
};
