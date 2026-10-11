import assert from 'node:assert/strict';
import { navigationProgress } from '../public/navigation-progress.js';
const path = [[77.205,28.625],[77.205,28.626],[77.207,28.626]];
const steps = [{ instruction:'Head north', location:{longitude:77.205,latitude:28.625} },
  { instruction:'Turn right', maneuver:'turn-right', location:{longitude:77.205,latitude:28.626} }];
const first = navigationProgress(path,path[0],steps,8);
const moving = navigationProgress(path,[77.205,28.6255],steps,8);
assert.equal(first.step.instruction,'Turn right');
assert.ok(moving.turnDistance < first.turnDistance);
assert.ok(moving.remaining < first.remaining);
assert.equal(navigationProgress(path,[77.22,28.64],steps,8).offRoute,true);
assert.ok(navigationProgress(path,path.at(-1),steps,8).remaining < 1);
assert.equal(navigationProgress([],path[0],steps),null);
console.log('Navigation: upcoming turns, progress, remaining distance, off-route and arrival passed');
