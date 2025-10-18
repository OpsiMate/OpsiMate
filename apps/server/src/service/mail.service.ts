import { Logger } from "@OpsiMate/shared";
import nodemailer from "nodemailer";
import { getMailerConfig } from "../config/config.js";

interface SendMailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

const logger = new Logger("service/mail.service");

/**
 * Service for sending emails using nodemailer
 */
export class MailService {
  private transporter: nodemailer.Transporter | null = null;
  private mailerConfig = getMailerConfig();

  constructor() {
    this.initTransporter();
  }

  /**
   * Initialize the nodemailer transporter with SMTP settings
   */
  initTransporter() {
    if (
      !this.mailerConfig ||
      !this.mailerConfig.enabled ||
      !this.mailerConfig.auth
    ) {
      logger.info("MailService: SMTP config is not available");
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
        secure: false,
        auth: {
          user: this.mailerConfig.auth.user,
          pass: this.mailerConfig.auth.pass,
        },
      });

      this.transporter
        .verify()
        .then(() => {
          logger.info("MailService: SMTP transporter is ready to send emails");
        })
        .catch((error) => {
          logger.error("MailService: Error verifying SMTP transporter", error);
          this.transporter = null;
        });
    } else {
      logger.warn(
        "MailService: SMTP settings are not fully configured. Email sending is disabled."
      );
    }
  }

  /**
   * Send an email
   * @param options
   */
  async sendMail(options: SendMailOptions): Promise<void> {
    if (!this.transporter) {
      logger.error("MailService: SMTP transporter is not configured");
      throw new Error("SMTP transporter is not configured");
    }
    await this.transporter.sendMail({
      from: this.mailerConfig?.from || '"OpsiMate" <no-reply@opsimate.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  }
}
