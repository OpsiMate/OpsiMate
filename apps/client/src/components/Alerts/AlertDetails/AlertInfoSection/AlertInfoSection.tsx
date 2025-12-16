import { PersonPicker } from '@/components/PersonPicker';
import { Badge } from '@/components/ui/badge';
import { useSetAlertOwner } from '@/hooks/queries/alerts';
import { useUsers } from '@/hooks/queries/users';
import { Alert, AlertStatus } from '@OpsiMate/shared';
import { IntegrationAvatar, resolveAlertIntegration } from '../../IntegrationAvatar';
import { getAlertTagEntries, hasAlertTags } from '../../utils/alertTags.utils';
import { getTagKeyColor } from '../../utils/tagColors.utils';

interface AlertInfoSectionProps {
	alert: Alert;
}

export const AlertInfoSection = ({ alert }: AlertInfoSectionProps) => {
	const integration = resolveAlertIntegration(alert);
	const { data: users = [] } = useUsers();
	const { mutate: setOwner } = useSetAlertOwner();

	const handleOwnerChange = (userId: number | null) => {
		setOwner({ alertId: alert.id, ownerId: userId });
	};

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center gap-3">
				<div className="flex-shrink-0">
					<IntegrationAvatar
						integration={integration}
						size="md"
						className="ring-2 ring-background shadow-sm"
					/>
				</div>
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
							className="flex-shrink-0 text-xs px-1.5 py-0.5"
						>
							{alert.isDismissed ? 'dismissed' : alert.status}
						</Badge>
					</div>
				</div>
			</div>
			<div className="flex items-center gap-2">
				<span className="text-sm text-muted-foreground">Owner:</span>
				<PersonPicker selectedUserId={alert.ownerId} onSelect={handleOwnerChange} users={users} />
			</div>
			{hasAlertTags(alert) && (
				<div className="flex items-center gap-1 flex-wrap">
					{getAlertTagEntries(alert).map(({ key, value }) => {
						const colors = getTagKeyColor(key);
						return (
							<Badge
								key={key}
								className="text-xs border-0"
								style={{
									backgroundColor: colors.background,
									color: colors.text,
								}}
							>
								{key}: {value}
							</Badge>
						);
					})}
				</div>
			)}
		</div>
	);
};
