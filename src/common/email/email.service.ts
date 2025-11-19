import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendVerificationEmail(
    email: string,
    name: string,
    verificationToken: string,
  ): Promise<void> {
    const verificationUrl = `${this.configService.get<string>('app.frontendUrl')}/verify-email?token=${verificationToken}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Verify Your Email - CondoMarket',
        template: 'verify-email',
        context: {
          name,
          verificationUrl,
        },
      });

      this.logger.log(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${email}`,
        error.stack,
      );
      throw new Error('Failed to send verification email');
    }
  }

  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string,
  ): Promise<void> {
    const resetUrl = `${this.configService.get<string>('app.frontendUrl')}/reset-password?token=${resetToken}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Reset Your Password - CondoMarket',
        template: 'reset-password',
        context: {
          name,
          resetUrl,
        },
      });

      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}`,
        error.stack,
      );
      throw new Error('Failed to send password reset email');
    }
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Welcome to CondoMarket!',
        template: 'welcome',
        context: {
          name,
        },
      });

      this.logger.log(`Welcome email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${email}`,
        error.stack,
      );
      // Don't throw error for welcome email - it's not critical
    }
  }
}
