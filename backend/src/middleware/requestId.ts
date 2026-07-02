import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header('x-request-id');
  const id = incoming && incoming.length <= 128 ? incoming : crypto.randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}
