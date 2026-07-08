import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const API_BASE_URL = process.env.OPENDOMAINS_API_URL || "https://api.open-domains.net";
const DEVICE_AUTH_URL = `${API_BASE_URL}/deviceAuth`;

export function parseArgv(argv) {
  const flags = {};
  const args = [];

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];

    if (item === "--") {
      args.push(...argv.slice(index + 1));
      break;
    }

    if (item.startsWith("--")) {
      const [rawKey, rawValue] = item.slice(2).split("=", 2);
      const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

      if (rawValue !== undefined) {
        flags[key] = coerceFlagValue(rawValue);
      } else if (argv[index + 1] && !argv[index + 1].startsWith("-")) {
        flags[key] = coerceFlagValue(argv[index + 1]);
        index += 1;
      } else {
        flags[key] = true;
      }
      continue;
    }

    if (item.startsWith("-") && item.length > 1) {
      const shortFlags = item.slice(1).split("");
      for (const shortFlag of shortFlags) {
        if (shortFlag === "h") flags.help = true;
        else if (shortFlag === "j") flags.json = true;
        else flags[shortFlag] = true;
      }
      continue;
    }

    args.push(item);
  }

  return {
    command: args.shift(),
    args,
    flags,
    help: flags.help
  };
}

function coerceFlagValue(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  return value;
}

export function configPath() {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config");
  return path.join(configHome, "opendomains", "config.json");
}

export async function readToken() {
  if (process.env.OPENDOMAINS_API_TOKEN) return process.env.OPENDOMAINS_API_TOKEN;

  try {
    const raw = await readFile(configPath(), "utf8");
    return JSON.parse(raw).token || null;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function saveToken(token) {
  if (!/^od_[A-Za-z0-9_-]+/.test(token)) {
    throw new Error("That does not look like an Open Domains API token.");
  }

  const file = configPath();
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, `${JSON.stringify({ token }, null, 2)}\n`, { mode: 0o600 });
}

export async function unlinkConfig() {
  try {
    await unlink(configPath());
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

export async function request(endpoint, options = {}) {
  const url = new URL(endpoint, API_BASE_URL);
  for (const [key, value] of Object.entries(options.query || {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  const data = text ? parseJson(text) : {};

  if (!response.ok) {
    throw new Error(data.error || data.message || `${response.status} ${response.statusText}`);
  }

  return data;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function runDeviceLogin({ tokenName, pollIntervalMs, timeoutSeconds }) {
  const codeResponse = await request("/deviceAuth", {
    method: "POST",
    body: { action: "request_code", token_name: tokenName }
  });

  if (!codeResponse.device_code || !codeResponse.user_code) {
    throw new Error("Device auth did not return a device code.");
  }

  console.log("Open this URL and approve the device code:");
  console.log(codeResponse.verification_uri || "https://manage.open-domains.com/activate");
  console.log("");
  console.log(`Code: ${codeResponse.user_code}`);
  console.log("");
  console.log("Waiting for approval...");

  const expiresAt = Date.now() + Math.min(timeoutSeconds, codeResponse.expires_in || timeoutSeconds) * 1000;

  while (Date.now() < expiresAt) {
    await sleep(pollIntervalMs);
    const pollResponse = await request("/deviceAuth", {
      method: "POST",
      body: { action: "poll", device_code: codeResponse.device_code }
    });

    if (pollResponse.status === "approved" && pollResponse.api_key) return pollResponse.api_key;
    if (pollResponse.status === "denied") throw new Error("Device login was denied.");
    if (pollResponse.status === "expired") throw new Error("Device code expired.");
    if (pollResponse.status && pollResponse.status !== "pending") {
      throw new Error(`Unexpected device login status: ${pollResponse.status}`);
    }
  }

  throw new Error("Timed out waiting for device approval.");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function buildSubmitPayload(args, flags) {
  const [subdomain, rootDomain, recordType, recordValue] = args;
  const payload = {
    action: "submit",
    subdomain: flags.subdomain || subdomain,
    root_domain: flags.rootDomain || flags.root || rootDomain,
    record_type: flags.type || flags.recordType || recordType,
    record_value: flags.value || flags.recordValue || recordValue
  };

  if (!payload.subdomain || !payload.root_domain || !payload.record_type || !payload.record_value) {
    throw new Error("Usage: opendomains request submit <subdomain> <root-domain> <record-type> <record-value> [--ttl 3600] [--proxied false] [--reason text]");
  }

  if (flags.ttl !== undefined) payload.ttl = Number(flags.ttl);
  if (flags.proxied !== undefined) payload.proxied = Boolean(flags.proxied);
  if (flags.reason) payload.reason = flags.reason;

  return payload;
}

export function buildEditPayload(args, flags) {
  const [dnsRecordId] = args;
  const payload = {
    action: "update",
    dns_record_id: flags.id || flags.dnsRecordId || dnsRecordId
  };

  if (!payload.dns_record_id) {
    throw new Error("Usage: opendomains request edit <dns-record-id> [--content value] [--ttl 3600] [--proxied false] [--reason text]");
  }

  if (flags.content !== undefined) payload.new_content = flags.content;
  if (flags.newContent !== undefined) payload.new_content = flags.newContent;
  if (flags.ttl !== undefined) payload.new_ttl = Number(flags.ttl);
  if (flags.proxied !== undefined) payload.new_proxied = Boolean(flags.proxied);
  if (flags.reason) payload.reason = flags.reason;

  return payload;
}

export function formatOutput(data, flags = {}) {
  if (flags.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (Array.isArray(data.records)) {
    printRecords(data.records);
    return;
  }

  if (data.email && data.stats) {
    printMe(data);
    return;
  }

  if (data.status && data.message) {
    console.log(`${data.status}: ${data.message}`);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

function printRecords(records) {
  if (records.length === 0) {
    console.log("No records found.");
    return;
  }

  const rows = records.map(record => ({
    name: record.name || "",
    type: record.type || "",
    content: record.content || "",
    ttl: record.ttl ?? "",
    proxied: record.proxied ?? ""
  }));

  const columns = ["name", "type", "content", "ttl", "proxied"];
  const widths = Object.fromEntries(columns.map(column => [
    column,
    Math.max(column.length, ...rows.map(row => String(row[column]).length))
  ]));

  console.log(columns.map(column => column.padEnd(widths[column])).join("  "));
  console.log(columns.map(column => "-".repeat(widths[column])).join("  "));

  for (const row of rows) {
    console.log(columns.map(column => String(row[column]).padEnd(widths[column])).join("  "));
  }
}

function printMe(user) {
  const displayName = user.display_name || user.full_name || user.email;

  console.log(displayName);
  console.log(`Email: ${user.email}`);
  if (user.role) console.log(`Role: ${user.role}`);
  if (user.id) console.log(`ID: ${user.id}`);
  if (user.joined) console.log(`Joined: ${user.joined}`);
  console.log(`NS unlocked: ${user.ns_unlocked ? "yes" : "no"}`);

  const stats = user.stats || {};
  const statRows = [
    ["Active records", stats.active_records],
    ["Total records", stats.total_records],
    ["Total requests", stats.total_requests],
    ["Pending requests", stats.pending_requests],
    ["Active API tokens", stats.active_api_tokens]
  ].filter(([, value]) => value !== undefined && value !== null);

  if (statRows.length) {
    console.log("");
    console.log("Stats");
    for (const [label, value] of statRows) {
      console.log(`  ${label}: ${value}`);
    }
  }
}

export function printHelp(command) {
  console.log(commandHelp(command));
}

export function commandHelp(command) {
  if (command === "auth") {
    return `Open Domains authentication

Usage:
  opendomains auth login [--name "My CLI Tool"]
  opendomains auth token set <token>
  opendomains auth token show
  opendomains auth logout`;
  }

  if (command === "request") {
    return `Open Domains requests

Usage:
  opendomains request submit <subdomain> <root-domain> <record-type> <record-value> [--ttl 3600] [--proxied false] [--reason text]
  opendomains request edit <dns-record-id> [--content value] [--ttl 3600] [--proxied false] [--reason text]`;
  }

  return `Open Domains CLI

Usage:
  opendomains auth login
  opendomains me
  opendomains check <subdomain> <root-domain>
  opendomains rdap <domain>
  opendomains records <domain>
  opendomains request submit <subdomain> <root-domain> <record-type> <record-value>
  opendomains request edit <dns-record-id> [--content value]

Options:
  --json             Print raw JSON
  --token <token>    Use a token for this request
  -h, --help         Show help

Environment:
  OPENDOMAINS_API_TOKEN  API token for authenticated requests
  OPENDOMAINS_API_URL    Override API base URL, defaults to ${API_BASE_URL}`;
}
