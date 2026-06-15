# Open Domains CLI

A dependency-free Node.js command line client for the Open Domains public API.

## Install locally

```bash
npm install
npm link
```

You can also run it directly:

```bash
node ./bin/opendomains.js --help
```

## Usage

```bash
opendomains auth login
opendomains check mysite is-not-a.dev
opendomains records mysite.is-not-a.dev
opendomains rdap mysite.is-not-a.dev
opendomains request submit mysite is-not-a.dev A 1.2.3.4 --ttl 3600 --reason "Personal project"
opendomains request edit abc123 --content 5.6.7.8 --ttl 3600
```

Authenticated commands use `OPENDOMAINS_API_TOKEN`, `--token`, or the token saved by:

```bash
opendomains auth login
```

The CLI uses the API documented at <https://manage.open-domains.com/api-docs>.
