import {
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
  Staging = 'staging',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  @Min(1)
  @Max(65535)
  PORT: number;

  @IsString()
  APP_NAME: string;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  JWT_EXPIRATION: string;

  @IsString()
  JWT_REFRESH_SECRET: string;

  @IsString()
  JWT_REFRESH_EXPIRATION: string;

  @IsString()
  REDIS_HOST: string;

  @IsNumber()
  @Min(1)
  @Max(65535)
  REDIS_PORT: number;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsString()
  CORS_ORIGINS: string;

  @IsNumber()
  @Min(1)
  RATE_LIMIT_TTL: number;

  @IsNumber()
  @Min(1)
  RATE_LIMIT_MAX: number;

  @IsString()
  LOG_LEVEL: string;

  @IsNumber()
  @Min(1)
  MAX_FILE_SIZE: number;

  @IsString()
  UPLOAD_DESTINATION: string;
}
