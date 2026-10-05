import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clampPage,read,write} from '../public/storage.js';
test('invalid or old progress cannot navigate outside a book',()=>{
  assert.equal(clampPage(300,10),9);assert.equal(clampPage(-3,10),0);assert.equal(clampPage('broken',10),0);assert.equal(clampPage(2.5,10),2);
});
test('blocked browser storage does not prevent reading',()=>{
  globalThis.localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.equal(read('page',4),4);assert.doesNotThrow(()=>write('page',5));
});
