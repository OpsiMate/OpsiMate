import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useSilenceResetSettings, useUpdateSilenceResetSettings } from '@/hooks/queries/alerts/useSilenceReset';
import { Loader2 } from 'lucide-react';

// 0..23 rendered as "00:00" … "23:00".
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

// Org-wide daily silence reset: at the configured hour every silenced alert flips back to
// alerting, regardless of the duration each silence was given. Made for teams (e.g. algo
// trading) that want a clean, fully-alerting board at a fixed time every day.
export const SilenceResetSettings = () => {
	const { data, isLoading, error } = useSilenceResetSettings();
	const { mutate: updateSettings, isPending } = useUpdateSilenceResetSettings();
	const { toast } = useToast();

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" /> Loading silence settings…
			</div>
		);
	}

	if (error || !data) {
		return (
			<div className="text-sm text-muted-foreground">
				Failed to load silence settings{error ? ` — ${(error as Error).message}` : ''}. Admin access is required
				for this section.
			</div>
		);
	}

	const save = (updates: { enabled?: boolean; hour?: number }) => {
		updateSettings(updates, {
			onError: (e) =>
				toast({ title: 'Failed to save', description: (e as Error).message, variant: 'destructive' }),
		});
	};

	return (
		<div className="space-y-4">
			<div>
				<h2 className="text-lg font-semibold text-foreground">Daily silence reset</h2>
				<p className="text-sm text-muted-foreground">
					Clear every silence at a fixed hour each day so all alerts notify again — whatever duration each
					silence was given. Useful when the whole board must be live again at the end of the day.
				</p>
			</div>

			<Card className="p-4 flex items-center justify-between gap-4">
				<div className="min-w-0">
					<div className="font-medium text-foreground">Clear all silences daily</div>
					<div className="text-sm text-muted-foreground">
						{data.enabled
							? `Every day at ${formatHour(data.hour)} (server time), all silenced alerts go back to alerting.`
							: 'Disabled — silences only expire on their own schedule.'}
					</div>
				</div>
				<div className="flex items-center gap-4 shrink-0">
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground">at</span>
						<Select
							value={String(data.hour)}
							disabled={!data.enabled || isPending}
							onValueChange={(value) => save({ hour: Number(value) })}
						>
							<SelectTrigger className="w-24 h-8 text-sm" aria-label="Reset hour (server time)">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{HOURS.map((hour) => (
									<SelectItem key={hour} value={String(hour)}>
										{formatHour(hour)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<span className="text-sm text-muted-foreground">server time</span>
					</div>
					<Switch
						checked={data.enabled}
						disabled={isPending}
						onCheckedChange={(enabled) => save({ enabled })}
						aria-label="Enable daily silence reset"
					/>
				</div>
			</Card>
		</div>
	);
};
