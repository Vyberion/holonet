import assert from "node:assert/strict";
import test from "node:test";
import exampleConfig from "../config/config.example.js";
import {
  managedRoleIdsFromConfig,
  roleIdsFromRanges,
  roleSyncPlan
} from "./role-rules.js";

const UNLINKED_ROLE_ID = "1340850135680155674";
const RANK_27_ROLE_ID = "1134203963273642114";
const HIGH_RANK_MID_RANGE_ROLE_ID = "1134219075980116059";
const DARK_COUNCIL_RANGE_ROLE_ID = "1046451366488445018";

test("managed role ids include exact-rank and range roles", () => {
  const managed = managedRoleIdsFromConfig(exampleConfig, { unlinkedRoleId: UNLINKED_ROLE_ID });

  assert.ok(managed.includes(RANK_27_ROLE_ID));
  assert.ok(managed.includes(HIGH_RANK_MID_RANGE_ROLE_ID));
  assert.ok(managed.includes(DARK_COUNCIL_RANGE_ROLE_ID));
  assert.ok(!managed.includes("[object Object]"));
});

test("high-rank ranges match all configured roles for rank 27", () => {
  const rangeRoles = roleIdsFromRanges(27, exampleConfig.roles.managed.HIGH_RANKS.ranges);

  assert.deepEqual(rangeRoles, [HIGH_RANK_MID_RANGE_ROLE_ID]);
});

test("unlinked role sync removes both exact-rank and range roles", () => {
  const managed = managedRoleIdsFromConfig(exampleConfig, { unlinkedRoleId: UNLINKED_ROLE_ID });
  const currentRoleIds = [
    RANK_27_ROLE_ID,
    HIGH_RANK_MID_RANGE_ROLE_ID,
    "999999999999999999"
  ];

  const plan = roleSyncPlan({
    currentRoleIds,
    wantedRoleIds: [UNLINKED_ROLE_ID],
    managedRoleIds: managed
  });

  assert.deepEqual(plan.add, [UNLINKED_ROLE_ID]);
  assert.deepEqual(plan.remove, [RANK_27_ROLE_ID, HIGH_RANK_MID_RANGE_ROLE_ID]);
});
