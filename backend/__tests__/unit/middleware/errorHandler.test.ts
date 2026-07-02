import { errorHandler, createError } from '../../../src/middleware/errorHandler';

describe('createError', () => {
  it('creates error with statusCode and message', () => {
    const err = createError(400, 'Bad request');
    expect(err.message).toBe('Bad request');
    expect(err.statusCode).toBe(400);
  });

  it('creates error with details', () => {
    const err = createError(422, 'Validation failed', { field: 'email' });
    expect(err.details).toEqual({ field: 'email' });
  });

  it('defaults to no details', () => {
    const err = createError(500, 'Server error');
    expect(err.details).toBeUndefined();
  });
});

describe('errorHandler', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {};
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  it('handles known errors with custom status code', () => {
    const err = createError(400, 'Invalid input');
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Invalid input',
        data: null,
      })
    );
  });

  it('returns generic message for 500 errors', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('Something broke');
    errorHandler(err, req, res, next);
    spy.mockRestore();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Internal server error',
      })
    );
  });

  it('defaults to 500 if no statusCode set', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('Unknown');
    errorHandler(err, req, res, next);
    spy.mockRestore();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('includes meta with stack in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const err = createError(400, 'Test');
    errorHandler(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({ stack: expect.any(String) }),
      })
    );

    process.env.NODE_ENV = originalEnv;
  });

  it('does not leak stacks in production but includes requestId for support', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const err = createError(400, 'Test');
    errorHandler(err, req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.meta).toBeDefined();
    expect(payload.meta.stack).toBeUndefined();
    // requestId is undefined here because we didn't run the requestId middleware,
    // but the key shape is what matters.
    expect('requestId' in payload.meta).toBe(true);

    process.env.NODE_ENV = originalEnv;
  });

  it('handles 404 errors', () => {
    const err = createError(404, 'Not found');
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Not found' })
    );
  });

  it('handles 403 errors', () => {
    const err = createError(403, 'Forbidden');
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Forbidden' })
    );
  });
});
