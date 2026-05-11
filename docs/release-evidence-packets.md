# Release Evidence Packet Toolkit

This toolkit generates local-only, redacted release evidence packet summaries for PRs, issues, and manually supplied proof packets.

It does not access production, run deploy commands, call Worker endpoints, run D1 commands, or execute validation commands. It only summarizes evidence that was supplied locally.

## Commands

Generate a Markdown packet from local inputs:

```bash
npm run evidence:packet -- --title "PR 36 release evidence" --repo dooosp/b2b-lead-agent --branch codex/example --head-sha HEAD_SHA --pr-url https://github.com/dooosp/b2b-lead-agent/pull/36 --issue-url https://github.com/dooosp/b2b-lead-agent/issues/34 --validation "npm test|pass|Local test summary"
```

Generate YAML instead of Markdown:

```bash
npm run evidence:packet -- --input tmp/local-evidence-input.json --format yaml
```

Write to a file only when explicitly requested:

```bash
npm run evidence:packet -- --input tmp/local-evidence-input.json --output tmp/release-evidence-packet.md
```

The default output is stdout. The tool does not automatically store generated packets.

## Input Schema

The `--input` file is JSON. All fields are optional, but useful packets should include repo metadata, validation summaries, and any manually supplied proof packets.

```json
{
  "title": "PR release evidence",
  "repo": {
    "name": "dooosp/b2b-lead-agent",
    "branch": "codex/example",
    "headSha": "HEAD_SHA"
  },
  "github": {
    "pullRequestUrl": "https://github.com/dooosp/b2b-lead-agent/pull/36",
    "issueUrl": "https://github.com/dooosp/b2b-lead-agent/issues/34"
  },
  "validations": [
    {
      "command": "npm test",
      "source": "local",
      "status": "pass",
      "summary": "Local test result summary"
    }
  ],
  "manualProofPackets": [
    {
      "title": "Human supplied closeout",
      "source": "Issue comment or local packet",
      "summary": "Redacted summary supplied by the operator"
    }
  ]
}
```

`--validation-json` may be a JSON array of validation objects or an object with a `validations` array.

`--manual-proof` may be repeated. Each file is included under `manualProofPackets`.

## Evidence Boundary Rules

CI is validation evidence only. CI is not production evidence.

Docs, config, workflow files, source files, and package metadata are repo evidence only. They are not production evidence.

D1 config, database binding names, database names, and database IDs are inventory only. They are not production DB proof and not production observation.

Screenshots, UI captures, image-only artifacts, and log snippets are supplemental context only. Screenshots alone are insufficient for production proof.

Manual proof packets are summarized as operator-supplied inputs. The toolkit does not independently observe production from those packets.

If an input claims production observation, the generated packet is marked `HOLD` and the packet keeps `productionObservationClaimed: false`. Production observation claims require separate human-approved evidence review outside this local-only tool.

## Redaction Coverage

The redaction helper removes or masks:

- database IDs when supplied in D1/database ID fields or matching `D1_DATABASE_ID=...` text
- tokens, API keys, callback tokens, passwords, JWT-like values, and common provider token prefixes
- `Authorization` and `Proxy-Authorization` headers
- cookie and set-cookie headers
- private URLs, including localhost, private IP ranges, internal/private hostnames, URL credentials, and URLs with secret-bearing query parameters
- PII-like email, phone, contact, customer, owner, approver, observer, actor, and author fields

Redaction is defense-in-depth, not a license to paste raw secrets or production payloads into packet inputs. Operators should supply already-minimized summaries whenever possible.

## Output Shape

Markdown packets include:

- `STATUS`: `SHIP`, `HOLD`, or `FOLLOW_UP`
- `MODE`: `RELEASE_TOOLING`
- source boundary statements
- local validation summaries
- manually supplied proof packet summaries
- a redacted YAML block

YAML packets include the same machine-readable fields:

- `packetType: release_evidence_packet`
- `packetVersion: "1"`
- `sourceBoundary.localOnly: true`
- dangerous production action flags set to `false`
- invalid production evidence categories
- redacted validations and manual proof packet summaries
- warnings when inputs cross evidence boundaries
