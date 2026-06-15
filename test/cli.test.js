import assert from "node:assert/strict";
import test from "node:test";

import { buildEditPayload, buildSubmitPayload, parseArgv } from "../src/cli.js";

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
