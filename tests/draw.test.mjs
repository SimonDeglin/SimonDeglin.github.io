import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDraw, validate, forbidden, names } from '../lib/draw.mjs';
test('10 000 tirages uniques respectent toutes les contraintes',()=>{
 for(let i=0;i<10000;i++)assert.ok(validate(makeDraw()),`tirage ${i}`);
});
test('exclusions et attribution obligatoire',()=>{
 assert.equal(forbidden('Olivia','Thomas'),true);
 assert.equal(forbidden('Mimi','Olivia'),true);
 assert.equal(forbidden('Sarah','Simon'),true);
 assert.equal(forbidden('Giovanni','Simon'),false);
 assert.equal(names.length,9);
});
