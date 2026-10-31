# APIGuard Roadmap

Everything below is **planned, not shipped**. Each item says what it adds, why it matters, and which part of the current engine it builds on. Phases are ordered by dependency: each unlocks the next.

## Phase 1: Make it real (target any API)

Closes Known Limitations 1 and 2 in the README.

| Feature | What it does | Builds on |
|---|---|---|
| **Configurable target** | Point the scanner at any allowlisted base URL, login flow, resource name, owner field and create-request body, set in a profile file instead of code. | `engine/auth.py`, `engine/planner.py`, `target/config.py` |
| **Auth profiles** | Bearer, API key, cookie session, OAuth2 client-credentials. Two or more identities per profile, plus an "admin" role for function-level checks. | `engine/auth.py` |
| **Body-based and compound identifiers** | Extract IDs from JSON bodies, headers and nested paths (`/orgs/{org}/projects/{id}`), and treat `(org_id, project_id)` as one key. | `engine/spec.py`, `engine/graph.py` |
| **Analyze a GitHub repository** | Paste a repo link and APIGuard finds the OpenAPI file, or reads the route definitions (FastAPI, Express, Spring, Django) when there is none, builds the resource graph from the code, and flags handlers that fetch an object by ID without an ownership check. The repo is only read, never run. A sandboxed deploy of the repo for live differential testing comes after that. | `engine/spec.py`, `engine/graph.py` |
| **Spec-less discovery** | Build the graph from a HAR file or proxy capture when no OpenAPI file exists. | `engine/spec.py` |

## Phase 2: Detect more than BOLA

| Feature | What it does | Builds on |
|---|---|---|
| **BFLA (OWASP API5)** | Calls admin-only operations as a normal user, using the same Setup -> Control -> Probe pattern. | `engine/planner.py`, `engine/verifier.py` |
| **BOPLA / mass assignment (API3)** | Sends extra writable fields (`owner_id`, `role`, `is_admin`) and checks whether the server accepts them; diffs responses for over-exposed fields. | `engine/verifier.py` |
| **Cross-tenant write and delete checks** | Safe-mode `PATCH`/`DELETE` verification on a disposable record, with automatic cleanup after each probe. | `engine/executor.py` mutation gate |
| **ID-type awareness** | Detect sequential, UUID and hashed IDs and say how guessable each is, so a finding carries a realistic exploitability score. | `engine/inference.py` |

## Phase 3: Smarter graph reasoning

| Feature | What it does | Builds on |
|---|---|---|
| **Probabilistic policy propagation** | Today a rule seen on the main route is applied to every ID-taking route. Replace that with per-edge confidence that decays along the path, so low-confidence routes are tested last and the request budget goes where leaks are most likely. | `engine/inference.py`, `engine/confidence.py` |
| **Request-budget optimiser** | Rank probes by expected information gain; stop early when the remaining routes cannot change the verdict. | `engine/planner.py` |
| **Brute-force baseline** | Add a "test every route with two users" baseline to the benchmark, so the recall and request-count comparison is fair. | `engine/benchmark.py` |
| **Randomised benchmark targets** | Generate many synthetic targets with seeded defects instead of five hand-written variants, and report recall and false-positive rate with confidence intervals. | `benchmarks/manifests/` |

## Phase 4: Developer workflow

| Feature | What it does | Builds on |
|---|---|---|
| **CI/CD gate** | A GitHub Action that runs the scan on every pull request, fails the build on a confirmed finding, and posts a summary comment. | `engine/cli.py` |
| **SARIF export** | Findings appear in GitHub code scanning and IDEs. | `AuditReportModal.tsx`, report code |
| **Regression guard** | Store a scan baseline; on each new run show only findings that are new, fixed, or changed. | `db.py` |
| **Verified auto-fix loop** | Generate the patch, apply it to a sandbox copy, re-run the scan, and only offer the patch if the leak is gone and the tests pass. The re-scan already exists; this automates the loop. | `engine/remediation.py` |
| **Pull-request bot** | Open a PR with the verified patch and the generated pytest file attached. | `engine/remediation.py` |

## Phase 5: Platform

| Feature | What it does | Builds on |
|---|---|---|
| **Multi-user workspaces and scan history** | Teams, projects, scheduled scans, trend charts of findings over time. Move from SQLite to Postgres. | `db.py`, `main.py` |
| **Evidence vault** | Redacted request and response pairs stored per finding, with automatic masking of tokens and personal data. | `executor.py`, `FindingDetail.tsx` |
| **Compliance mapping** | Tag each finding with OWASP API Top 10, CWE and PCI/SOC 2 controls in the report. | report code |
| **Plugin SDK** | Let others add a detector (a verifier plus a planner template) without touching the core. | `engine/` module boundaries |
| **LLM-assisted triage, kept out of the scanner** | Use a model only to explain impact in business terms and suggest a severity. The scanner stays deterministic; the model never decides whether a leak is real. | `engine/remediation.py` |

## Design principles we keep

- **The scanner stays deterministic.** No model call decides what is a finding.
- **Safe by default.** Allowlisted hosts only, mutations off unless toggled, a hard request budget.
- **Honest numbers.** Every benchmark claim names its target, its answer key and its baseline.

## What we plan to ship first

1. Configurable target and auth profiles (Phase 1).
2. BFLA detection (Phase 2).
3. CI/CD gate with SARIF export (Phase 4).

These three turn the prototype into something a team can run against its own API.
