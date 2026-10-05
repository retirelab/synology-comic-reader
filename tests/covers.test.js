import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coverUrl} from '../public/covers.js';
test('cover API distinguishes artwork folders from volume archives and escapes names',()=>{
 const path='만화/작품 & 01.zip';
 const zip=new URL(coverUrl({path,folder:false,cover:true}),'https://example.test/');
 assert.equal(zip.searchParams.get('action'),'cover');assert.equal(zip.searchParams.get('path'),path);
 const folder=new URL(coverUrl({path:'만화/작품',folder:true,cover:true}),'https://example.test/');
 assert.equal(folder.searchParams.get('action'),'folder-cover');
 assert.equal(coverUrl({path:'empty',folder:true,cover:false}),null);
});
