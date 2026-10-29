import { OncallTeam } from '@OpsiMate/shared';
import Database from 'better-sqlite3';
import { SuperTest, Test } from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { setupDB, setupExpressApp, setupUserWithToken } from './setup';
import { DuplicateTeamNameError, OncallBL } from '../src/bl/oncall/oncall.bl';
import { OncallRepository } from '../src/dal/oncallRepository';
import { MS_PER_DAY } from '../src/utils/time';

// Who is on call is pure arithmetic in OncallBL.toSharedTeam: from the team's anchor and
// interval it derives `shift = floor(daysSinceAnchor / interval) mod memberCount` and rotates
// the base order by it. Only the admin gating of these routes was covered (requireAdmin.test.ts),
// so the rotation itself, the hand-over timestamp and the case-insensitive name rule had no guard.

let app: SuperTest<Test>;
let db: Database.Database;
let adminToken: string;
let bl: OncallBL;
let annId: number;
let boId: number;
let cyId: number;

// Members are plain user rows; the rotation only reads full_name / email / phone_number.
const insertUser = (fullName: string): number =>
	db
		.prepare('INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)')
		.run(`${fullName.toLowerCase()}@oncall.test`, 'not-a-real-hash', fullName, 'editor').lastInsertRowid as number;

// The BL and the API share this repository, so a team is created exactly the way the routes do.
const createTeam = async (name: string, rotationIntervalDays: number | null, memberIds: number[]): Promise<number> => {
	const team = await bl.createTeam(name, rotationIntervalDays);
	await bl.setTeamMembers(team.id, memberIds);
	return team.id;
};

// Both setTeamMembers and an interval change reset the anchor to "now", so a rotation test has to
// write it afterwards. Whole days keep `periods` exact: the BL's clock is always a little past here.
const setAnchorDaysAgo = (teamId: number, days: number): number => {
	const anchorMs = Date.now() - days * MS_PER_DAY;
	db.prepare('UPDATE oncall_teams SET rotation_anchor = ? WHERE id = ?').run(
		new Date(anchorMs).toISOString(),
		teamId
	);
	return anchorMs;
};

const priorityOrder = (team: OncallTeam): string[] =>
	team.members.map((member) => `${member.fullName} ${member.priority}`);

// supertest's agent type does not expose its verbs in an indexable form, so writes are issued
// through this (same workaround as requireAdmin.test.ts) instead of repeating them per method.
type Verb = 'patch' | 'delete' | 'put';
interface WriteCaller {
	patch(path: string): Test;
	delete(path: string): Test;
	put(path: string): Test;
}

const sendWrite = (method: Verb, path: string): Test => (app as unknown as WriteCaller)[method](path);

beforeAll(async () => {
	db = await setupDB();
	// setupDB has no on-call tables; the app creates them when it wires the routes up.
	app = await setupExpressApp(db);
	adminToken = await setupUserWithToken(app);
	bl = new OncallBL(new OncallRepository(db));
	[annId, boId, cyId] = [insertUser('Ann Alpha'), insertUser('Bo Bravo'), insertUser('Cy Charles')];
});

afterAll(() => {
	db.close();
});

describe('on-call rotation arithmetic', () => {
	test('no interval keeps the order the members were added in', async () => {
		const teamId = await createTeam('Fixed Order', null, [annId, boId, cyId]);

		const team = await bl.getTeam(teamId);

		expect(priorityOrder(team as OncallTeam)).toEqual(['Ann Alpha 1', 'Bo Bravo 2', 'Cy Charles 3']);
		expect(team?.nextRotationAt).toBeNull();
	});

	test('an interval of 0 is stored as null and behaves like no rotation', async () => {
		const res = await app
			.post('/api/v1/oncall/teams')
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ name: 'Zero Interval', rotationIntervalDays: 0 });

		expect(res.status).toBe(201);
		expect(res.body.data.team.rotationIntervalDays).toBeNull();

		await bl.setTeamMembers(res.body.data.team.id as number, [annId, boId, cyId]);
		const team = await bl.getTeam(res.body.data.team.id as number);

		expect(priorityOrder(team as OncallTeam)).toEqual(['Ann Alpha 1', 'Bo Bravo 2', 'Cy Charles 3']);
		expect(team?.nextRotationAt).toBeNull();
	});

	test('one full interval shifts the duty one place down the list', async () => {
		const teamId = await createTeam('Weekly', 7, [annId, boId, cyId]);
		const anchorMs = setAnchorDaysAgo(teamId, 8);

		const team = await bl.getTeam(teamId);

		// 8 days is one whole 7-day period: Bo (base position 1) is on call, then Cy, then Ann.
		expect(priorityOrder(team as OncallTeam)).toEqual(['Bo Bravo 1', 'Cy Charles 2', 'Ann Alpha 3']);
		expect(team?.nextRotationAt).toBe(new Date(anchorMs + 14 * MS_PER_DAY).toISOString());
	});

	test('three full periods with three members wrap back to the first', async () => {
		const teamId = await createTeam('Weekly Wrapped', 7, [annId, boId, cyId]);
		const anchorMs = setAnchorDaysAgo(teamId, 22);

		const team = await bl.getTeam(teamId);

		expect(priorityOrder(team as OncallTeam)).toEqual(['Ann Alpha 1', 'Bo Bravo 2', 'Cy Charles 3']);
		expect(team?.nextRotationAt).toBe(new Date(anchorMs + 28 * MS_PER_DAY).toISOString());
	});

	test('an anchor in the future does not shift anything', async () => {
		const teamId = await createTeam('Future Anchor', 7, [annId, boId, cyId]);
		const anchorMs = setAnchorDaysAgo(teamId, -3);

		const team = await bl.getTeam(teamId);

		expect(priorityOrder(team as OncallTeam)).toEqual(['Ann Alpha 1', 'Bo Bravo 2', 'Cy Charles 3']);
		expect(team?.nextRotationAt).toBe(new Date(anchorMs + 7 * MS_PER_DAY).toISOString());
	});

	test('a team with an interval but no members has nobody on call and no hand-over', async () => {
		const teamId = await createTeam('Empty Roster', 7, []);
		setAnchorDaysAgo(teamId, 30);

		const team = await bl.getTeam(teamId);

		expect(team?.members).toEqual([]);
		expect(team?.nextRotationAt).toBeNull();
	});

	test('getAllTeams rotates the same way getTeam does', async () => {
		const teamId = await createTeam('Listed Rotation', 7, [annId, boId, cyId]);
		setAnchorDaysAgo(teamId, 8);

		const listed = await bl.getAllTeams();
		const single = await bl.getTeam(teamId);

		const fromList = listed.find((team) => team.id === teamId);
		expect(fromList?.members).toEqual(single?.members);
		expect(fromList?.nextRotationAt).toBe(single?.nextRotationAt);
		expect(priorityOrder(fromList as OncallTeam)).toEqual(['Bo Bravo 1', 'Cy Charles 2', 'Ann Alpha 3']);
	});

	test('a member whose user row was deleted leaves no duplicate or skipped priority', async () => {
		const teamId = await createTeam('After Departure', 7, [annId, boId, cyId]);
		setAnchorDaysAgo(teamId, 8);
		// The FK has no cascade in this configuration, so the member row outlives the user and the
		// join simply drops it — positions 0 and 2 remain, with a gap where Bo was.
		db.prepare('DELETE FROM users WHERE id = ?').run(boId);

		const team = await bl.getTeam(teamId);
		const priorities = (team?.members ?? []).map((member) => member.priority);

		expect(priorities).toEqual([1, 2]);
		expect(priorityOrder(team as OncallTeam)).toEqual(['Cy Charles 1', 'Ann Alpha 2']);

		// Restore the user for the tests that share this database.
		boId = insertUser('Bo Bravo');
	});
});

describe('on-call team names are unique ignoring case', () => {
	test('the BL rejects a name that only differs in case', async () => {
		await createTeam('Payments', null, [annId]);

		await expect(createTeam('payments', null, [boId])).rejects.toBeInstanceOf(DuplicateTeamNameError);
		await expect(createTeam('PAYMENTS', null, [boId])).rejects.toBeInstanceOf(DuplicateTeamNameError);
	});

	test('POST /oncall/teams answers 409 for a case-variant name', async () => {
		await createTeam('Search', null, [annId]);

		const res = await app
			.post('/api/v1/oncall/teams')
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ name: 'SEARCH' });

		expect(res.status).toBe(409);
		expect(res.body.error).toContain('already exists');
	});

	test('renaming onto another team name 409s in any case', async () => {
		const firstId = await createTeam('Storage', null, [annId]);
		const secondId = await createTeam('Network', null, [boId]);

		const lower = await app
			.patch(`/api/v1/oncall/teams/${secondId}`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ name: 'storage' });
		expect(lower.status).toBe(409);

		const upper = await app
			.patch(`/api/v1/oncall/teams/${secondId}`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ name: 'STORAGE' });
		expect(upper.status).toBe(409);

		// The rejected rename must not have touched the team.
		expect((await bl.getTeam(secondId))?.name).toBe('Network');
		expect((await bl.getTeam(firstId))?.name).toBe('Storage');
	});

	test('renaming a team to its own name, in any case, is allowed', async () => {
		const teamId = await createTeam('Reports', null, [annId]);

		const sameCase = await app
			.patch(`/api/v1/oncall/teams/${teamId}`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ name: 'Reports' });
		expect(sameCase.status).toBe(200);
		expect(sameCase.body.data.team.name).toBe('Reports');

		const otherCase = await app
			.patch(`/api/v1/oncall/teams/${teamId}`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ name: 'REPORTS' });
		expect(otherCase.status).toBe(200);
		expect(otherCase.body.data.team.name).toBe('REPORTS');
	});
});

describe('on-call team ids and missing teams', () => {
	test('patching or replacing members of a team that does not exist is a 404', async () => {
		const patch = await app
			.patch('/api/v1/oncall/teams/999999')
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ name: 'Ghost' });
		expect(patch.status).toBe(404);
		expect(patch.body.error).toBe('Team not found');

		const members = await app
			.put('/api/v1/oncall/teams/999999/members')
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ userIds: [annId] });
		expect(members.status).toBe(404);
		expect(members.body.error).toBe('Team not found');
	});

	test('deleting a team that does not exist is a 404', async () => {
		const del = await app.delete('/api/v1/oncall/teams/999999').set('Authorization', `Bearer ${adminToken}`);
		expect(del.status).toBe(404);
		expect(del.body.success).toBe(false);
		expect(del.body.error).toBe('Team not found');
	});

	test('a non-numeric or non-positive team id is a 400 on every write', async () => {
		for (const teamId of ['abc', '0']) {
			const requests: [Verb, string][] = [
				['patch', `/api/v1/oncall/teams/${teamId}`],
				['delete', `/api/v1/oncall/teams/${teamId}`],
				['put', `/api/v1/oncall/teams/${teamId}/members`],
			];

			for (const [method, path] of requests) {
				const res = await sendWrite(method, path)
					.set('Authorization', `Bearer ${adminToken}`)
					.send({ name: 'Whatever', userIds: [annId] });

				expect(res.status, `${method.toUpperCase()} ${path}`).toBe(400);
				expect(res.body.error, `${method.toUpperCase()} ${path}`).toBe('Invalid team id');
			}
		}
	});
});

describe('setting members with unknown user ids', () => {
	const putMembers = (teamId: number, userIds: number[]) =>
		app
			.put(`/api/v1/oncall/teams/${teamId}/members`)
			.set('Authorization', `Bearer ${adminToken}`)
			.send({ userIds });

	test('an unknown id answers 400 and names it, a mixed list too', async () => {
		const teamId = await createTeam('Unknown Ids', null, [annId]);

		const unknown = await putMembers(teamId, [987654]);
		expect(unknown.status).toBe(400);
		expect(unknown.body.success).toBe(false);
		expect(unknown.body.error).toContain('987654');

		const mixed = await putMembers(teamId, [annId, 987654]);
		expect(mixed.status).toBe(400);
		expect(mixed.body.error).toContain('987654');
	});

	test('a rejected request keeps the previous members in order', async () => {
		const teamId = await createTeam('Keep Members', null, [annId, boId]);

		await putMembers(teamId, [987654]);

		const list = await app.get('/api/v1/oncall/teams').set('Authorization', `Bearer ${adminToken}`);
		expect(list.status).toBe(200);
		const fromList = (list.body.data.teams as OncallTeam[]).find((team) => team.id === teamId);
		expect(priorityOrder(fromList as OncallTeam)).toEqual(['Ann Alpha 1', 'Bo Bravo 2']);
	});

	test('a list of existing users still answers 200', async () => {
		const teamId = await createTeam('Valid Members', null, [annId]);

		const res = await putMembers(teamId, [boId, cyId]);
		expect(res.status).toBe(200);
		expect(res.body.data.team.members).toHaveLength(2);
	});
});
