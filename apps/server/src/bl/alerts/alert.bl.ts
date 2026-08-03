import { AlertRepository } from '../../dal/alertRepository';
import { ResolvedAlertRepository } from '../../dal/resolvedAlertRepository';
import {
	Alert,
	AlertComment,
	AlertHistory,
	AlertHistoryData,
	AlertHistoryEventType,
	AlertStatus,
	AlertType,
	Logger,
	normalizeAlertSeverity,
	SilenceResetSettings,
	UpdateSilenceResetSettings,
} from '@OpsiMate/shared';
import { AlertCommentsRepository } from '../../dal/alertCommentsRepository.ts';
import { AlertHistoryRepository } from '../../dal/alertHistoryRepository';
import { UserRepository } from '../../dal/userRepository';
import { toIsoUtc } from '../../utils/time';
import { EnrichmentBL } from '../enrichments/enrichment.bl';
import { MutePolicyBL } from '../mute-policies/mutePolicy.bl';

const logger = new Logger('bl/alert.bl');

export class AlertBL {
	private mutePolicyBL: MutePolicyBL | null = null;
	private enrichmentBL: EnrichmentBL | null = null;

	constructor(
		private alertRepo: AlertRepository,
		private resolvedAlertRepo: ResolvedAlertRepository,
		private alertCommentsRepo: AlertCommentsRepository,
		private alertHistoryRepo: AlertHistoryRepository,
		private userRepo: UserRepository
	) {}

	// Best-effort history logging: never let a failed history write break the underlying
	// mutation (the event is informational, not transactional).
	private async recordHistoryEvent(
		alertId: string,
		eventType: AlertHistoryEventType,
		description: string,
		actorName?: string | null
	): Promise<void> {
		try {
			await this.alertHistoryRepo.recordEvent({ alertId, eventType, actorName, description });
		} catch (error) {
			logger.error(`Failed to record alert history event (${eventType}) for ${alertId}`, error);
		}
	}

	// Public hook so other modules (e.g. running an action against an alert) can append to the
	// alert's history timeline without depending on the history repository directly.
	async recordActionRun(alertId: string, actionName: string, actorName?: string | null): Promise<void> {
		await this.recordHistoryEvent(
			alertId,
			AlertHistoryEventType.ACTION_RUN,
			`Ran action "${actionName}"`,
			actorName
		);
	}

	setMutePolicyBL(mutePolicyBL: MutePolicyBL): void {
		this.mutePolicyBL = mutePolicyBL;
	}

	setEnrichmentBL(enrichmentBL: EnrichmentBL): void {
		this.enrichmentBL = enrichmentBL;
	}

	// region active
	// Severity is resolved here — the single funnel for every ingestion endpoint: an explicit
	// severity field wins, then a `severity` tag (Zabbix/Grafana/Datadog labels), then the
	// default. Free-form values are normalized onto the fixed critical/warning/info scale,
	// and the severity tag is rewritten to the normalized value so label matchers (mute policies,
	// enrichments) always see the same three values the severity field uses. The tag is
	// hidden from the UI — users only interact with the first-class severity.
	async insertOrUpdateAlert(
		alert: Omit<Alert, 'createdAt' | 'isSilenced' | 'severity'> & { severity?: string }
	): Promise<{ changes: number }> {
		try {
			logger.info(`Inserting alert: ${alert.id}`);
			// || (not ??) so a blank explicit severity falls through to the tag.
			const severity = normalizeAlertSeverity(alert.severity?.trim() || alert.tags?.['severity']);
			// Same funnel for the owning team: explicit field wins, then a `team` tag,
			// otherwise none. Unlike severity there is no fixed scale — any name is kept.
			const team = alert.team?.trim() || alert.tags?.['team'] || null;
			const tags = { ...(alert.tags ?? {}), severity };
			// The repository atomically drops any resolved copy of this id — a re-firing
			// alert must never show as both firing and resolved.
			return await this.alertRepo.insertOrUpdateAlert({ ...alert, tags, severity, team });
		} catch (error) {
			logger.error('Error inserting alert', error);
			throw error;
		}
	}

	// Timed silences expire lazily: every listing first sweeps alerts whose silence window
	// has passed back to unsilenced, with a history entry so the timeline explains the flip.
	private async expireSilences(): Promise<void> {
		const expiredIds = await this.alertRepo.clearExpiredSilences(new Date().toISOString());
		await Promise.all(
			expiredIds.map((id) =>
				this.recordHistoryEvent(id, AlertHistoryEventType.UNSILENCED, 'Silence expired', null)
			)
		);
		await this.runDailySilenceReset();
	}

	// Org-wide daily reset (opt-in): once the configured hour passes, every silence clears —
	// whatever its remaining window — so the whole board alerts again. Piggybacks on the same
	// lazy sweep as timed expiry, so it needs no scheduler; the marker records which daily
	// occurrence was already applied, letting silences created after the hour survive until
	// the next day's occurrence.
	private async runDailySilenceReset(): Promise<void> {
		const settings = await this.alertRepo.getSilenceResetSettings();
		if (!settings.enabled) return;

		// Latest occurrence of the configured hour that is not in the future (server-local).
		const occurrence = new Date();
		occurrence.setHours(settings.hour, 0, 0, 0);
		if (occurrence.getTime() > Date.now()) {
			occurrence.setDate(occurrence.getDate() - 1);
		}

		if (settings.lastClearedAt && new Date(settings.lastClearedAt).getTime() >= occurrence.getTime()) {
			return;
		}

		// Mark first: if history writes fail the reset is not retried in a loop, and the sweep
		// itself is transactional either way. The occurrence is also the clearing cutoff, so a
		// late sweep (nothing listed alerts for a while) leaves silences created after the
		// hour alone — they belong to the next day's reset.
		await this.alertRepo.markSilenceResetCleared(occurrence.toISOString());
		const clearedIds = await this.alertRepo.clearSilencesEstablishedBy(occurrence.toISOString());
		if (clearedIds.length > 0) {
			logger.info(`Daily silence reset cleared ${clearedIds.length} silence(s)`);
		}
		await Promise.all(
			clearedIds.map((id) =>
				this.recordHistoryEvent(id, AlertHistoryEventType.UNSILENCED, 'Silence cleared by daily reset', null)
			)
		);
	}

	async getSilenceResetSettings(): Promise<SilenceResetSettings> {
		return this.alertRepo.getSilenceResetSettings();
	}

	async updateSilenceResetSettings(updates: UpdateSilenceResetSettings): Promise<SilenceResetSettings> {
		return this.alertRepo.updateSilenceResetSettings(updates);
	}

	// Attaches each alert's firing/unresolve transition timestamps (normalized ISO,
	// sorted, deduped): status-history "firing" records plus UNRESOLVED events — the
	// latter carry the actual unresolve moment, which the status trigger doesn't.
	// Best-effort: a failed lookup must never break the listing.
	private async attachFiringTimes(alerts: Alert[]): Promise<Alert[]> {
		if (alerts.length === 0) return alerts;
		try {
			const alertIds = alerts.map((alert) => alert.id);
			const [firingRows, unresolveEvents] = await Promise.all([
				this.alertRepo.getFiringTimesByAlert(alertIds),
				this.alertHistoryRepo.getEventTimesByType(AlertHistoryEventType.UNRESOLVED, alertIds),
			]);
			return alerts.map((alert) => {
				const merged = [...(firingRows[alert.id] ?? []), ...(unresolveEvents[alert.id] ?? [])].map(toIsoUtc);
				if (merged.length === 0) return alert;
				return { ...alert, firingTimes: [...new Set(merged)].sort() };
			});
		} catch (error) {
			logger.error('Failed to attach firing times to alerts', error);
			return alerts;
		}
	}

	async getAllAlerts(): Promise<Alert[]> {
		try {
			logger.info('Fetching all alerts');
			await this.expireSilences();
			let alerts = await this.alertRepo.getAllAlerts();
			// Enrich before muting so mute policy rules can match enrichment-added tags.
			if (this.enrichmentBL) {
				alerts = await this.enrichmentBL.applyEnrichments(alerts);
			}
			if (this.mutePolicyBL) {
				alerts = await this.mutePolicyBL.markMuted(alerts);
			}
			return await this.attachFiringTimes(alerts);
		} catch (error) {
			logger.error('Error fetching alerts', error);
			throw error;
		}
	}

	// silencedUntil (ISO) bounds the silence; null means until manually unsilenced. An
	// optional note is stored as a regular comment by the acting user, and — mirroring
	// resolve — whoever silences the alert takes ownership of it.
	async silenceAlert(
		id: string,
		actor: { id: string | null; name: string | null },
		silencedUntil: string | null,
		comment?: string
	): Promise<Alert | null> {
		try {
			logger.info(`Silencing alert with id: ${id}`);
			// Normalize to UTC before persisting: expiry uses lexicographic string comparison,
			// which is only correct when every stored value shares the same ISO-UTC format.
			const normalizedSilencedUntil = silencedUntil ? toIsoUtc(silencedUntil) : null;
			let alert = await this.alertRepo.silenceAlert(id, normalizedSilencedUntil);
			if (alert) {
				const description = normalizedSilencedUntil
					? `Alert silenced until ${normalizedSilencedUntil}`
					: 'Alert silenced';
				await this.recordHistoryEvent(id, AlertHistoryEventType.SILENCED, description, actor.name);
				if (actor.id != null && Number.isFinite(Number(actor.id))) {
					// setAlertOwner also records the "Assigned to …" history event.
					alert = (await this.setAlertOwner(id, actor.id, false, actor.name)) ?? alert;
				}
				if (comment && actor.id != null) {
					await this.createComment({ alertId: id, userId: actor.id, comment }, actor.name);
				}
			}
			return alert;
		} catch (error) {
			logger.error('Error silencing alert', error);
			throw error;
		}
	}

	async markAlertRead(id: string): Promise<Alert | null> {
		try {
			logger.info(`Marking alert as read: ${id}`);
			return await this.alertRepo.markAlertRead(id);
		} catch (error) {
			logger.error('Error marking alert as read', error);
			throw error;
		}
	}

	async unsilenceAlert(id: string, actorName?: string | null): Promise<Alert | null> {
		try {
			logger.info(`Unsilenceing alert with id: ${id}`);
			const alert = await this.alertRepo.unsilenceAlert(id);
			if (alert) {
				await this.recordHistoryEvent(id, AlertHistoryEventType.UNSILENCED, 'Alert unsilenced', actorName);
			}
			return alert;
		} catch (error) {
			logger.error('Error unsilenceing alert', error);
			throw error;
		}
	}
	// endregion

	// region resolved
	async getAllResolvedAlerts(): Promise<Alert[]> {
		try {
			logger.info('Fetching all resolved alerts');
			return await this.attachFiringTimes(await this.resolvedAlertRepo.getAllResolvedAlerts());
		} catch (error) {
			logger.error('Error fetching resolved alerts', error);
			throw error;
		}
	}

	// manualActor differentiates the two resolve flows: pass it (even with null fields) when
	// a user resolved the alert from the UI — a RESOLVED history event is recorded with their
	// name, they become the alert's owner, and an optional resolve note is stored as a
	// regular comment. Leave it undefined for API-driven resolution (a source reporting the
	// alert as recovered), which only gets the automatic status-transition entry.
	async resolveAlert(
		activeAlertId: string,
		manualActor?: { id: string | null; name: string | null },
		comment?: string
	): Promise<void> {
		try {
			logger.info(`Resolving alert with id: ${activeAlertId}`);

			// Get the active alert
			const alert = await this.alertRepo.getAlert(activeAlertId);
			if (!alert) {
				logger.warn(`Alert with id ${activeAlertId} not found, nothing to resolve`);
				return;
			}

			// Insert into resolved table
			await this.resolvedAlertRepo.insertResolvedAlert(alert);

			// Remove from active table
			await this.alertRepo.deleteAlert(activeAlertId);

			if (manualActor !== undefined) {
				await this.recordHistoryEvent(
					activeAlertId,
					AlertHistoryEventType.RESOLVED,
					'Alert resolved manually',
					manualActor.name
				);

				// Whoever resolved the alert takes ownership of it.
				if (manualActor.id != null && Number.isFinite(Number(manualActor.id))) {
					await this.resolvedAlertRepo.updateResolvedAlertOwner(activeAlertId, Number(manualActor.id));
				}

				if (comment && manualActor.id != null) {
					await this.createComment(
						{ alertId: activeAlertId, userId: manualActor.id, comment },
						manualActor.name
					);
				}
			}

			logger.info(`Resolved alert ${activeAlertId}`);
		} catch (error) {
			logger.error(`Error resolving alert ${activeAlertId}`, error);
			throw error;
		}
	}

	async resolveNonActiveAlerts(activeAlertIds: Set<string>, alertType: AlertType) {
		try {
			logger.info(`Resolving alerts not in ids for type: ${alertType}`);
			// Get alerts that need to be resolved
			const alertsToResolve = await this.alertRepo.getAlertsNotInIds(activeAlertIds, alertType);

			// Resolve each alert
			for (const alert of alertsToResolve) {
				await this.resolvedAlertRepo.insertResolvedAlert(alert);
			}

			// Delete alerts from active table
			await this.alertRepo.deleteAlertsNotInIds(activeAlertIds, alertType);

			logger.info(`Resolved ${alertsToResolve.length} alerts`);
		} catch (error) {
			logger.error('Error resolving alerts', error);
			throw error;
		}
	}

	// Moves a resolved alert back to the active table as firing — the reverse of resolveAlert.
	async unresolveAlert(alertId: string, actorName?: string | null): Promise<Alert | null> {
		try {
			logger.info(`Unresolving alert with id: ${alertId}`);

			const resolved = await this.resolvedAlertRepo.getResolvedAlert(alertId);
			if (!resolved) {
				logger.warn(`Resolved alert with id ${alertId} not found, nothing to unresolve`);
				return null;
			}

			const now = new Date().toISOString();
			const alert: Alert = {
				...resolved,
				status: AlertStatus.FIRING,
				// Resolving cleared any silence, so the alert always comes back audible.
				isSilenced: false,
				// Restored as unread (matches the is_read = 0 the repository writes) so the
				// returned alert renders with the unread treatment without waiting for a refetch.
				isRead: false,
				// Unresolving starts a NEW firing episode: "Started At" means the last
				// transition into firing, so it stamps the unresolve moment — not the original
				// start, which would make a re-activated alert look ancient. The original
				// start stays visible in the history timeline, and filtered/unfiltered views
				// now agree (the UNRESOLVED event and starts_at carry the same moment).
				startsAt: now,
				updatedAt: now,
			};

			await this.alertRepo.restoreAlert(alert);
			await this.resolvedAlertRepo.deleteResolvedAlert(alertId);
			await this.recordHistoryEvent(
				alertId,
				AlertHistoryEventType.UNRESOLVED,
				'Alert moved back to firing',
				actorName
			);

			logger.info(`Unresolved alert ${alertId}`);
			return alert;
		} catch (error) {
			logger.error(`Error unresolving alert ${alertId}`, error);
			throw error;
		}
	}

	async deleteResolvedAlert(alertId: string): Promise<void> {
		try {
			logger.info(`Permanently deleting resolved alert with id: ${alertId}`);
			await this.resolvedAlertRepo.deleteResolvedAlert(alertId);
		} catch (error) {
			logger.error('Error deleting resolved alert', error);
			throw error;
		}
	}
	// endregion

	// region history
	async getAlertHistory(alertId: string): Promise<AlertHistory> {
		// Merge two sources: automatic status transitions (trigger-populated) and user-driven
		// events (ownership, silencings, actions, comments), newest first.
		const [statusHistory, events] = await Promise.all([
			this.resolvedAlertRepo.getAlertHistory(alertId),
			this.alertHistoryRepo.getEvents(alertId),
		]);

		const eventEntries: AlertHistoryData[] = events.map((row) => ({
			date: toIsoUtc(row.created_at),
			eventType: row.event_type as AlertHistoryEventType,
			actorName: row.actor_name ?? undefined,
			description: row.description ?? undefined,
		}));

		// A manual resolve records a RESOLVED event (with the acting user) AND fires the
		// automatic status trigger. Suppress the trigger's entry when a manual-resolve event
		// sits right next to it, so the timeline shows one entry per resolve — with the actor
		// for manual resolves, without one for API/source-driven resolution. (Unresolve needs
		// no counterpart: restoreAlert deletes the trigger's re-insert row, leaving the
		// UNRESOLVED event as the transition's single record.)
		const manualResolveTimes = eventEntries
			.filter((e) => e.eventType === AlertHistoryEventType.RESOLVED)
			.map((e) => new Date(e.date).getTime());
		const coveredByManualResolve = (entry: { date: string; status?: AlertStatus }): boolean =>
			entry.status !== AlertStatus.FIRING &&
			manualResolveTimes.some((t) => Math.abs(t - new Date(toIsoUtc(entry.date)).getTime()) < 10_000);

		// Exact-duplicate transitions collapse to one entry: unresolve re-inserts used to
		// stamp the trigger row with the ORIGINAL starts_at, so older alerts carry several
		// identical "firing" rows at the same instant.
		const seenTransitions = new Set<string>();
		const statusEntries: AlertHistoryData[] = statusHistory.data
			.filter((entry) => !coveredByManualResolve(entry))
			.filter((entry) => {
				const key = `${entry.status}@${toIsoUtc(entry.date)}`;
				if (seenTransitions.has(key)) return false;
				seenTransitions.add(key);
				return true;
			})
			.map((entry) => ({
				...entry,
				date: toIsoUtc(entry.date),
				eventType: AlertHistoryEventType.STATUS_CHANGED,
				description: entry.status === AlertStatus.FIRING ? 'Alert started firing' : 'Alert resolved',
			}));

		const data = [...statusEntries, ...eventEntries].sort(
			(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
		);

		return { alertId, data };
	}
	// endregion

	// region owner
	async setAlertOwner(
		alertId: string,
		ownerId: string | null,
		isResolved: boolean,
		actorName?: string | null
	): Promise<Alert | null> {
		try {
			logger.info(`Setting owner ${ownerId} for alert: ${alertId} is Resolved ${isResolved}`);
			// Convert string to number for database storage
			const numericOwnerId = ownerId !== null ? parseInt(ownerId, 10) : null;
			const updated = isResolved
				? await this.resolvedAlertRepo.updateResolvedAlertOwner(alertId, numericOwnerId)
				: await this.alertRepo.updateAlertOwner(alertId, numericOwnerId);

			if (updated) {
				if (numericOwnerId !== null) {
					const owner = await this.userRepo.getUserById(numericOwnerId).catch(() => null);
					const ownerName = owner?.fullName ?? `user #${numericOwnerId}`;
					await this.recordHistoryEvent(
						alertId,
						AlertHistoryEventType.OWNER_ASSIGNED,
						`Assigned to ${ownerName}`,
						actorName
					);
				} else {
					await this.recordHistoryEvent(
						alertId,
						AlertHistoryEventType.OWNER_UNASSIGNED,
						'Owner removed',
						actorName
					);
				}
			}
			return updated;
		} catch (error) {
			logger.error('Error setting alert owner', error);
			throw error;
		}
	}
	// endregion

	// region comments
	// Every created comment is mirrored into the alert history timeline as a COMMENT_ADDED
	// event (actorName identifies who commented); the comment body itself lives only in the
	// Comments tab, so the timeline stays a compact activity log.
	async createComment(
		comment: Omit<AlertComment, 'createdAt' | 'updatedAt' | 'id'>,
		actorName?: string | null
	): Promise<AlertComment> {
		const created = await this.alertCommentsRepo.createComment(comment);
		await this.recordHistoryEvent(
			comment.alertId,
			AlertHistoryEventType.COMMENT_ADDED,
			'Comment added',
			actorName ?? null
		);
		return created;
	}

	async updateComment(id: string, userId: string, comment: string): Promise<AlertComment | null> {
		return await this.alertCommentsRepo.updateComment(id, userId, comment);
	}

	async deleteComment(id: string, userId: string): Promise<void> {
		return await this.alertCommentsRepo.deleteComment(id, userId);
	}

	async getCommentsByAlertId(alertId: string): Promise<AlertComment[]> {
		return await this.alertCommentsRepo.getCommentsByAlertId(alertId);
	}
	// endregion
}
