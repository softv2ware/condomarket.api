import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(message, statusCode);
  }
}

export class ResourceNotFoundException extends HttpException {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier ${identifier} not found`
      : `${resource} not found`;
    super(message, HttpStatus.NOT_FOUND);
  }
}

export class ForbiddenAccessException extends HttpException {
  constructor(
    message: string = 'You do not have permission to access this resource',
  ) {
    super(message, HttpStatus.FORBIDDEN);
  }
}

export class ValidationException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
