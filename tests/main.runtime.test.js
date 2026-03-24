const test = require('node:test');
const assert = require('node:assert/strict');

const { parseCliArgs } = require('../main');

test('parseCliArgs preserves explicit CLI behavior', () => {
  const options = parseCliArgs(['--profile', 'danfoss', '--email']);

  assert.deepEqual(options, {
    email: true,
    help: false,
    profileId: 'danfoss',
  });
});

test('parseCliArgs still shows help when no profile is provided anywhere', () => {
  const options = parseCliArgs([]);

  assert.equal(options.help, true);
  assert.equal(options.profileId, null);
  assert.equal(options.email, false);
});

test('parseCliArgs keeps email disabled unless the flag is explicitly provided', () => {
  const options = parseCliArgs(['--profile', 'siemens']);

  assert.deepEqual(options, {
    email: false,
    help: false,
    profileId: 'siemens',
  });
});

test('parseCliArgs ignores env-shaped extra input and still requires explicit CLI profile', () => {
  const options = parseCliArgs([], {
    PROFILE: 'ls-electric',
    EMAIL_REPORT: 'true',
  });

  assert.deepEqual(options, {
    email: false,
    help: true,
    profileId: null,
  });
});
