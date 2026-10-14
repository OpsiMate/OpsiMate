import { afterEach, describe, expect, test, vi } from 'vitest';
import nodemailer, { type Transporter } from 'nodemailer';
import type { OpsimateConfig } from '../src/config/config.ts';
import { MailClient, MailType } from '../src/dal/external-client/mail-client.ts';

// tests/setup.ts loads the whole app before any test file runs, so these tests spy on
// the real nodemailer export instead of vi.mock'ing the module.

type MailerConfig = NonNullable<OpsimateConfig['mailer']>;

interface MailerConfigHolder {
	mailerConfig: MailerConfig;
}

const transportOptions: Record<string, unknown>[] = [];
const mailOptions: Record<string, unknown>[] = [];

function stubNodemailer() {
	vi.spyOn(nodemailer, 'createTransport').mockImplementation((options: unknown) => {
		transportOptions.push(options as Record<string, unknown>);
		return {
			verify: () => Promise.resolve(true),
			sendMail: (mail: unknown) => {
				mailOptions.push(mail as Record<string, unknown>);
				return Promise.resolve();
			},
		} as unknown as Transporter;
	});
}

function smtpConfig(overrides: Partial<MailerConfig> = {}): MailerConfig {
	return {
		enabled: true,
		host: 'smtp.example.com',
		port: 587,
		from: '"OpsiMate" <ops@example.com>',
		mailLinkBaseUrl: 'https://opsimate.example.com',
		auth: { user: 'ops@example.com', pass: 'secret' },
		...overrides,
	};
}

async function sendWith(config: MailerConfig) {
	const client = new MailClient();
	// The mailer section is read once, in a field initializer, so the per-case config
	// is put on the instance rather than coaxed out of the config singleton.
	(client as unknown as MailerConfigHolder).mailerConfig = config;
	await client.initialize();
	await client.sendMail({ to: 'someone@example.com', mailType: MailType.PASSWORD_RESET, token: 'reset-token' });
	return { transport: transportOptions[0], mail: mailOptions[0] };
}

describe('MailClient SMTP options', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		transportOptions.length = 0;
		mailOptions.length = 0;
	});

	test('passes the tls section to createTransport', async () => {
		stubNodemailer();
		const { transport } = await sendWith(smtpConfig({ tls: { rejectUnauthorized: false } }));

		expect(transport.tls).toEqual({ rejectUnauthorized: false });
	});

	test('passes replyTo to sendMail', async () => {
		stubNodemailer();
		const { mail } = await sendWith(smtpConfig({ replyTo: 'replies@example.com' }));

		expect(mail.replyTo).toBe('replies@example.com');
	});

	test('omits tls and replyTo when they are not configured', async () => {
		stubNodemailer();
		const { transport, mail } = await sendWith(smtpConfig());

		expect('tls' in transport).toBe(false);
		expect('replyTo' in mail).toBe(false);
	});

	test('keeps sending host, port, secure and auth', async () => {
		stubNodemailer();
		const { transport } = await sendWith(smtpConfig({ secure: true }));

		expect(transport.host).toBe('smtp.example.com');
		expect(transport.port).toBe(587);
		expect(transport.secure).toBe(true);
		expect(transport.auth).toEqual({ user: 'ops@example.com', pass: 'secret' });
	});
});
