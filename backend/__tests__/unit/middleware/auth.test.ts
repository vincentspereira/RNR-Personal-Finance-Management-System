jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

import jwt from 'jsonwebtoken';
import { authMiddleware } from '../../../src/middleware/auth';

describe('authMiddleware', () => {
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    (jwt.verify as jest.Mock).mockReset();
    req = { headers: {} };
    res = {};
    next = jest.fn();
  });

  it('rejects requests without an Authorization header', () => {
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });

  it('rejects non-Bearer schemes', () => {
    req.headers.authorization = 'Basic dXNlcjpwYXNz';
    authMiddleware(req, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });

  it('rejects invalid tokens', () => {
    req.headers.authorization = 'Bearer broken';
    (jwt.verify as jest.Mock).mockImplementation(() => { throw new Error('bad signature'); });
    authMiddleware(req, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });

  it('attaches the decoded payload to req.user and calls next() with no error', () => {
    req.headers.authorization = 'Bearer good.token';
    (jwt.verify as jest.Mock).mockReturnValue({ id: 'u1', email: 'a@b.co' });
    authMiddleware(req, res, next);
    expect(req.user).toEqual({ id: 'u1', email: 'a@b.co' });
    expect(next).toHaveBeenCalledWith();
  });
});
