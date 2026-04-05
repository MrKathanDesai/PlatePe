import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function normalizeEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/^['"]|['"]$/g, '');
}

@Injectable()
export class CustomerMailService {
  private readonly logger = new Logger(CustomerMailService.name);
  private readonly apiKey: string | undefined;
  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly hasMailConfig: boolean;

  constructor(private readonly config: ConfigService) {
    this.apiKey = normalizeEnvValue(
      this.config.get<string>('BREVO_API_KEY')
      ?? this.config.get<string>('SENDINBLUE_API_KEY'),
    );

    this.fromAddress =
      normalizeEnvValue(
        this.config.get<string>('MAIL_FROM')
        ?? this.config.get<string>('BREVO_FROM_EMAIL')
        ?? this.config.get<string>('EMAIL_FROM'),
      )
      ?? 'no-reply@platepe.local';

    this.fromName =
      normalizeEnvValue(
        this.config.get<string>('MAIL_FROM_NAME')
        ?? this.config.get<string>('BREVO_FROM_NAME'),
      )
      ?? 'PlatePe';

    this.hasMailConfig = Boolean(this.apiKey && this.fromAddress);

    if (!this.hasMailConfig) {
      this.logger.warn('Brevo mail not configured — set BREVO_API_KEY and MAIL_FROM');
    }
  }

  async sendCustomerOtpEmail(input: { email: string; otp: string; name?: string | null }) {
    if (!this.hasMailConfig || !this.apiKey) {
      throw new ServiceUnavailableException('Email OTP is not configured');
    }

    const greeting = input.name?.trim() ? `Hi ${input.name.trim()},` : 'Hi,';
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': this.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          email: this.fromAddress,
          name: this.fromName,
        },
        to: [{ email: input.email }],
        subject: 'Your PlatePe verification code',
        textContent: `${greeting}\n\nYour PlatePe verification code is ${input.otp}. It expires in 10 minutes.\n\nIf you did not request this code, you can ignore this email.`,
        htmlContent: `
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
      }),
      signal: AbortSignal.timeout(15000),
    }).catch((error: unknown) => {
      this.logger.error(`Brevo request failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw new ServiceUnavailableException('Email delivery is temporarily unavailable');
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      this.logger.error(`Brevo rejected email send with ${response.status}: ${errorBody}`);
      throw new InternalServerErrorException('Failed to send verification code');
    }
  }
}
