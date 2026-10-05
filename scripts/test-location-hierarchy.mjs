import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { pointInOpenMarkets } from "../dist/modules/masters/locationHierarchy.repository.js";

const polygon = "POLYGON((0 0, 4 0, 4 4, 0 4, 0 0))";
const market = (isOpen, children = []) => ({ isOpen, polygonDescription: polygon, children });

test("existing coverage without child markets remains eligible", () => assert.equal(pointInOpenMarkets([], 2, 2), true));
test("open micro market allows covered points", () => assert.equal(pointInOpenMarkets([market(true)], 2, 2), true));
test("closed micro market rejects covered points", () => assert.equal(pointInOpenMarkets([market(false)], 2, 2), false));
test("points outside configured markets are rejected", () => assert.equal(pointInOpenMarkets([market(true)], 9, 9), false));
test("closed nano market overrides an open micro market", () => assert.equal(pointInOpenMarkets([market(true, [market(false)])], 2, 2), false));
test("open nano market allows covered points", () => assert.equal(pointInOpenMarkets([market(true, [market(true)])], 2, 2), true));
test("closed micro market overrides an open nano market", () => assert.equal(pointInOpenMarkets([market(false, [market(true)])], 2, 2), false));
test("overlapping closed markets cannot be bypassed by an open market", () => assert.equal(pointInOpenMarkets([market(true), market(false)], 2, 2), false));
