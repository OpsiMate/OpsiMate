// A second OpsiMate-like process for dbStartup.test.ts: opens the database it is given and
// prepares a table under the schema lock the way a repository does (look at the shape,
// then alter it). Run with tsx. Prints one word per step on stdout so the test can follow.
//
//   schemaLockProcess.ts <db path> migrate   check-then-add column `b` to table `t`
//   schemaLockProcess.ts <db path> hold      take the lock and keep it until killed
/* eslint-disable no-console -- stdout is this process's report to the test */
import Database from 'better-sqlite3';
import { applyConnectionPragmas, withSchemaLock } from '../../src/dal/db';

const [dbPath, mode] = process.argv.slice(2);
const db = new Database(dbPath);
applyConnectionPragmas(db);
console.log('started');

await withSchemaLock(db, async () => {
	if (mode === 'hold') {
		console.log('holding');
		await new Promise(() => {});
		return;
	}
	const columns = db.prepare(`PRAGMA table_info(t)`).all() as { name: string }[];
	if (columns.some((column) => column.name === 'b')) {
		console.log('skipped');
	} else {
		db.exec(`ALTER TABLE t ADD COLUMN b TEXT`);
		console.log('added');
	}
});
db.close();
