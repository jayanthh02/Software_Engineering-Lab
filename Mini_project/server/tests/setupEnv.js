// Runs before each test file. Fixed secrets so tests never need a .env file.
process.env.JWT_SECRET = 'test-secret';
process.env.QR_HMAC_SECRET = 'test-hmac';
