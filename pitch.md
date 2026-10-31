# APIGuard: Hackathon Pitch

> **One line:** APIGuard finds the API bugs that return `200 OK`, by learning who is allowed to see what on one endpoint and testing every related endpoint against that rule.

---

## 1. The 30-second pitch

The number one API vulnerability in the OWASP Top 10 is **BOLA** (Broken Object Level Authorization, also called IDOR). It doesn't crash anything. It doesn't throw a 500. It returns **HTTP 200 OK** with someone else's data.

Most scanners test endpoints one at a time. They send a request, see a 401 or 403, and call the API secure. But real APIs are connected. `GET /projects/{id}` can be locked down perfectly while `GET /projects/{id}/export` is wide open, because a different developer wrote it on a different day.

**APIGuard reads your OpenAPI spec and builds a dependency graph of your API.** It logs in as two users, creates real data as the owner, and checks that the attacker is blocked. When the attacker is blocked on one route, APIGuard carries that rule along the graph to every related route and tests those too. A finding is only confirmed when **the owner's private values show up in the attacker's response**, not just because of a status code.

Then it explains the fix. A language model writes the patch and a test, but **only after** the deterministic scanner has proven the bug.

---

## 2. The 3-minute pitch (spoken script)

**Hook (15 s)**
"Raise your hand if your API has authentication. Now keep it up if you're sure user A can't read user B's data. BOLA is the most common API vulnerability in the world, and your login system doesn't prevent it. Authentication asks *who are you*. BOLA is about *are you allowed to see this one record*."

**Problem (30 s)**
"Scanners test endpoints in isolation. They get a 403 on the main route and move on. They never ask: if this route is protected, why isn't the *export* route? Developers write the protected route and forget its siblings. The bug returns 200, so no alert fires, no log looks wrong, and it sits there until someone dumps your database one ID at a time."

**Solution (45 s)**
"APIGuard turns your OpenAPI spec into a graph. `POST /projects` *produces* a project ID. `GET /projects/{id}` *consumes* it. `/export` and `/summary` are *nested under* it. We log in as an owner and create real data. Then we log in as an attacker and try to read it. If the main route blocks the attacker, we learn a rule, *owner only*, and carry it along the graph to the nested routes as a hypothesis. Then we test each hypothesis with real requests."

**Proof (45 s)**
"We decide a bug is real by comparing responses, not status codes. We take the owner's private fields, like email and billing details, and check whether they appear in the attacker's response. We also built traps. One route returns 200 with an empty body, and one returns 404. A naive scanner would flag both. We don't. In our benchmark, the graph scanner found **6 of 6** seeded bugs. A one-route-at-a-time baseline found **4 of 6**. It missed the indirect export bug every time. On the fully patched target we reported **zero false positives**."

**Close (30 s)**
"Once a bug is proven, we hand its context to a model for a patch and a pytest test. The detection never touches an LLM. It's deterministic and reproducible, so you can trust the finding and use AI only where it's useful. One click exports an audit report with repro cURL commands. We found the bug that sits next to the one you already fixed."

---

## 3. Demo script (follow this live)

1. **Open the app.** "This is the demo target's OpenAPI spec turned into a graph. Login and create-project at the top, the ID they produce, the routes that use it, and the nested routes below."
2. **Click BEGIN AUDIT.** Point at the event stream. "Phase A: we log in as Aman and Taaran and create real data as Aman. Phase B: we test whether Taaran can reach it."
3. **Show the graph changing.** "`GET /projects/{id}` goes SAFE. It correctly blocks Taaran. Now the rule is carried to the siblings. `/export` turns red: LEAK."
4. **Click the finding.** Show the side-by-side. "Left is the owner's response. Right is the attacker's. Same data. The leaked fields are highlighted. Here's the cURL to reproduce it."
5. **Point out `/summary`.** "This returns 200 too, but with an empty body. We mark it as not leaking. That's the trap."
6. **Click AI Remediation.** "Now the model writes the fix and a test, and we show a naive prompt next to the graph-informed prompt."
7. **Apply the reference fix and re-scan.** "Patched target, re-scan, zero findings."
8. **Open the benchmark.** "This is the proof, measured against ground-truth manifests the scanner never sees."
9. **Export report.** "One click, ready for a security review."

**Backup if the backend dies:** the screenshots in `docs/screenshots/` follow the same flow.

---

## 4. Why this is different (the differentiators)

| Typical scanner | APIGuard |
|---|---|
| Tests each endpoint on its own | Builds a producer/consumer graph from the spec |
| Fuzzes with made-up IDs | Creates real resources as User A and uses the real IDs |
| Judges by status code | Judges by whether the owner's private values leak |
| Needs hand-written rules for every route | Learns a rule from one route and carries it along the graph |
| Fires on 200 with empty bodies | Rejects them with verifier traps |
| LLM-generated findings (hard to trust) | Deterministic detection, LLM only for the fix |

---

## 5. Tech stack (and what each piece does)

- **Backend:** Python 3.12, FastAPI, Pydantic v2, `httpx`, `aiosqlite` (SQLite in WAL mode), `openapi-spec-validator`, `pytest`.
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, `@xyflow/react` (React Flow) for the graph, `dagre` for layout, `lucide-react` for icons.
- **Streaming:** Server-Sent Events, so the UI shows each request as it happens.
- **AI (remediation only):** OpenRouter or Gemini, whichever key is configured. It falls back to a cached real result, then to a clearly labelled offline template.

**Engine modules** (`backend/app/engine/`):

| File | Job |
|---|---|
| `spec.py` | Parses and validates OpenAPI 3.x, resolves `$ref`s, extracts operations |
| `graph.py` | Builds the resource graph: operation, identifier and resource nodes, with `PRODUCES`, `CONSUMES`, `NESTED_UNDER` and `OPERATES_ON` edges |
| `inference.py` | Learns an `owner_only` rule from a control observation and propagates it to adjacent operations as a candidate |
| `scanner.py` | Orchestrates harvest, control, probe and verify |
| `verifier.py` | Differential check on response bodies |
| `executor.py` | The only module that sends HTTP: host allowlist, request budget, redaction, response size cap |
| `baseline.py` / `benchmark.py` | The comparison scanner and the benchmark runner |
| `remediation.py` | LLM patch and test generation with fallbacks |

---

## 6. Judge Q&A

### A. "Why does this need to exist?" (the value questions)

**Q: Why would anyone need this? If I use JWT auth, isn't my API secure?**
JWT answers *who is calling*. It says nothing about *which records that caller may touch*. BOLA happens after authentication succeeds. User B has a perfectly valid token and asks for `/projects/123`, which belongs to User A. If the handler forgets to check `project.owner_id == caller.id`, it returns the data. Every attack in our demo uses a valid, correctly signed token.

**Q: Can't I just add an ownership check to every endpoint?**
You can, and you should. The problem is that you have to remember to do it on every route, forever, across every developer and every release. APIGuard is the test that catches the one you forgot. Think of it as a regression test for authorization.

**Q: How is this different from OWASP ZAP, Burp Suite or Postman tests?**
Those tools are general-purpose and mostly stateless. They don't know which ID belongs to which user, and they don't relate one route to another. ZAP's active scan won't create a resource as one user and replay it as another. Burp has manual extensions such as Autorize, but a human has to drive them. APIGuard automates that two-identity workflow and uses the graph to decide *what to test next*. We're not claiming to replace them. We're claiming to cover a gap they leave open.

**Q: What does "graph-guided" actually buy me over just testing every endpoint with two users?**
Testing every endpoint with two users is a reasonable baseline, and it's the baseline we compare against. The graph adds three things. It decides which IDs to reuse, since a child route needs its parent's real ID. It decides the test order, since setup comes before probes and deletes come last. And it lets us propose which routes are likely to share a rule, so we focus requests. At our scale (11 operations) a brute-force scanner works fine. The value grows as APIs grow to hundreds of routes and request budgets matter. We have not benchmarked at that scale. That's future work.

**Q: Who is the customer?**
API teams and security engineers who ship FastAPI/REST services with an OpenAPI spec. The first use case is a CI step: "fail the build if a new route lets another tenant read data." The second is a pre-pentest sweep for consultants.

**Q: Is there a market for this?** (If asked about competitors)
Yes, and it's crowded at the edges: API security platforms (Salt, Noname/Akamai, 42Crunch) and DAST tools. Most focus on traffic monitoring or schema conformance. Authorization logic testing is the hard, under-served part. Our angle is an open-source, auditable, deterministic engine you can run locally.

---

### B. "Did AI just build this?" (the AI questions)

**Q: Did you use AI? If so, why is this something anyone can make?**
Be straight about it: yes, we used AI coding assistance to build faster, the same way people use IDEs and Stack Overflow. What an assistant can't hand you is the idea and the verification. The idea is the part we'd defend. Detecting BOLA from a *response differential* rather than a status code, carrying a learned rule along a resource graph, designing traps that expose false positives, and measuring against ground truth the scanner never sees: those are design decisions we made and can explain line by line. Ask us about any file.

**Q: Is the scanner itself powered by an LLM?**
No. The scanner makes **zero** LLM calls. Graph building, rule inference, test planning and verification are deterministic code. The same input gives the same output, which matters for a security tool. The LLM is only used afterwards, to write the patch and test for a finding that is already proven.

**Q: If the scanner isn't AI, why is the project pitched with AI?**
It isn't, and we don't pitch it that way. AI is one optional feature, remediation. We kept it out of detection on purpose, because a hallucinated finding in a security tool is worse than no finding.

**Q: How do you know the AI-generated patch is correct?**
We don't claim it is. The patch is a suggestion. The verified path is the reference fix on the demo target, which we apply and re-scan to prove the leak is gone. A model-generated patch is not auto-applied. If no API key is configured, the UI shows a clearly labelled offline template, not a fake model response.

**Q: What stops an LLM from leaking the owner's data?**
Only the finding metadata (endpoint, method, resource type, leaked field names) goes into the prompt. Response bodies and tokens are not sent. Header values are redacted in the executor.

---

### C. "How did you build it?" (the technical questions)

**Q: What did you use to implement the graph?**
A custom `ResourceGraph` class in Python, not a graph library. It holds typed nodes (operation, resource type, identifier) and typed edges (`PRODUCES`, `CONSUMES`, `NESTED_UNDER`, `OPERATES_ON`) with a confidence score and provenance (`schema`, `propagated`). A breadth-first search computes the real path between two operations, shown in each finding. On the frontend, `@xyflow/react` draws it and `dagre` computes the layout.

**Q: Is it really a DAG?**
It is acyclic for the producer to consumer relationships the scanner uses. Our edges go identifier to operation, parent to nested operation and operation to resource, so there are no cycles in the demo spec. We don't currently enforce acyclicity or detect cycles on arbitrary specs. We'd add that before real-world use.

**Q: How do you find the producer and consumer relationships?**
From the spec. A `POST` on a collection with no path parameters (like `POST /projects`) is a producer. The `project_id` path parameter on `GET /projects/{project_id}` is matched to it by name. Nested routes are found by path prefix, so `/projects/{id}/export` sits under `/projects/{id}`. It's heuristic name matching, and we label those edges' provenance accordingly.

**Q: How does rule propagation work?**
1. Create a project as Aman, read it as Aman: 200 (the control).
2. Read it as Taaran: 403.
3. Owner allowed and non-owner denied gives a validated `owner_only` hypothesis with confidence from the evidence.
4. Copy that rule as a *candidate* to adjacent operations, with lower confidence because it's inferred, not observed.
5. Test each candidate with real requests. A candidate only becomes a finding if the verifier confirms a leak.

**Q: How does the verifier decide there's a leak?**
It extracts the owner's sensitive values from the control response (any non-empty scalar under keys like `owner`, `email`, `billing`, `card`, `token`, `budget`, `secret`). It then checks whether those exact values appear in the attacker's response body. Match means confirmed. If the attacker gets a 200 but no match, we downgrade it to "likely." If the body is empty, it's only "potential." If the owner's control request failed, it's "inconclusive," not a finding.

**Q: What are the verifier traps?**
`/summary` returns 200 with `{}` to non-owners, so it's a false positive for status-code scanners. `/audit-log` returns 404 to non-owners, so it must not be flagged. Both are in the demo target and in the secure benchmark variant.

**Q: How do you keep the scanner from damaging a real system?**
All traffic goes through one module, `SafeExecutor`. It enforces a host allowlist (loopback only by default), a total and per-endpoint request budget, a response size cap, secret redaction in logs and events, and a mutation gate: `PATCH` and `DELETE` are refused unless explicitly enabled. Deletes run last, on a throwaway resource.

**Q: How did you measure the benchmark? Isn't it rigged since you built the target?**
It's a fair criticism and we'd rather say it first. The target is ours, with five variants (direct bug, indirect export bug, mutation bug, all three, fully patched). Ground truth lives in manifest files the scanner never reads. The numbers: graph scanner 6/6 true positives, baseline 4/6, 0 false positives on the patched variant. The honest caveat is that the baseline is a *rules-given* scanner with no rule for `/export`, which is the exact situation the graph is designed to fix. The oracle ablation shows that if a human hand-writes a rule for every route, the baseline matches us. Our claim isn't "we beat humans who write every rule." It's "we remove the need to write them." The numbers are measured live and written to `benchmarks/results.json`.

**Q: What's the ablation study?**
We ran the graph scanner with propagation turned off. It missed the indirect bug, so the propagation step is what finds it. We also ran an oracle baseline with a hand-written rule for every route, and it matched us. Together those show the contribution is *automating* rule discovery.

**Q: Does it work on any API?**
Not yet, and we want to be upfront. Today:
- The scanner targets the bundled demo API only. The target URL is hardcoded.
- Some parts are tuned to it: the resource-create body, the resource type name `Project`, and the `owner_id` field.
- Importing your own spec changes which operations are planned, but they still run against the demo target.

Making the target URL, auth flow and create-body configurable is the main next step.

**Q: Why FastAPI / React / SQLite?**
FastAPI gives typed models, async I/O and a free OpenAPI spec, and it's what a lot of the target audience uses. React Flow is the best fit for an interactive graph. SQLite keeps it zero-setup for a local security tool. These are all choices for speed and a clean demo, not claims about scale.

**Q: How does streaming work?**
The scanner pushes events into an `asyncio.Queue`, and an SSE endpoint streams them to the browser. The UI maps each event to a node state (probing, safe, leak) in real time.

**Q: What happens when something goes wrong mid-scan?**
The backend sends an error event and a completion event, so the UI always stops cleanly. Request budgets cap the damage of a runaway scan.

---

### D. "What are the weaknesses?" (the hard questions)

**Q: What does it miss?**
- Authorization bugs that depend on business rules beyond ownership (roles, teams, sharing, time windows).
- IDs that aren't in path parameters (body, query, headers). The README lists this as a known limitation.
- Routes where the owner can't be tested because creation needs complex setup data.
- Sensitive data in fields our key-name matching doesn't recognise. A leak of a field named `notes` would be "likely," not "confirmed."

**Q: Could the verifier produce false positives?**
Yes. If a response legitimately contains a value that also appears in the owner's data (a shared public field with a sensitive-sounding name, for example), the verifier could match it. We reduce this by only comparing non-empty owner values under sensitive keys and by requiring an owner control success first. We have not measured the false-positive rate on real-world APIs. We measured 0 on our patched target.

**Q: Why trust 0% false positives?**
We only claim 0 false positives on our own patched variant, which includes the traps. We don't claim it in general. The exported report has a line saying "0.0% false positive rate" because that is what we measured on the benchmark. We'd reword it as "0 on the benchmark" to be precise.

**Q: What if the API uses numeric IDs, UUIDs, or composite keys?**
The scanner uses the real ID the server returns, so the ID format doesn't matter. Composite keys and body-based IDs aren't supported yet.

**Q: What about GraphQL, gRPC, or non-OpenAPI APIs?**
Not supported. The input is an OpenAPI 3.x spec.

**Q: What about rate limits, WAFs and production safety?**
The scanner is built for staging or local targets, with a request budget and a loopback-only allowlist. Don't point it at production without widening the allowlist deliberately and setting a budget.

**Q: Is it secure itself?**
We found and fixed issues in review: the exported HTML report now escapes untrusted fields (spec-derived text could otherwise run script), and CORS is restricted to the local UI origin. It's still a prototype. The API has no authentication and shouldn't be exposed beyond localhost.

**Q: Why should we believe the results are real and not mocked?**
The scanner makes real HTTP requests through an HTTP client, delivered in-process (ASGI) to the demo target in the UI scan and the benchmark. The in-process transport means no network socket is opened, and the same code can talk to a live host. There's no hardcoded graph or fake timers. Ablation and aggregate numbers are computed from the runs, not typed in. The tests (22 passing) cover the engine, planner, verifier, policy and an integration flow.

---

### E. "What next?" (the vision questions)

**Q: What would you build with another month?**
1. A configurable target: base URL, login flow, per-API create bodies and ID fields.
2. Auto-generating a valid create body from the spec's request schema instead of hardcoded fields.
3. Support for body and query-parameter IDs, and multi-tenant (team/org) rules.
4. A CI mode: a CLI that exits non-zero on a confirmed finding, plus a GitHub Action.
5. Benchmarks on public intentionally vulnerable apps (crAPI, VAmPI) with an honest comparison to ZAP and Autorize.

**Q: How would you make money / sustain it?**
Open-source core for trust. Paid tier for CI integration, team dashboards, historical trends and compliance-ready reports.

**Q: Why will this matter in a year?**
APIs keep multiplying, and authorization bugs are the category that automated tools handle worst. A deterministic, explainable tester that fits in CI is useful regardless of which AI trend is current.

---

## 7. Things to say, and things NOT to say

**Say:**
- "The scanner is deterministic. AI only writes the fix."
- "We confirm a bug by comparing the owner's private values in the attacker's response, not by status code."
- "Here is where it falls short" (judges respect this).
- "Ask us about any file."

**Don't say:**
- "100% accurate" or "zero false positives" without "on our benchmark."
- "Works on any API." It works on the bundled demo target today.
- "Replaces pentesters / ZAP / Burp."
- "AI-powered scanner." It isn't.

---

## 8. Cheat sheet: numbers and facts

- OWASP API Security Top 10, **API1:2023**: Broken Object Level Authorization.
- Demo spec: **11 graph nodes**, **8 operations**. The UI shows 7 of the graph's 18 edges (the rest are redundant structure).
- Benchmark: **5 variants**, **6 ground-truth bugs**. Graph scanner **6/6**, baseline **4/6**, patched target **0 false positives**.
- Ablation: propagation **off** misses the indirect bug. A hand-ruled oracle baseline matches the graph scanner.
- Tests: **22 passing**.
- Safety: loopback allowlist, request budget, mutation gate, redacted headers, deletes last on a throwaway resource.
- Scanner LLM calls: **0**.

---

*Pitch notes: practise the demo end to end twice. Keep the backup screenshots from `docs/screenshots/` open in another tab.*
