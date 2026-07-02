jest.mock('../../../src/services/authService', () => ({
  register: jest.fn(),
  login: jest.fn(),
  refreshSession: jest.fn(),
  logout: jest.fn(),
  changePassword: jest.fn(),
  getUser: jest.fn(),
  AuthError: class AuthError extends Error {
    statusCode: number;
    constructor(m: string, s = 401) { super(m); this.statusCode = s; }
  },
}));

import * as authController from '../../../src/controllers/authController';
import * as authService from '../../../src/services/authService';

function res() {
  const r: any = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
}

describe('authController.register', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects non-email values', async () => {
    const next = jest.fn();
    await authController.register({ body: { email: 'nope', password: 'x', name: 'a' } } as any, res(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('returns 201 with the service result on success', async () => {
    (authService.register as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, token: 't', refreshToken: 'r' });
    const r = res();
    const next = jest.fn();
    await authController.register(
      { body: { email: 'a@b.co', password: 'StrongPass1', name: 'A' } } as any,
      r,
      next
    );
    expect(r.status).toHaveBeenCalledWith(201);
    expect(r.json).toHaveBeenCalledWith({ success: true, data: { user: { id: 'u1' }, token: 't', refreshToken: 'r' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards errors to next', async () => {
    (authService.register as jest.Mock).mockRejectedValue(Object.assign(new Error('dup'), { statusCode: 409 }));
    const next = jest.fn();
    await authController.register(
      { body: { email: 'a@b.co', password: 'StrongPass1', name: 'A' } } as any,
      res(),
      next
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
  });
});

describe('authController.login', () => {
  it('rejects missing creds with 400', async () => {
    const next = jest.fn();
    await authController.login({ body: {} } as any, res(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('returns service result on success', async () => {
    (authService.login as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, token: 't' });
    const r = res();
    await authController.login({ body: { email: 'a@b.co', password: 'StrongPass1' } } as any, r, jest.fn());
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

describe('authController.refresh / logout / changePassword', () => {
  it('refresh requires refreshToken', async () => {
    const next = jest.fn();
    await authController.refresh({ body: {} } as any, res(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('refresh returns rotated tokens', async () => {
    (authService.refreshSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, token: 't', refreshToken: 'r' });
    const r = res();
    await authController.refresh({ body: { refreshToken: 'x' } } as any, r, jest.fn());
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('logout always returns success, even without a token', async () => {
    const r = res();
    await authController.logout({ body: {} } as any, r, jest.fn());
    expect(r.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it('changePassword requires authentication', async () => {
    const next = jest.fn();
    await authController.changePassword({ body: { oldPassword: 'a', newPassword: 'b' } } as any, res(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});
