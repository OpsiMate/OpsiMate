import Database from 'better-sqlite3';
import { parentPort, workerData } from 'node:worker_threads';
import { Logger } from '@OpsiMate/shared';
import { AlertCommentsRepository } from '../../dal/alertCommentsRepository';
import { AlertHistoryRepository } from '../../dal/alertHistoryRepository';
import { AlertRepository } from '../../dal/alertRepository';
import { AuditLogRepository } from '../../dal/auditLogRepository';
import { EnrichmentRepository } from '../../dal/enrichmentRepository';
import { MutePolicyRepository } from '../../dal/mutePolicyRepository';
import { AuditBL } from '../audit/audit.bl';
import { EnrichmentBL } from '../enrichments/enrichment.bl';
import { MutePolicyBL } from '../mute-policies/mutePolicy.bl';
import { ActiveListBuilder } from './activeListBuilder';
import { BuildRequest, SnapshotWorkerData, WorkerMessage } from './snapshotWorkerClient';

// The snapshot worker thread: owns an ActiveListBuilder over its own connection to
// the database file and answers each build request with the delta since the last
// one. See SnapshotWorkerClient for the protocol and why this exists.

const logger = new Logger('bl/snapshotWorker');
const port = parentPort;
if (!port) throw new Error('snapshotWorker must run as a worker thread');

const { dbPath } = workerData as SnapshotWorkerData;
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

const auditBL = new AuditBL(new AuditLogRepository(db));
const enrichmentBL = new EnrichmentBL(new EnrichmentRepository(db), auditBL);
const mutePolicyBL = new MutePolicyBL(new MutePolicyRepository(db), auditBL);
const builder = new ActiveListBuilder(
	new AlertRepository(db),
	new AlertCommentsRepository(db),
	new AlertHistoryRepository(db),
	() => enrichmentBL.prepareEnricher(),
	() => mutePolicyBL.prepareMuter()
);

// The order the last reply carried; an unchanged order is sent as null.
let lastOrder = '';

port.on('message', (request: BuildRequest) => {
	if (request.type !== 'build') return;
	builder
		.build()
		.then(({ alerts, changed, fingerprint }) => {
			const order = alerts.map((alert) => alert.id);
			const orderKey = order.join('\n');
			const reply: WorkerMessage = {
				type: 'built',
				seq: request.seq,
				order: orderKey === lastOrder ? null : order,
				changed,
				fingerprint,
			};
			lastOrder = orderKey;
			port.postMessage(reply);
		})
		.catch((error: unknown) => {
			logger.error('snapshot build failed in worker', error);
			const reply: WorkerMessage = {
				type: 'failed',
				seq: request.seq,
				message: error instanceof Error ? error.message : String(error),
			};
			port.postMessage(reply);
		});
});
