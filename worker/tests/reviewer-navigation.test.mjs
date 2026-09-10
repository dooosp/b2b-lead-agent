import test from 'node:test';
import assert from 'node:assert/strict';
import { getLeadListReturnScript } from '../pages/script-snippets.js';

test('review tools only return to the same-origin lead list', () => {
  const resolve = Function('window', 'getProfile', `${getLeadListReturnScript()}; return getLeadListReturnUrl();`);
  for (const [target, expected] of [
    ['/leads?profile=danfoss&reviewStatus=NEEDS_REVIEW&view=kanban', '/leads?profile=danfoss&reviewStatus=NEEDS_REVIEW&view=kanban'],
    ['https://external.example/leads', '/leads?profile=danfoss'],
    ['//external.example/leads', '/leads?profile=danfoss'],
    ['javascript:alert(1)', '/leads?profile=danfoss'],
    ['/api/leads', '/leads?profile=danfoss'],
  ]) {
    const location = new URL(`http://localhost/ppt?returnTo=${encodeURIComponent(target)}`);
    assert.equal(resolve({ location }, () => 'danfoss'), expected);
  }
});
