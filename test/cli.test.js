import assert from "node:assert/strict";
import test from "node:test";

import { buildEditPayload, buildSubmitPayload, formatOutput, parseArgv } from "../src/cli.js";

test("parseArgv reads commands and flags", () => {
  assert.deepEqual(parseArgv(["request", "submit", "site", "--ttl", "300", "--proxied=false"]), {
    command: "request",
    args: ["submit", "site"],
    flags: { ttl: 300, proxied: false },
    help: undefined
  });
});

test("buildSubmitPayload supports positional arguments", () => {
  assert.deepEqual(
    buildSubmitPayload(["mysite", "is-a.dev", "A", "1.2.3.4"], { ttl: 300, reason: "Demo" }),
    {
      action: "submit",
      subdomain: "mysite",
      root_domain: "is-a.dev",
      record_type: "A",
      record_value: "1.2.3.4",
      ttl: 300,
      reason: "Demo"
    }
  );
});

test("buildEditPayload maps flags to API fields", () => {
  assert.deepEqual(buildEditPayload(["abc123"], { content: "5.6.7.8", ttl: 3600, proxied: false }), {
    action: "update",
    dns_record_id: "abc123",
    new_content: "5.6.7.8",
    new_ttl: 3600,
    new_proxied: false
  });
});

test("formatOutput prints me responses", () => {
  const lines = [];
  const originalLog = console.log;
  console.log = value => lines.push(value);

  try {
    formatOutput({
      id: "usr_abc123",
      email: "user@example.com",
      display_name: "Alex Smith",
      role: "user",
      ns_unlocked: false,
      stats: {
        active_records: 3,
        total_records: 4,
        total_requests: 7,
        pending_requests: 1,
        active_api_tokens: 2
      }
    });
  } finally {
    console.log = originalLog;
  }

  assert.deepEqual(lines, [
    "Alex Smith",
    "Email: user@example.com",
    "Role: user",
    "ID: usr_abc123",
    "NS unlocked: no",
    "",
    "Stats",
    "  Active records: 3",
    "  Total records: 4",
    "  Total requests: 7",
    "  Pending requests: 1",
    "  Active API tokens: 2"
  ]);
});
