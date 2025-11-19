import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASS,
  },
  from: process.env.SMTP_FROM || 'noreply@condomarketapi.com',
}));
