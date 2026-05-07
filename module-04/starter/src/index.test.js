const { describe, it } = require('node:test');
const assert = require('node:assert');
const { isEnabled } = require('./flags');

describe('flags', () => {
  it('isEnabled returns false for a flag that does not exist', () => {
    assert.strictEqual(isEnabled('nonexistent-flag'), false);
  });

  it('isEnabled returns false for disabled flag', () => {
    // This test will pass once you complete Task 1 (add the flag to flags.json)
    // and Task 2 (implement isEnabled in flags.js).
    // The flag must be set to enabled: false in config/flags.json for this to pass.
    const result = isEnabled('new-dashboard-widget');
    assert.strictEqual(result, false);
  });
});

describe('handleRequest', () => {
  it('/health returns status ok', async () => {
    const { handleRequest } = require('./index');
    const result = await new Promise((resolve) => {
      const req = { url: '/health' };
      const res = {
        writeHead: () => {},
        end: (body) => resolve(JSON.parse(body))
      };
      handleRequest(req, res);
    });
    assert.strictEqual(result.status, 'ok');
  });

  it('/dashboard returns a response object', async () => {
    const { handleRequest } = require('./index');
    const result = await new Promise((resolve) => {
      const req = { url: '/dashboard' };
      const res = {
        writeHead: () => {},
        end: (body) => resolve(JSON.parse(body))
      };
      handleRequest(req, res);
    });
    assert.strictEqual(result.user, 'demo-user');
    assert.ok(result.timestamp);
  });

  it('/dashboard returns widget field when flag is enabled', async () => {
    // This test writes a temporary flags config with the flag enabled,
    // then checks the /dashboard response includes the widget.
    const fs = require('node:fs');
    const path = require('node:path');
    const flagsPath = path.join(__dirname, '..', 'config', 'flags.json');

    // Save original flags content
    const original = fs.readFileSync(flagsPath, 'utf8');

    // Write config with flag enabled
    const enabledConfig = {
      version: '1',
      flags: {
        'new-dashboard-widget': {
          name: 'New Dashboard Widget',
          description: 'Controls visibility of the new dashboard widget'
        }
      },
      values: {
        'new-dashboard-widget': { enabled: true }
      }
    };
    fs.writeFileSync(flagsPath, JSON.stringify(enabledConfig, null, 2));

    // Clear require cache so modules re-read the flag file
    delete require.cache[require.resolve('./flags')];
    delete require.cache[require.resolve('./index')];
    const { handleRequest: handler } = require('./index');

    const result = await new Promise((resolve) => {
      const req = { url: '/dashboard' };
      const res = {
        writeHead: () => {},
        end: (body) => resolve(JSON.parse(body))
      };
      handler(req, res);
    });

    // Restore original flags content
    fs.writeFileSync(flagsPath, original);

    assert.strictEqual(result.widget.type, 'analytics');
    assert.strictEqual(result.widget.title, 'New Dashboard Widget');
  });
});
