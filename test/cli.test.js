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

test("formatOutput prints whois responses", () => {
  const lines = [];
  const originalLog = console.log;
  console.log = value => lines.push(value);

  try {
    formatOutput({
      subdomain: "mysite.is-a.dev",
      owner_email: "user@example.com",
      owner_id: "usr_abc123",
      record_type: "A",
      content: "1.2.3.4",
      ttl: 3600,
      proxied: false,
      status: "active",
      managed: true,
      created: "2025-03-01T10:00:00Z",
      last_synced: "2025-06-15T08:00:00Z",
      dns_verified: true,
      request_history: [
        {
          id: "req_abc",
          status: "approved",
          submitted: "2025-03-01T09:00:00Z",
          reviewed_by: "admin@example.com",
          reviewed_at: "2025-03-01T10:00:00Z"
        }
      ]
    });
  } finally {
    console.log = originalLog;
  }

  assert.deepEqual(lines, [
    "mysite.is-a.dev",
    "Owner email: user@example.com",
    "Owner ID: usr_abc123",
    "Status: active",
    "Record type: A",
    "Content: 1.2.3.4",
    "TTL: 3600",
    "Proxied: no",
    "Managed: yes",
    "DNS verified: yes",
    "Created: 2025-03-01T10:00:00Z",
    "Last synced: 2025-06-15T08:00:00Z",
    "",
    "Request history",
    "  req_abc: approved submitted 2025-03-01T09:00:00Z by admin@example.com at 2025-03-01T10:00:00Z"
  ]);
});
