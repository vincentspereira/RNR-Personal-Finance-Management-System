import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

export interface AppError extends Error {
  statusCode?: number;
  details?: any;
}

export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction) {
  const statusCode = err.statusCode || 500;
  const isServerError = statusCode >= 500;
  const message = isServerError ? 'Internal server error' : err.message;

  if (isServerError) {
    logger.error({
      requestId: (req as any).requestId,
      method: req.method,
      url: req.originalUrl,
      userId: (req as any).user?.id,
      err: { message: err.message, stack: err.stack, details: err.details },
    }, 'Unhandled error');
  } else {
    logger.warn({
      requestId: (req as any).requestId,
      method: req.method,
      url: req.originalUrl,
      userId: (req as any).user?.id,
      statusCode,
      msg: err.message,
    }, 'Client error');
  }

  res.status(statusCode).json({
    success: false,
    data: null,
    error: message,
    meta: process.env.NODE_ENV === 'development'
      ? { stack: err.stack, details: err.details, requestId: (req as any).requestId }
      : { requestId: (req as any).requestId, details: err.details },
  });
}

export function createError(statusCode: number, message: string, details?: any): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.details = details;
  return err;
}
