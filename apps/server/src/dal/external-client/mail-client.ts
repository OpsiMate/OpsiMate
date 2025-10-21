import { Logger } from "@OpsiMate/shared";
import nodemailer from "nodemailer";
import { getMailerConfig } from "../../config/config.js";
import { passwordResetTemplate } from "../../utils/mailTemplate.js";

export enum MailType {
  PASSWORD_RESET = "PASSWORD_RESET",
}

interface SendMailOptions {
  to: string;
  userName?: string;
  subject: string;
  mailType?: MailType;
  text?: string;
  token?: string;
}

const logger = new Logger("service/mail.service");

/**
 * Service for sending emails using nodemailer
 */
export class MailClient {
  private transporter: nodemailer.Transporter | null = null;
  private mailerConfig = getMailerConfig();
  private verified = false;

  /**
   * Initialize the MailClient
   */
  async initialize() {
    await this.initTransporter();
  }

  /**
   * Initialize the nodemailer transporter with SMTP settings
   */
  private async initTransporter() {
    if (
      !this.mailerConfig ||
      !this.mailerConfig.enabled ||
      !this.mailerConfig.auth
    ) {
      logger.info("MailClient: SMTP config is not available");
      this.transporter = null;
      return;
    }

    if (
      this.mailerConfig.host &&
      this.mailerConfig.port &&
      this.mailerConfig.auth.user &&
      this.mailerConfig.auth.pass
    ) {
      this.transporter = nodemailer.createTransport({
        host: this.mailerConfig.host,
        port: this.mailerConfig.port,
        secure: this.mailerConfig.secure ?? false,
        auth: {
          user: this.mailerConfig.auth.user,
          pass: this.mailerConfig.auth.pass,
        },
      });

      await this.transporter
        .verify()
        .then(() => {
          this.verified = true;
          logger.info("MailClient: SMTP transporter is ready to send emails");
        })
        .catch((error) => {
          logger.error("MailClient: Error verifying SMTP transporter", error);
          this.transporter = null;
        });
    } else {
      logger.warn(
        "MailClient: SMTP settings are not fully configured. Email sending is disabled."
      );
    }
  }

  private getResetPasswordTemplate(userName?: string, token?: string): string {
    const mailLinkBaseUrl = this.mailerConfig?.mailLinkBaseUrl;
    if (!mailLinkBaseUrl) {
      throw new Error("mailLinkBaseUrl is required to build mail templates");
    }

    if (!token) {
      throw new Error("Token is required for password reset email template");
    }

    const passwordResetHtml = passwordResetTemplate(
      `${mailLinkBaseUrl}/reset-password?token=${encodeURIComponent(token)}`,
      userName
    );

    return passwordResetHtml;
  }

  private getMailTemplate(
    mailType: MailType,
    userName?: string,
    token?: string
  ): string {
    switch (mailType) {
      case MailType.PASSWORD_RESET:
        return this.getResetPasswordTemplate(userName, token);
      default:
        throw new Error(`Unsupported mail type`);
    }
  }

  /**
   * Send an email
   * @param options
   */
  async sendMail(options: SendMailOptions): Promise<void> {
    if (!this.transporter || !this.verified) {
      logger.error("MailClient: SMTP transporter is not configured");
      throw new Error("SMTP transporter is not configured");
    }

    const mailTemplate = options.mailType
      ? this.getMailTemplate(options.mailType, options.userName, options.token)
      : undefined;

    await this.transporter.sendMail({
      from: this.mailerConfig?.from || '"OpsiMate" <no-reply@opsimate.com>',
      to: options.to,
      subject: options.subject,
      html: mailTemplate || undefined,
      text: options.text,
    });
  }
}
