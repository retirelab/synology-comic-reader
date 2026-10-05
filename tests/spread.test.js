import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shouldSplit,physicalSide,nextPosition,imageGeometry} from '../public/spread.js';
test('portrait auto splits wide scans but not single pages or landscape view',()=>{
 assert.equal(shouldSplit(1400,1000,true),true);assert.equal(shouldSplit(700,1000,true),false);
 assert.equal(shouldSplit(1400,1000,false),false);assert.equal(shouldSplit(1400,1000,true,'off'),false);
 assert.equal(shouldSplit(700,1000,true,'on'),true);
});
test('reading direction maps first and second halves to physical sides',()=>{
 assert.equal(physicalSide(0,false),'left');assert.equal(physicalSide(1,false),'right');
 assert.equal(physicalSide(0,true),'right');assert.equal(physicalSide(1,true),'left');
});
test('navigation reads both halves, previous lands on last half, and boundaries are safe',()=>{
 assert.deepEqual(nextPosition(0,0,1,true,2),{page:0,half:1});
 assert.deepEqual(nextPosition(0,1,1,true,2),{page:1,half:0});
 assert.deepEqual(nextPosition(1,0,-1,true,2),{page:0,half:'last'});
 assert.deepEqual(nextPosition(1,1,-1,true,2),{page:1,half:0});
 assert.equal(nextPosition(0,0,-1,true,2),null);assert.equal(nextPosition(1,1,1,true,2),null);
 assert.deepEqual(nextPosition(0,0,1,false,2),{page:1,half:0});
});
test('full-height crops meet at exact center, including odd widths',()=>{
 const left=imageGeometry(1401,1000,390,600,'left'),right=imageGeometry(1401,1000,390,600,'right');
 assert.equal(left.frameHeight,600);assert.equal(right.frameHeight,600);
 assert.equal(right.left,-left.frameWidth);assert.ok(Math.abs(left.frameWidth+right.frameWidth-left.imageWidth)<1e-9);
 const single=imageGeometry(700,1000,390,600,null,false);assert.equal(single.frameWidth,390);
});
