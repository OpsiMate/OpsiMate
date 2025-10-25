import { Logger } from '@OpsiMate/shared';
import nodemailer from 'nodemailer';
import { getMailerConfig } from '../../config/config';
import { passwordResetTemplate, welcomeTemplate } from '../../utils/mailTemplate';

export enum MailType {
	PASSWORD_RESET = 'PASSWORD_RESET',
	WELCOME = 'WELCOME',
}

interface SendMailOptions {
	to: string;
	userName?: string;
	subject?: string;
	mailType: MailType;
	text?: string;
	token?: string;
	customTemplateBody?: string;
}

const logger = new Logger('service/mail.service');

/**
 * MailClient handles sending emails using SMTP configuration.
 * It supports sending different types of emails using predefined templates.
 */
export class MailClient {
	private transporter: nodemailer.Transporter | null = null;
	private mailerConfig = getMailerConfig();
	private verified = false;

	/**
	 * Initializes the MailClient by setting up the SMTP transporter.
	 * Must be called before sending any emails.
	 * @return Promise<void>
	 */
	async initialize(): Promise<void> {
		await this.setupTransporter();
	}

	/**
	 * Sets up the SMTP transporter if SMTP configuration is available.
	 * If not configured, the transporter remains null.
	 * Logs the status of the transporter setup.
	 * @return Promise<void>
	 */
	private async setupTransporter(): Promise<void> {
		if (!this.isSmtpConfigured()) {
			logger.info('MailClient: SMTP config is not available');
			this.transporter = null;
			return;
		}

		this.transporter = nodemailer.createTransport({
			host: this.mailerConfig?.host ?? '',
			port: this.mailerConfig?.port ?? 587,
			secure: this.mailerConfig?.secure ?? false,
			auth: {
				user: this.mailerConfig?.auth?.user ?? '',
				pass: this.mailerConfig?.auth?.pass ?? '',
			},
		});

		try {
			await this.transporter.verify();
			this.verified = true;
			logger.info('MailClient: SMTP transporter is ready to send emails');
		} catch (error) {
			logger.error('MailClient: Error verifying SMTP transporter', error);
			this.transporter = null;
			this.verified = false;
		}
	}

	/**
	 * Checks if SMTP configuration is available.
	 * @returns boolean
	 */
	private isSmtpConfigured(): boolean {
		const mailerCfg = this.mailerConfig;
		return !!(
			mailerCfg &&
			mailerCfg.enabled &&
			mailerCfg.host &&
			mailerCfg.port &&
			mailerCfg.auth?.user &&
			mailerCfg.auth?.pass
		);
	}

	/**
	 * Gets the welcome email template.
	 * @param options
	 * @returns string
	 */
	private getWelcomeTemplate(options: SendMailOptions): string {
		const body = this.mailerConfig?.templates?.welcomeTemplate?.content || options.customTemplateBody;
		return welcomeTemplate(body, options.userName);
	}

	/**
	 * Gets the password reset email template.
	 * @param options
	 * @returns string
	 */
	private getResetPasswordTemplate(options: SendMailOptions): string {
		if (!options.token) throw new Error('Token is required for password reset email');

		if (!this.mailerConfig?.mailLinkBaseUrl)
			throw new Error('mailLinkBaseUrl is required for password reset email');

		return passwordResetTemplate(
			`${this.mailerConfig?.mailLinkBaseUrl ?? ''}/reset-password?token=${encodeURIComponent(options.token)}`,
			options.userName
		);
	}

	/**
	 * Gets the appropriate mail template based on the mail type.
	 * @param options
	 * @returns string
	 */
	private getMailTemplate(options: SendMailOptions): string {
		switch (options.mailType) {
			case MailType.PASSWORD_RESET:
				return this.getResetPasswordTemplate(options);
			case MailType.WELCOME:
				return this.getWelcomeTemplate(options);
			default:
				throw new Error(`Unsupported mail type`);
		}
	}

	private getMailSubject(options: SendMailOptions): string {
		switch (options.mailType) {
			case MailType.PASSWORD_RESET:
				if (options.subject) {
					return options.subject;
				}
				return 'OpsiMate - Password Reset Request';
			case MailType.WELCOME:
				if (this.mailerConfig?.templates?.welcomeTemplate?.subject) {
					return this.mailerConfig.templates.welcomeTemplate.subject;
				}
				return 'Welcome to OpsiMate!';
			default:
				return 'OpsiMate Notification';
		}
	}

	/**
	 * Sends an email using the configured SMTP transporter.
	 * @param options
	 * @returns Promise<void>
	 */
	async sendMail(options: SendMailOptions): Promise<void> {
		if (!this.mailerConfig?.enabled) {
			logger.warn('MailClient: Email functionality is disabled. Cannot send email.');
			throw new Error(
				'Email functionality is disabled. Please configure SMTP settings in config.yml to enable email features.'
			);
		}

		if (!this.transporter || !this.verified) {
			logger.error('MailClient: SMTP transporter is not configured');
			throw new Error('SMTP transporter is not configured. Please check your SMTP settings in config.yml.');
		}

		let html: string | undefined;
		if (options.mailType) {
			html = this.getMailTemplate(options);
		}

		await this.transporter.sendMail({
			from: this.mailerConfig?.from || '"OpsiMate" <no-reply@opsimate.com>',
			to: options.to,
			subject: this.getMailSubject(options),
			html,
			text: options.text,
		});
	}
}
