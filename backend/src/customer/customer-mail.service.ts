import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class CustomerMailService {
  private readonly logger = new Logger(CustomerMailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly fromAddress: string;
  private readonly hasMailConfig: boolean;

  constructor(private readonly config: ConfigService) {
    const user =
      this.config.get<string>('MAIL_USER')
      ?? this.config.get<string>('SMTP_USER')
      ?? this.config.get<string>('EMAIL_USER')
      ?? this.config.get<string>('GMAIL_USER');
    const rawPass =
      this.config.get<string>('MAIL_PASS')
      ?? this.config.get<string>('SMTP_PASS')
      ?? this.config.get<string>('EMAIL_PASS')
      ?? this.config.get<string>('GMAIL_APP_PASSWORD')
      ?? this.config.get<string>('GMAIL_PASS');
    const pass = rawPass?.replace(/\s+/g, '');
    const inferredService = user?.toLowerCase().endsWith('@gmail.com') ? 'Gmail' : undefined;
    const service =
      this.config.get<string>('MAIL_SERVICE')
      ?? this.config.get<string>('SMTP_SERVICE')
      ?? this.config.get<string>('EMAIL_SERVICE')
      ?? this.config.get<string>('GMAIL_SERVICE')
      ?? inferredService;
    const host = this.config.get<string>('MAIL_HOST') ?? this.config.get<string>('SMTP_HOST');
    const portValue = this.config.get<string>('MAIL_PORT') ?? this.config.get<string>('SMTP_PORT');
    const secureValue = this.config.get<string>('MAIL_SECURE') ?? this.config.get<string>('SMTP_SECURE');
    const from =
      this.config.get<string>('MAIL_FROM')
      ?? this.config.get<string>('SMTP_FROM')
      ?? this.config.get<string>('EMAIL_FROM')
      ?? user
      ?? 'no-reply@platepe.local';

    this.fromAddress = from;
    this.hasMailConfig = Boolean(user && pass && (service || host));

    if (!this.hasMailConfig) {
      this.logger.warn('Mail transport not configured — set MAIL_USER and MAIL_PASS (or SMTP/GMAIL equivalents)');
      this.transporter = null;
      return;
    }

    const secure = secureValue ? secureValue === 'true' : Number(portValue ?? 587) === 465;
    const port = Number(portValue ?? (secure ? 465 : 587));

    this.transporter = nodemailer.createTransport(
      service
        ? {
            service,
            auth: { user, pass },
          }
        : {
            host,
            port,
            secure,
            auth: { user, pass },
          },
    );
  }

  async sendCustomerOtpEmail(input: { email: string; otp: string; name?: string | null }) {
    if (!this.transporter) {
      throw new ServiceUnavailableException('Email OTP is not configured');
    }

    const greeting = input.name?.trim() ? `Hi ${input.name.trim()},` : 'Hi,';

    await this.transporter.sendMail({
      from: this.fromAddress,
      to: input.email,
      subject: 'Your PlatePe verification code',
      text: `${greeting}\n\nYour PlatePe verification code is ${input.otp}. It expires in 10 minutes.\n\nIf you did not request this code, you can ignore this email.`,
      html: `
        <div style="font-family:Arial,sans-serif;background:#faf7f3;padding:24px;">
          <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #eee3d8;">
            <p style="margin:0 0 16px;color:#3c2f28;font-size:16px;">${greeting}</p>
            <p style="margin:0 0 20px;color:#5a4a40;font-size:15px;line-height:1.6;">Use this verification code to continue your PlatePe order.</p>
            <div style="margin:0 0 20px;padding:16px 20px;border-radius:12px;background:#fff3e7;color:#a24d00;font-size:30px;font-weight:700;letter-spacing:0.35em;text-align:center;">
              ${input.otp}
            </div>
            <p style="margin:0 0 8px;color:#5a4a40;font-size:14px;">This code expires in 10 minutes.</p>
            <p style="margin:0;color:#8a776b;font-size:13px;">If you did not request this code, you can safely ignore this email.</p>
          </div>
        </div>
      `,
    });
  }
}
