import { test } from "node:test";
import assert from "node:assert/strict";
import { DP_CORE_VERSION } from "../src/index.ts";

test("dp-core entry loads", () => {
  assert.equal(typeof DP_CORE_VERSION, "string");
});
