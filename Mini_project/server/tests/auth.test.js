const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// No real database in unit/API tests: the repository is replaced by a mock.
jest.mock('../src/repositories/userRepo');
const userRepo = require('../src/repositories/userRepo');
const app = require('../src/app');

const PASSWORD = 'Test@123';
const leadUser = {
  id: 1,
  name: 'Club Lead A',
  email: 'lead.a@college.edu',
  password_hash: bcrypt.hashSync(PASSWORD, 4), // low cost = fast tests
  role: 'CLUB_LEAD',
  club_id: 7,
};

beforeEach(() => {
  userRepo.findByEmail.mockReset();
  userRepo.findByEmail.mockImplementation(async (email) =>
    email === leadUser.email ? leadUser : null
  );
});

describe('TC-AUTH-01 login and logout (SCP-F-001)', () => {
  test('valid credentials return a JWT that expires in 8 hours', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: leadUser.email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toEqual({ id: 1, name: 'Club Lead A', role: 'CLUB_LEAD', clubId: 7 });
    expect(res.body.user.password_hash).toBeUndefined();

    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload.role).toBe('CLUB_LEAD');
    expect(payload.exp - payload.iat).toBe(8 * 60 * 60);
  });

  test('email is case-insensitive and trimmed', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '  LEAD.A@College.edu ', password: PASSWORD });
    expect(res.status).toBe(200);
  });

  test('wrong password returns 401 and no token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: leadUser.email, password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
  });

  test('unknown email gets the same 401 message as a wrong password', async () => {
    const wrongPass = await request(app)
      .post('/api/auth/login')
      .send({ email: leadUser.email, password: 'wrong' });
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@college.edu', password: PASSWORD });

    expect(unknown.status).toBe(401);
    expect(unknown.body.message).toBe(wrongPass.body.message);
  });

  test('missing email or password returns 400', async () => {
    const noPass = await request(app).post('/api/auth/login').send({ email: leadUser.email });
    const noEmail = await request(app).post('/api/auth/login').send({ password: PASSWORD });
    const empty = await request(app).post('/api/auth/login').send({});

    expect(noPass.status).toBe(400);
    expect(noEmail.status).toBe(400);
    expect(empty.status).toBe(400);
  });

  test('logout with a valid token returns 200', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: leadUser.email, password: PASSWORD });

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
  });
});

describe('TC-SEC-02 token checks (SCP-SR-002)', () => {
  test('logout without a token returns 401', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  test('a tampered token returns 401', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: leadUser.email, password: PASSWORD });

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${login.body.token}x`);

    expect(res.status).toBe(401);
  });

  test('an expired token returns 401', async () => {
    const expired = jwt.sign({ sub: 1, role: 'CLUB_LEAD' }, process.env.JWT_SECRET, {
      expiresIn: -10,
    });
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});

describe('TC-SEC-04 injection attempt on login (SCP-SR-004)', () => {
  test("' OR 1=1 -- is treated as a plain email and rejected", async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: "' OR 1=1 --", password: PASSWORD });

    expect(res.status).toBe(401);
    // The repository received the payload as a plain value (parameterised query).
    expect(userRepo.findByEmail).toHaveBeenCalledWith("' or 1=1 --");
  });

  test('non-string values are rejected with 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
  });
});

describe('TC-SEC-01 password hashing (SCP-SR-001)', () => {
  test('the stored hash is bcrypt and not the plaintext password', () => {
    expect(leadUser.password_hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(leadUser.password_hash).not.toContain(PASSWORD);
  });

  test('login never writes the password to the logs', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await request(app)
      .post('/api/auth/login')
      .send({ email: leadUser.email, password: PASSWORD });

    const logged = JSON.stringify([...spy.mock.calls, ...errSpy.mock.calls]);
    expect(logged).not.toContain(PASSWORD);
    spy.mockRestore();
    errSpy.mockRestore();
  });
});
