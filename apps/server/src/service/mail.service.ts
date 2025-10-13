import { Logger } from "@OpsiMate/shared";
import nodemailer from "nodemailer";

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
  private transporter: nodemailer.Transporter = null as any;

  constructor() {
    this.initTransporter();
  }

  /**
   * Initialize the nodemailer transporter with SMTP settings
   */
  initTransporter() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    this.transporter
      .verify()
      .then(() => {
        logger.info("MailService: SMTP transporter is ready to send emails");
      })
      .catch((error) => {
        logger.error("MailService: Error verifying SMTP transporter", error);
      });
  }

  /**
   * Send an email
   * @param options
   */
  async sendMail(options: SendMailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || '"OpsiMate" <no-reply@opsimate.com>',
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
    } catch (error) {
      logger.error("MailService: Error sending email", error);
      throw new Error("Failed to send email");
    }
  }
}
