import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { AlertCircle, BellOff, Clock, Server } from 'lucide-react';
import { getAlertTagEntries, hasAlertTags } from '../../utils/alertTags.utils';
import { getTagKeyColor } from '../../utils/tagColors.utils';
import { CardSize } from '../AlertsTVMode.constants';

interface AlertCardProps {
	alert: Alert;
	cardSize: CardSize;
	serviceName: string;
	onClick: () => void;
}

const formatTimeAgo = (date: Date): string => {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMins < 1) return 'Just now';
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	return `${diffDays}d ago`;
};

const getSeverityConfig = (alert: Alert) => {
	if (alert.isDismissed) {
		return {
			bg: 'bg-muted/40',
			border: 'border-muted-foreground/20',
			glow: '',
			iconBg: 'bg-muted',
			iconColor: 'text-muted-foreground',
			pulse: false,
		};
	}

	// Check tags for severity, fall back to status-based determination
	const severity = (alert.tags?.severity || alert.tags?.priority || (alert.status === 'firing' ? 'warning' : 'info')).toLowerCase();

	switch (severity) {
		case 'critical':
			return {
				bg: 'bg-gradient-to-br from-red-500/20 to-red-600/10',
				border: 'border-red-500/50',
				glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]',
				iconBg: 'bg-red-500',
				iconColor: 'text-white',
				pulse: true,
			};
		case 'warning':
			return {
				bg: 'bg-gradient-to-br from-amber-500/20 to-orange-500/10',
				border: 'border-amber-500/50',
				glow: 'shadow-[0_0_15px_rgba(245,158,11,0.2)]',
				iconBg: 'bg-amber-500',
				iconColor: 'text-white',
				pulse: false,
			};
		case 'info':
			return {
				bg: 'bg-gradient-to-br from-blue-500/20 to-blue-600/10',
				border: 'border-blue-500/50',
				glow: '',
				iconBg: 'bg-blue-500',
				iconColor: 'text-white',
				pulse: false,
			};
		default:
			return {
				bg: 'bg-gradient-to-br from-destructive/20 to-destructive/10',
				border: 'border-destructive/50',
				glow: 'shadow-[0_0_15px_rgba(239,68,68,0.2)]',
				iconBg: 'bg-destructive',
				iconColor: 'text-white',
				pulse: true,
			};
	}
};

export const AlertCard = ({ alert, cardSize, serviceName, onClick }: AlertCardProps) => {
	const showDetails = cardSize === 'large' || cardSize === 'medium';
	const showSummary = cardSize === 'large';
	const showTags = cardSize === 'large' || cardSize === 'medium';
	const config = getSeverityConfig(alert);

	const startDate = new Date(alert.startsAt);
	const timeAgo = isNaN(startDate.getTime()) ? 'Unknown' : formatTimeAgo(startDate);

	return (
		<div
			onClick={onClick}
			className={cn(
				'group relative rounded-xl border backdrop-blur-sm cursor-pointer',
				'transition-all duration-300 ease-out',
				'hover:scale-[1.02] hover:shadow-xl',
				config.bg,
				config.border,
				config.glow,
				cardSize === 'extra-small' ? 'p-2' : cardSize === 'small' ? 'p-3' : 'p-4'
			)}
		>
			{/* Pulse animation for active critical alerts */}
			{config.pulse && (
				<div className="absolute inset-0 rounded-xl animate-pulse bg-destructive/5" />
			)}

			{/* Header with icon and title */}
			<div className="relative flex items-start gap-3">
				{/* Status Icon */}
				<div
					className={cn(
						'flex-shrink-0 rounded-lg flex items-center justify-center',
						config.iconBg,
						cardSize === 'extra-small' ? 'h-6 w-6' : cardSize === 'small' ? 'h-8 w-8' : 'h-10 w-10'
					)}
				>
					{alert.isDismissed ? (
						<BellOff className={cn(config.iconColor, cardSize === 'extra-small' ? 'h-3 w-3' : 'h-5 w-5')} />
					) : (
						<AlertCircle className={cn(config.iconColor, cardSize === 'extra-small' ? 'h-3 w-3' : 'h-5 w-5')} />
					)}
				</div>

				{/* Content */}
				<div className="flex-1 min-w-0">
					<h3
						className={cn(
							'font-semibold truncate text-foreground leading-tight',
							cardSize === 'extra-small' ? 'text-[10px]' : cardSize === 'small' ? 'text-xs' : 'text-sm'
						)}
						title={alert.alertName}
					>
						{alert.alertName}
					</h3>

					{/* Service name */}
					{showDetails && serviceName !== '-' && (
						<div className="flex items-center gap-1 mt-1">
							<Server className="h-3 w-3 text-muted-foreground" />
							<span className="text-xs text-muted-foreground truncate">{serviceName}</span>
						</div>
					)}

					{/* Time */}
					{showDetails && (
						<div className="flex items-center gap-1 mt-1">
							<Clock className="h-3 w-3 text-muted-foreground" />
							<span className="text-xs text-muted-foreground">{timeAgo}</span>
						</div>
					)}
				</div>

				{/* Status badge for small cards */}
				{!showDetails && (
					<span className="text-[9px] text-muted-foreground">{timeAgo}</span>
				)}
			</div>

			{/* Tags */}
			{showTags && hasAlertTags(alert) && (
				<div className="mt-3 flex flex-wrap gap-1">
					{getAlertTagEntries(alert).slice(0, 3).map(({ key, value }) => {
						const colors = getTagKeyColor(key);
						return (
							<Badge
								key={key}
								className="text-[10px] px-1.5 py-0.5 border-0 font-medium"
								style={{
									backgroundColor: colors.background,
									color: colors.text,
								}}
							>
								{value}
							</Badge>
						);
					})}
					{getAlertTagEntries(alert).length > 3 && (
						<Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
							+{getAlertTagEntries(alert).length - 3}
						</Badge>
					)}
				</div>
			)}

			{/* Summary */}
			{showSummary && alert.summary && (
				<p className="mt-3 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
					{alert.summary}
				</p>
			)}

			{/* Hover indicator */}
			<div
				className={cn(
					'absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100',
					'bg-gradient-to-t from-primary/5 to-transparent',
					'transition-opacity duration-300 pointer-events-none'
				)}
			/>
		</div>
	);
};
