import { User } from '@OpsiMate/shared';

export interface AuditActor {
	userId: number;
	userName: string;
}

export const API_TOKEN_ACTOR_ID = 0;
export const API_TOKEN_ACTOR_NAME = 'API Token';

export const toAuditActor = (actor?: User | null): AuditActor => {
	const parsedUserId = actor?.id !== undefined ? Number(actor.id) : NaN;
	return {
		userId: Number.isFinite(parsedUserId) ? parsedUserId : API_TOKEN_ACTOR_ID,
		userName: actor?.fullName ?? API_TOKEN_ACTOR_NAME,
	};
};
