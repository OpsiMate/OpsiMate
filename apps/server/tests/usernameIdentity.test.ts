import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import { SuperTest, Test } from 'supertest';
import { Role, User, usernameVariant } from '@OpsiMate/shared';
import { UserRepository } from '../src/dal/userRepository';
import { setupDB, setupExpressApp } from './setup';

// Accounts are keyed on a username; the email is optional. An installation that keyed
// them on the email is migrated in place, and a user without any address signs in,
// is listed and is administered like anyone else.

interface UserIdentityRow {
	id: number;
	username: string;
	email: string | null;
}

describe('users table migration', () => {
	test('an email-keyed table is upgraded: usernames from the local part, suffix on collision, rows and foreign keys intact', async () => {
		const db = new Database(':memory:');
		db.pragma('foreign_keys = ON');
		// The table as versions before usernames created it.
		db.exec(`CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			full_name TEXT NOT NULL,
			role TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`);
		db.exec(`INSERT INTO users (email, password_hash, full_name, role) VALUES
			('Dana@acme.test', 'h', 'Dana', 'admin'),
			('dana@other.test', 'h', 'Dana Two', 'editor'),
			('J.Smith+ops@acme.test', 'h', 'J', 'viewer')`);
		// Something that references users with ON DELETE CASCADE, as comments, reset
		// tokens and on-call memberships do: the rebuild must not cascade them away.
		db.exec(`CREATE TABLE notes (
			id INTEGER PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			body TEXT
		)`);
		db.exec(`INSERT INTO notes (user_id, body) VALUES (1, 'a'), (2, 'b'), (3, 'c')`);

		await new UserRepository(db).initUsersTable();

		const rows = db.prepare('SELECT id, username, email FROM users ORDER BY id').all() as UserIdentityRow[];
		expect(rows).toEqual([
			{ id: 1, username: 'dana', email: 'Dana@acme.test' },
			{ id: 2, username: 'dana2', email: 'dana@other.test' },
			{ id: 3, username: 'j.smith-ops', email: 'J.Smith+ops@acme.test' },
		]);
		expect(db.prepare('SELECT COUNT(*) AS n FROM notes').get()).toEqual({ n: 3 });
		expect(db.pragma('foreign_keys', { simple: true })).toBe(1);

		// Email optional now (two accounts without one), username unique ignoring case.
		const insert = db.prepare(
			`INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, NULL, 'h', ?, 'viewer')`
		);
		expect(() => insert.run('nomail', 'No Mail')).not.toThrow();
		expect(() => insert.run('nomail2', 'No Mail 2')).not.toThrow();
		expect(() => insert.run('DANA', 'Dup')).toThrow(/UNIQUE/);
		// Deleting a user still cascades to what references it.
		db.prepare('DELETE FROM users WHERE id = 3').run();
		expect(db.prepare('SELECT COUNT(*) AS n FROM notes').get()).toEqual({ n: 2 });

		// Running the init again is a no-op.
		await new UserRepository(db).initUsersTable();
		expect(db.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 4 });
		db.close();
	});

	test('an upgrade that stopped half-way resumes: rows still without a username get one, assigned names stay', async () => {
		const db = new Database(':memory:');
		db.exec(`CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			full_name TEXT NOT NULL,
			role TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			username TEXT
		)`);
		// The column was added and one row filled before the process died.
		db.exec(`INSERT INTO users (email, password_hash, full_name, role, username) VALUES
			('dana@acme.test', 'h', 'Dana', 'admin', 'dana-kept'),
			('noa@acme.test', 'h', 'Noa', 'editor', NULL)`);
		await new UserRepository(db).initUsersTable();
		const rows = db.prepare('SELECT username, email FROM users ORDER BY id').all() as UserIdentityRow[];
		expect(rows.map((r) => r.username)).toEqual(['dana-kept', 'noa']);
		expect(
			(db.prepare('PRAGMA table_info(users)').all() as { name: string; notnull: number }[]).find(
				(c) => c.name === 'email'
			)?.notnull
		).toBe(0);
		db.close();
	});

	test("the rebuild keeps the id watermark: a deleted account's id is never handed to a new one", async () => {
		const db = new Database(':memory:');
		db.exec(`CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			full_name TEXT NOT NULL,
			role TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`);
		db.exec(
			`INSERT INTO users (email, password_hash, full_name, role) VALUES ('a@x.test', 'h', 'A', 'admin'), ('b@x.test', 'h', 'B', 'viewer')`
		);
		db.exec(`DELETE FROM users WHERE id = 2`);
		await new UserRepository(db).initUsersTable();
		const inserted = db
			.prepare(
				`INSERT INTO users (username, email, password_hash, full_name, role) VALUES ('c', NULL, 'h', 'C', 'viewer')`
			)
			.run();
		expect(Number(inserted.lastInsertRowid)).toBe(3);
		db.close();
	});

	test('emails are unique ignoring case on a clean database; an old database with case variants keeps them and is warned', async () => {
		const clean = await setupDB();
		const insert = clean.prepare(
			`INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, 'h', 'X', 'viewer')`
		);
		insert.run('one', 'Dana@acme.test');
		expect(() => insert.run('two', 'dana@acme.test')).toThrow(/UNIQUE/);
		clean.close();

		const legacy = new Database(':memory:');
		legacy.exec(`CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			full_name TEXT NOT NULL,
			role TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`);
		legacy.exec(
			`INSERT INTO users (email, password_hash, full_name, role) VALUES ('Dana@acme.test', 'h', 'Dana', 'admin'), ('dana@acme.test', 'h', 'Dana Two', 'viewer')`
		);
		await new UserRepository(legacy).initUsersTable();
		expect(legacy.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 2 });
		const indexes = legacy.prepare(`PRAGMA index_list(users)`).all() as { name: string }[];
		expect(indexes.map((i) => i.name)).not.toContain('users_email_unique_nocase');
		legacy.close();
	});

	test('numbered variants always fit: a 64-character name is shortened for its suffix, so the search ends', async () => {
		const long = 'a'.repeat(64);
		expect(usernameVariant(long, 1)).toBe(long);
		expect(usernameVariant(long, 2)).toBe(`${'a'.repeat(63)}2`);
		expect(usernameVariant(long, 10)).toBe(`${'a'.repeat(62)}10`);
		expect(usernameVariant('dana', 3)).toBe('dana3');

		const db = new Database(':memory:');
		db.exec(`CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			full_name TEXT NOT NULL,
			role TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`);
		db.exec(
			`INSERT INTO users (email, password_hash, full_name, role) VALUES ('${long}@one.test', 'h', 'A', 'admin'), ('${long.toUpperCase()}@two.test', 'h', 'B', 'viewer')`
		);
		await new UserRepository(db).initUsersTable();
		const rows = db.prepare('SELECT username FROM users ORDER BY id').all() as Pick<UserIdentityRow, 'username'>[];
		expect(rows.map((r) => r.username)).toEqual([long, `${'a'.repeat(63)}2`]);
		db.close();
	});

	test('an old database with dangling references (the app runs without foreign_keys) still upgrades', async () => {
		const db = new Database(':memory:');
		db.exec(`CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			full_name TEXT NOT NULL,
			role TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`);
		db.exec(
			`CREATE TABLE notes (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE)`
		);
		db.exec(`INSERT INTO users (email, password_hash, full_name, role) VALUES ('a@x.test', 'h', 'A', 'admin')`);
		// A note by a user deleted while foreign keys were off: dangling before the upgrade.
		// (better-sqlite3 enforces foreign keys by default, so switch them off to seed it.)
		db.pragma('foreign_keys = OFF');
		db.exec(`INSERT INTO notes (user_id) VALUES (1), (42)`);
		db.pragma('foreign_keys = ON');
		await expect(new UserRepository(db).initUsersTable()).resolves.toBeUndefined();
		expect(db.prepare('SELECT COUNT(*) AS n FROM notes').get()).toEqual({ n: 2 });
		db.close();
	});

	test('a fresh database gets the final shape straight away', async () => {
		const db = await setupDB();
		const columns = db.prepare('PRAGMA table_info(users)').all() as { name: string; notnull: number }[];
		expect(columns.find((c) => c.name === 'username')?.notnull).toBe(1);
		expect(columns.find((c) => c.name === 'email')?.notnull).toBe(0);
		db.close();
	});
});

describe('username identity (API)', () => {
	let app: SuperTest<Test>;
	let db: Database.Database;
	let adminToken: string;
	const auth = () => ({ Authorization: `Bearer ${adminToken}` });

	beforeAll(async () => {
		db = await setupDB();
		app = await setupExpressApp(db);
		// The first admin: a username and no email at all.
		const registered = await app
			.post('/api/v1/users/register')
			.send({ username: 'IdanL', fullName: 'Idan', password: 'securepassword' });
		expect(registered.status).toBe(201);
		expect(registered.body.data.username).toBe('idanl');
		expect(registered.body.data.email).toBeNull();
		adminToken = registered.body.token;
	});

	afterAll(() => db.close());

	test('signs in by username in any letter case, with the identifier field or the legacy email field; the token carries the username', async () => {
		for (const body of [
			{ identifier: 'idanl', password: 'securepassword' },
			{ identifier: 'IDANL', password: 'securepassword' },
			{ email: 'idanl', password: 'securepassword' },
		]) {
			const res = await app.post('/api/v1/users/login').send(body);
			expect(res.status).toBe(200);
			expect(res.body.data.username).toBe('idanl');
			expect((jwt.decode(res.body.token) as User).username).toBe('idanl');
		}
		const wrong = await app.post('/api/v1/users/login').send({ identifier: 'idanl', password: 'nope' });
		expect(wrong.status).toBe(401);
		expect(wrong.body.error).toBe('Invalid username or password');
		const noLogin = await app.post('/api/v1/users/login').send({ password: 'securepassword' });
		expect(noLogin.status).toBe(400);
	});

	test('an admin creates users with a username and optional email, or by email only (local part becomes the username)', async () => {
		const withBoth = await app.post('/api/v1/users').set(auth()).send({
			username: 'dana.l',
			email: 'Dana@Example.com',
			fullName: 'Dana',
			password: 'securepassword',
			role: 'editor',
		});
		expect(withBoth.status).toBe(201);
		expect(withBoth.body.data).toMatchObject({ username: 'dana.l', email: 'Dana@Example.com' });

		const byEmail = await app
			.post('/api/v1/users')
			.set(auth())
			.send({ email: 'noa@example.com', fullName: 'Noa', password: 'securepassword', role: 'viewer' });
		expect(byEmail.status).toBe(201);
		expect(byEmail.body.data).toMatchObject({ username: 'noa', email: 'noa@example.com' });

		const noMail = await app.post('/api/v1/users').set(auth()).send({
			username: 'svc-deploy',
			email: '',
			fullName: 'Deploy bot',
			password: 'securepassword',
			role: 'operation',
		});
		expect(noMail.status).toBe(201);
		expect(noMail.body.data).toMatchObject({ username: 'svc-deploy', email: null });

		// Both sign in: by email (any case) and by username.
		expect(
			(await app.post('/api/v1/users/login').send({ identifier: 'dana@example.com', password: 'securepassword' }))
				.status
		).toBe(200);
		expect(
			(await app.post('/api/v1/users/login').send({ identifier: 'svc-deploy', password: 'securepassword' }))
				.status
		).toBe(200);
	});

	test('an email-only create whose local part is taken gets a numbered username; an explicit one is refused', async () => {
		// "noa" exists (created above by email). Another noa at a different domain:
		const second = await app
			.post('/api/v1/users')
			.set(auth())
			.send({ email: 'noa@other.example', fullName: 'Noa Two', password: 'securepassword', role: 'viewer' });
		expect(second.status).toBe(201);
		expect(second.body.data.username).toBe('noa2');
		const third = await app
			.post('/api/v1/users')
			.set(auth())
			.send({ email: 'noa@third.example', fullName: 'Noa Three', password: 'securepassword', role: 'viewer' });
		expect(third.body.data.username).toBe('noa3');
		const explicit = await app.post('/api/v1/users').set(auth()).send({
			username: 'noa',
			email: 'noa@fourth.example',
			fullName: 'X',
			password: 'securepassword',
			role: 'viewer',
		});
		expect(explicit.status).toBe(400);
		expect(explicit.body.error).toBe('Username already taken');
	});

	test('a third variant of a 64-character name is found although its variants no longer start with the full name', async () => {
		const long = 'z'.repeat(64);
		for (const username of [long, `${'z'.repeat(63)}2`]) {
			const res = await app
				.post('/api/v1/users')
				.set(auth())
				.send({ username, fullName: 'Z', password: 'securepassword', role: 'viewer' });
			expect(res.status).toBe(201);
		}
		const third = await app
			.post('/api/v1/users')
			.set(auth())
			.send({ email: `${long}@z.example`, fullName: 'Z3', password: 'securepassword', role: 'viewer' });
		expect(third.status).toBe(201);
		expect(third.body.data.username).toBe(`${'z'.repeat(63)}3`);
	});

	test('taken or invalid identities are refused with a reason', async () => {
		const takenUsername = await app
			.post('/api/v1/users')
			.set(auth())
			.send({ username: 'DANA.L', fullName: 'X', password: 'securepassword', role: 'viewer' });
		expect(takenUsername.status).toBe(400);
		expect(takenUsername.body.error).toBe('Username already taken');

		const takenEmail = await app.post('/api/v1/users').set(auth()).send({
			username: 'someone',
			email: 'dana@example.com',
			fullName: 'X',
			password: 'securepassword',
			role: 'viewer',
		});
		expect(takenEmail.status).toBe(400);
		expect(takenEmail.body.error).toBe('Email already registered');

		for (const username of ['has space', 'at@sign', 'x', 'Ünïcode']) {
			const invalid = await app
				.post('/api/v1/users')
				.set(auth())
				.send({ username, fullName: 'X', password: 'securepassword', role: 'viewer' });
			expect(invalid.status).toBe(400);
			expect(invalid.body.error).toBe('Validation error');
		}
		const nothing = await app
			.post('/api/v1/users')
			.set(auth())
			.send({ fullName: 'X', password: 'securepassword', role: 'viewer' });
		expect(nothing.status).toBe(400);
	});

	test('the users list carries username and a null email for accounts without one', async () => {
		const res = await app.get('/api/v1/users').set(auth());
		expect(res.status).toBe(200);
		const byName = Object.fromEntries((res.body.data as User[]).map((u) => [u.username, u.email]));
		expect(byName).toMatchObject({
			idanl: null,
			'dana.l': 'Dana@Example.com',
			noa: 'noa@example.com',
			'svc-deploy': null,
		});
	});

	test('roles change by username (or email); an admin renames a username and sets or clears the email', async () => {
		const byUsername = await app
			.patch('/api/v1/users/role')
			.set(auth())
			.send({ username: 'noa', newRole: 'editor' });
		expect(byUsername.status).toBe(200);
		const byEmail = await app
			.patch('/api/v1/users/role')
			.set(auth())
			.send({ email: 'noa@example.com', newRole: 'viewer' });
		expect(byEmail.status).toBe(200);
		const unknown = await app
			.patch('/api/v1/users/role')
			.set(auth())
			.send({ username: 'nobody', newRole: 'viewer' });
		expect(unknown.status).toBe(404);

		const users = (await app.get('/api/v1/users').set(auth())).body.data as User[];
		const noa = users.find((u) => u.username === 'noa')!;
		const renamed = await app.patch(`/api/v1/users/${noa.id}`).set(auth()).send({ username: 'Noa.B', email: null });
		expect(renamed.status).toBe(200);
		expect(renamed.body.data).toMatchObject({ username: 'noa.b', email: null, role: 'viewer' });
		const collide = await app.patch(`/api/v1/users/${noa.id}`).set(auth()).send({ username: 'dana.l' });
		expect(collide.status).toBe(400);
		expect(collide.body.error).toBe('Username already taken');
		const withMail = await app.patch(`/api/v1/users/${noa.id}`).set(auth()).send({ email: 'noa.b@example.com' });
		expect(withMail.status).toBe(200);
		expect(withMail.body.data.email).toBe('noa.b@example.com');
		// Signs in under the new name, not the old.
		expect(
			(await app.post('/api/v1/users/login').send({ identifier: 'noa.b', password: 'securepassword' })).status
		).toBe(200);
		expect(
			(await app.post('/api/v1/users/login').send({ identifier: 'noa', password: 'securepassword' })).status
		).toBe(401);
	});

	test('an old database with Dana@x and dana@x: an action by the exact spelling hits that account; a third spelling is refused', async () => {
		// Seeded straight into the table, as an old database would have left them — such a
		// database has no case-insensitive email index (see ensureEmailUniqueIgnoringCase).
		db.exec('DROP INDEX IF EXISTS users_email_unique_nocase');
		const seed = db.prepare(
			`INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, 'h', ?, 'viewer')`
		);
		seed.run('case-a', 'Case@acme.test', 'Case A');
		seed.run('case-b', 'case@acme.test', 'Case B');
		const exact = await app
			.patch('/api/v1/users/role')
			.set(auth())
			.send({ email: 'case@acme.test', newRole: 'editor' });
		expect(exact.status).toBe(200);
		const users = (await app.get('/api/v1/users').set(auth())).body.data as User[];
		expect(users.find((u) => u.username === 'case-b')?.role).toBe('editor');
		expect(users.find((u) => u.username === 'case-a')?.role).toBe('viewer');
		const ambiguous = await app
			.patch('/api/v1/users/role')
			.set(auth())
			.send({ email: 'CASE@ACME.TEST', newRole: 'admin' });
		expect(ambiguous.status).toBe(409);
		expect(users.filter((u) => u.role === Role.Admin).map((u) => u.username)).toEqual(['idanl']);
	});

	test('an admin sets the password of an account that has no email (its only reset path)', async () => {
		const users = (await app.get('/api/v1/users').set(auth())).body.data as User[];
		const bot = users.find((u) => u.username === 'svc-deploy')!;
		const reset = await app
			.patch(`/api/v1/users/${bot.id}/reset-password`)
			.set(auth())
			.send({ newPassword: 'another-password' });
		expect(reset.status).toBe(200);
		expect(
			(await app.post('/api/v1/users/login').send({ identifier: 'svc-deploy', password: 'another-password' }))
				.status
		).toBe(200);
	});
});
