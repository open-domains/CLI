#!/usr/bin/env node

import {
  buildEditPayload,
  buildSubmitPayload,
  commandHelp,
  configPath,
  formatOutput,
  parseArgv,
  printHelp,
  readToken,
  request,
  runDeviceLogin,
  saveToken,
  unlinkConfig
} from "../src/cli.js";

async function main() {
  const parsed = parseArgv(process.argv.slice(2));
  const { command, args, flags } = parsed;

  if (flags.version) {
    console.log("opendomains 0.1.0");
    return;
  }

  if (parsed.help || !parsed.command) {
    printHelp(parsed.command);
    return;
  }

  switch (command) {
    case "auth": {
      const subcommand = args[0];
      if (subcommand === "login") {
        const token = await runDeviceLogin({
          tokenName: flags.name || "OpenDomains CLI",
          pollIntervalMs: Number(flags.interval || 2000),
          timeoutSeconds: Number(flags.timeout || 600)
        });
        await saveToken(token);
        console.log(`Saved API token to ${configPath()}`);
        return;
      }

      if (subcommand === "token") {
        if (args[1] === "set") {
          const token = args[2] || flags.token;
          if (!token) throw new Error("Usage: opendomains auth token set <token>");
          await saveToken(token);
          console.log(`Saved API token to ${configPath()}`);
          return;
        }

        if (args[1] === "show") {
          const token = await readToken();
          if (!token) throw new Error("No token configured. Run `opendomains auth login`.");
          console.log(token);
          return;
        }
      }

      if (subcommand === "logout") {
        await unlinkConfig();
        console.log("Removed saved Open Domains credentials.");
        return;
      }

      console.log(commandHelp("auth"));
      return;
    }

    case "check": {
      const subdomain = args[0] || flags.subdomain;
      const domain = args[1] || flags.domain || flags.rootDomain || flags.root;
      if (!subdomain || !domain) throw new Error("Usage: opendomains check <subdomain> <root-domain>");
      const data = await request("/", { query: { action: "check", subdomain, domain } });
      formatOutput(data, flags);
      return;
    }

    case "rdap": {
      const domain = args[0] || flags.domain;
      if (!domain) throw new Error("Usage: opendomains rdap <domain>");
      const data = await request("/", { query: { action: "rdap", domain } });
      formatOutput(data, flags);
      return;
    }

    case "records": {
      const domain = args[0] || flags.domain;
      if (!domain) throw new Error("Usage: opendomains records <domain>");
      const data = await request("/", { query: { action: "records", domain } });
      formatOutput(data, flags);
      return;
    }

    case "request": {
      const subcommand = args[0];
      if (subcommand !== "submit" && subcommand !== "edit") {
        console.log(commandHelp("request"));
        return;
      }

      const token = flags.token || await readToken();
      if (!token) throw new Error("No token configured. Run `opendomains auth login` or set OPENDOMAINS_API_TOKEN.");

      if (subcommand === "submit") {
        const data = await request("/", {
          method: "POST",
          token,
          body: buildSubmitPayload(args.slice(1), flags)
        });
        formatOutput(data, flags);
        return;
      }

      if (subcommand === "edit") {
        const data = await request("/", {
          method: "POST",
          token,
          body: buildEditPayload(args.slice(1), flags)
        });
        formatOutput(data, flags);
        return;
      }

      return;
    }

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch(error => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
