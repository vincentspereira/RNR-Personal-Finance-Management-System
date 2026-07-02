import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { createError } from './errorHandler';

type RequestSource = 'body' | 'query' | 'params';

/**
 * Express middleware that validates `req[source]` against a Zod schema and,
 * on success, replaces it with the parsed (and coerced) value so downstream
 * handlers see safe, typed data.
 */
export function validate<T>(schema: ZodSchema<T>, source: RequestSource = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse((req as any)[source]);
      (req as any)[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        return next(createError(400, 'Validation failed', details));
      }
      next(err);
    }
  };
}
