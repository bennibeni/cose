import test from 'node:test';
import assert from 'node:assert/strict';
import {assertUniquePhone, normalizePhone} from '../lib/phone.mjs';

const items = [{id:'one',phone:'+39 06 123-4567'}, {id:'two',phone:'333 7654321'}];

test('creation rejects duplicate phones with equivalent formatting', () => {
  for (const phone of ['+39 06 123-4567', '+39 (06) 123 4567', '0039 06 1234567']) {
    assert.throws(() => assertUniquePhone(items, phone), /già presente/);
  }
  assert.doesNotThrow(() => assertUniquePhone(items, '333 1234567'));
});

test('updates allow the same card phone but reject another card phone', () => {
  assert.doesNotThrow(() => assertUniquePhone(items, '0039 (06) 1234567', 'one'));
  assert.throws(() => assertUniquePhone(items, '333-7654321', 'one'), /già presente/);
  assert.doesNotThrow(() => assertUniquePhone(items, '333 1234567', 'one'));
});

test('normalization preserves significant zeros and international country codes', () => {
  assert.equal(normalizePhone('+39 (06) 123-4567'), '39061234567');
  assert.notEqual(normalizePhone('06 1234567'), normalizePhone('6 1234567'));
  assert.notEqual(normalizePhone('+39 3331234567'), normalizePhone('+44 3331234567'));
});
