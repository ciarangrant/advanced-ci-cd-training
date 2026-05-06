const { describe, it } = require('node:test');
const assert = require('node:assert');
const { handleRequest } = require('./index');

describe('handleRequest', () => {
  it('returns 200 for /health', (t, done) => {
    const req = { url: '/health' };
    const res = {
      statusCode: null,
      headers: {},
      body: '',
      writeHead(code, headers) {
        this.statusCode = code;
        this.headers = headers;
      },
      end(data) {
        this.body = data;
        assert.strictEqual(this.statusCode, 200);
        const parsed = JSON.parse(this.body);
        assert.strictEqual(parsed.status, 'ok');
        assert.ok(parsed.timestamp > 0);
        done();
      },
    };
    handleRequest(req, res);
  });

  it('returns 200 for root path', (t, done) => {
    const req = { url: '/' };
    const res = {
      statusCode: null,
      writeHead(code) {
        this.statusCode = code;
      },
      end(data) {
        assert.strictEqual(this.statusCode, 200);
        assert.ok(data.includes('Pipeline Architecture'));
        done();
      },
    };
    handleRequest(req, res);
  });
});
