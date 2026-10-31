# APIGuard: Hackathon Pitch & Cross-Question Playbook

> Written for someone who is **new to API security**. Every technical term is explained the first time it appears, and again in the glossary at the end (Part 8). Facts were checked against the code and the benchmark results on 2026-10-31.

## How to use this file

| If you have... | Read |
|---|---|
| 5 minutes | Part 1.2 (five sentences) and the "Danger list" at the top of Part 5 |
| 1 hour | Parts 1 to 3 |
| An evening | Everything, then say the 3-minute script out loud twice |

**Conventions**

- **Plain English:** a plain-language explanation of a term.
- **Say:** wording you can use out loud.
- **Careful:** a place where the project is weaker than the slogan. Judges find these. Know them first.
- `[FILL IN: ...]` is something only you know (team story, timeline). Search the file for `FILL IN` before you present.
- The text says "we". Change it to "I" if you built this alone.

## Contents

- [Part 1: The pitch](#part-1-the-pitch) (scripts and the live demo)
- [Part 2: The concepts from zero](#part-2-the-concepts-from-zero)
- [Part 3: How APIGuard works](#part-3-how-apiguard-works)
- [Part 4: The tech stack, piece by piece](#part-4-the-tech-stack-piece-by-piece)
- [Part 5: Q&A bank](#part-5-qa-bank)
- [Part 6: Where the slogans are bigger than the code](#part-6-where-the-slogans-are-bigger-than-the-code)
- [Part 7: Cheat sheets and checklists](#part-7-cheat-sheets-and-checklists)
- [Part 8: Glossary A to Z](#part-8-glossary-a-to-z)

---

## Part 1: The pitch

### 1.1 The idea in one sentence

**APIGuard automatically checks whether one user of an app can read or change another user's private data through the app's API, and it proves every bug it reports.**

> **Plain English:** Think of a bank app. You see your statement at `bank.com/statements/1042`. If you change the number to `1043` and a stranger's statement appears, the bank has this bug. Nothing crashes and no alarm rings, because the page loaded fine. APIGuard hunts for that mistake automatically.

### 1.2 The five sentences to memorise

1. **The problem:** The number one API security risk (OWASP API1:2023, called **BOLA**) is a server handing one user another user's record, and it looks like a normal successful response.
2. **Why it's missed:** Scanners test each route on its own, but real APIs are connected, so teams protect the obvious route and forget its neighbours.
3. **What we do:** We read the API's **OpenAPI** file (the standard machine-readable list of every route it offers), turn it into a **graph** (a map of how routes relate), and act out an attack with two test users.
4. **How we prove it:** A bug is confirmed only when the owner's private values appear in the attacker's response, not just because a status code looked wrong.
5. **Where AI fits:** Detection is deterministic code with zero AI. AI is used only afterwards to suggest a fix and a test.

### 1.3 One pitch, three audiences (30 seconds each)

**For a non-technical judge**

"Imagine your online bank. Your statement is at statement number 1042. If the website lets you type 1043 and see a stranger's statement, that's a leak, and the bank's website still shows no error. It's the number one risk on the industry's API security list. Our tool plays two users, an owner and an attacker, and tries it automatically. When it finds a leak it shows both screens side by side, so there's no arguing about whether it's real."

**For a technical judge**

"APIGuard ingests an OpenAPI 3 spec and builds a typed resource graph with producer, consumer and nested-under edges. It logs in as two identities, harvests a real object ID as the owner, and observes the authorization rule on the primary read. It propagates that rule as a hypothesis to adjacent operations, probes each as the second identity, and confirms a finding only when the owner's sensitive values appear in the attacker's response body. The scanner is deterministic; an LLM is used only for post-hoc remediation. On our five-variant benchmark we get 6 of 6 seeded bugs and zero false positives on the patched variant."

**For a business or product judge**

"Authorization bugs are the hardest class for automated tools and they cause real data exposures. Teams ship new routes every week, and every new route is a chance to forget the ownership check. APIGuard is a regression test for that check. It can run in CI, it gives evidence a developer can reproduce in one command, and it exports an audit report for security reviews."

### 1.4 The 3-minute script (spoken)

After each part is a box listing the **terms you just used**, so you can answer if a judge picks one.

**Hook (15 seconds)**

"Quick question: if your app has a login screen, is your users' data safe? Most people say yes. The honest answer is not necessarily. Login proves *who you are*. It doesn't check *which records you're allowed to open*. That gap has a name, BOLA, Broken Object Level Authorization, and it's number one on OWASP's list of API security risks."

> **Terms used**
> - **Login / authentication:** proving who you are (username and password, then a token).
> - **Authorization:** deciding what that person is allowed to do or see.
> - **BOLA:** when the server returns a record to someone who isn't allowed to have it, because it checked "are you logged in?" but not "is this record yours?".
> - **OWASP:** a non-profit community that publishes widely used security guidance. Its "API Security Top 10" ranks the most common API flaws. BOLA is item #1 (labelled API1:2023).

**Problem (30 seconds)**

"Here's why it survives. A user opens `/projects/43`, their own project. They change 43 to 44, someone else's. If the server forgets to check ownership, it just returns the data with a normal 200 OK. No error, no alert, no crash. And apps have many routes around the same record: the project, its export, its summary. Teams protect the obvious one and forget the neighbours. Most scanners test each route separately, so they never ask why the neighbour isn't protected too."

> **Terms used**
> - **Route / endpoint:** one address an API offers, such as `GET /projects/43`. A route is a URL plus an HTTP method.
> - **ID:** the number or code that names one record (`43`, `proj_43`).
> - **200 OK:** the standard "success" status code. It means the request worked, not that it was allowed.
> - **Scanner:** a program that sends test requests to find security bugs.

**Solution (45 seconds)**

"APIGuard starts from the app's OpenAPI document, the machine-readable menu of every route the API offers. It turns that into a map of how the routes relate: which route creates a project, which routes use the project's ID, and which routes sit underneath it. Then it acts out an attack, safely, with two test users. Aman is the owner. Taaran is the attacker. Aman creates real data and Taaran tries to read it. If the main route correctly says 'forbidden', we've learned the app's rule, 'only the owner can see this', and we test that same rule on the neighbouring routes."

> **Terms used**
> - **OpenAPI:** a standard file format (YAML or JSON) that describes an API: every route, what inputs it takes and what it returns. Formerly called Swagger. See [2.5](#25-what-openapi-is).
> - **Graph:** dots (nodes) connected by arrows (edges). Ours maps "this route creates the ID, that route uses it". See [2.6](#26-what-a-graph-and-a-dag-are).
> - **Test users / identities:** two real accounts the tool logs in as: the owner (Aman) and the attacker (Taaran).
> - **Rule (policy):** a statement like "only the owner can read this record".

**Proof (45 seconds)**

"We never trust a status code alone. A 200 can be harmless, like an empty page or a public statistic. So we compare what Aman got with what Taaran got. If Taaran's response contains Aman's private values, his email and his billing details, it's a confirmed leak, and we show both responses side by side with a command to reproduce it. We also built decoys into our demo API to test ourselves: a route that returns 200 with nothing inside, and a route that isn't implemented. Neither gets flagged. On our benchmark of five versions of the API with six planted bugs, APIGuard found six of six, with no false alarms on the fixed version. A scanner that only tests routes it was given rules for found four of six, and missed the neighbouring export route."

> **Terms used**
> - **Status code:** the three-digit number in every HTTP response (200 OK, 403 Forbidden, 404 Not Found).
> - **Differential comparison:** asking the same question as two different people and comparing the answers. See [2.7](#27-what-differential-testing-is).
> - **False alarm (false positive):** the tool says "bug!" when there isn't one.
> - **Benchmark:** a repeatable test with a known answer key, used to measure a tool.
> - **Recall:** of the real bugs that exist, how many did we find. Six of six is 100%.

**AI (20 seconds)**

"AI plays one role. After a bug is proven, it writes a suggested fix and a test, and we show a naive prompt next to a context-rich one. Detection itself uses no AI. The same input gives the same result every time, so you can trust a finding the way you trust a failing test."

> **Terms used**
> - **LLM (large language model):** the kind of AI behind chatbots. It predicts text, and it can be confidently wrong.
> - **Deterministic:** same input, same output, every time.
> - **Prompt:** the instructions we send to the model.

**Close (25 seconds)**

"Today it's a working prototype against a demo API, with the full loop: map, attack safely, prove, explain, suggest a fix, and export a report. Next is pointing it at any staging API and running it in CI so a new route can't ship with this bug. Thank you."

> **Terms used**
> - **Staging:** a safe copy of an app used for testing before release.
> - **CI (continuous integration):** an automatic check that runs on every code change.

### 1.5 The live demo script (matches the current UI)

**Before you go on stage**

1. Start the backend: `cd backend`, then `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`.
2. Start the frontend: `cd frontend`, then `npm run dev`. (Or double-click `run_prototype.bat`.)
3. Open `http://127.0.0.1:5173`.
4. Click the circular-arrow icon (reset) once, so the target and history are clean.
5. Leave the **Mutations** toggle off for the first run.

**Know the screen:** the top bar has `Dry run` and `Mutations` toggles, five icon buttons (guided demo `?`, benchmarks, dry-run table, export report, reset) and the gold **BEGIN AUDIT** button. The left panel lists the spec's identities and endpoints. The centre is the dependency graph. The right side has the Event Stream (live log) above the Findings list.

| Step | What you do | What you say | If a judge asks... |
|---|---|---|---|
| 1 | Point at the graph before scanning | "This is the demo API's OpenAPI file turned into a map. Blue boxes at the top are setup: login and 'create project'. The gold key is the ID that creation produces. Below it, the routes that use the ID. At the bottom, the routes nested under a project." | "What's a solid vs dashed line?" Solid comes straight from the spec; dashed is inferred (nested routes). |
| 2 | Click the chip icon (dry-run table) | "Before sending anything, we can preview the plan: create as the owner, read as the owner, read as the attacker. Nothing is sent." | "Is that exactly what will run?" It's a preview of the shape of the plan. The live scan reuses one created project, so it sends fewer requests (Part 6). |
| 3 | Close it, click **BEGIN AUDIT** | "Watch the event stream. We log in as both users, the owner creates a project, then we test whether the attacker can read it." | |
| 4 | Point at the stream and graph as they update | "The main route says 403, forbidden. Good. That teaches us the rule 'owner only'. The engine passes the rule on to the neighbouring routes and tests each one." | "How do you know it's 403 and not a fluke?" We first confirm the owner gets 200 (the control). |
| 5 | Point at the red node | "Export returns 200 to the attacker. It turns red: LEAK." | |
| 6 | Point at the summary node | "Summary also returned 200 but with an empty body, so no data leaked. We don't flag it. That's a trap we built in on purpose." | |
| 7 | Point at the grey `UNSURE` node | "Members isn't implemented in the demo API. Even the owner gets 404, so we can't say anything about it. We report 'unsure', never 'secure'." | |
| 8 | Click the finding in the Findings list | "Left is what the owner got. Right is what the attacker got. The leaked fields are highlighted. Here's the command to reproduce it." | "What's the 0.65?" A heuristic confidence score, not a probability (Part 3.4). |
| 9 | Click **AI Remediation** | "The model writes a fix and a test. We show a naive prompt next to a prompt that includes the graph context." | "Is the AI fix verified?" No. See the next row. |
| 10 | Click **Apply reference fix & re-scan** | "This flips the demo API into its patched mode, then re-scans. One confirmed leak becomes zero." | **Careful:** this does not apply the AI's patch. It switches the demo API to a built-in fixed version to show what a correct fix achieves. |
| 11 | Click the bar-chart icon (benchmarks) | "Five versions of the API, six planted bugs. We found six. A rules-only scanner found four." | "Is it rigged?" See Q29. |
| 12 | Click the page icon (export report) | "One click to a Markdown or printable report." | |
| 13 (optional) | Toggle **Mutations**, click Begin Audit again | "Now it also tests PATCH and DELETE, on a throwaway record." | |

> **Dry run toggle:** with it on, the gold button reads **PREVIEW PLAN** and opens the plan table instead of scanning, so nothing is sent. Turn it off before the live part of the demo.

### 1.6 If the demo breaks

| Symptom | Fix |
|---|---|
| Red banner "The Erdtree is silent. Backend unreachable" | The backend isn't running. Start it (step 1 above) and click Retry. |
| Graph is empty | Click the circular-arrows icon in the Spec panel (reload demo spec). |
| Scan finds 0 leaks and a banner says "Target is patched" | Click **Revert** in the banner, or the reset icon. |
| Old findings are showing | Click the toggle in the Findings header so it says "This run". |
| No internet | Pixel fonts fall back to a system monospace font. Everything still works. |
| AI Remediation says "Offline template" | Expected without an API key. It is labelled "illustrative, not model output". Say so. |
| Nothing works at all | Run the command-line version: `cd backend`, then `python -m app.engine.cli scan` (add `--dry-run` for the plan only, `--mutations` for PATCH/DELETE). Or show the screenshots in `docs/screenshots/` (they show the earlier look of the UI). |
| Hosted replay | `https://code-breaker-ctrl.github.io/APIGuard/` replays recorded real runs with no backend. It only works after GitHub Pages has been switched on for the repo. |

---

## Part 2: The concepts from zero

Read this once. After it, the scripts above should make complete sense.

### 2.1 What an API is

> **Plain English:** An API (Application Programming Interface) is how programs talk to a service. Think of a restaurant. The **menu** lists what you can order. The **waiter** carries your order to the kitchen and brings back the food. You never walk into the kitchen. Here the menu is the API's documentation, the waiter is the API, and the kitchen is the server and database.

- An **endpoint** (also called a **route**) is one item on the menu: an address plus an action, such as `GET /projects/43`.
- A **resource** is the thing being managed. In the demo it's a *project*. Others might be orders, invoices or documents.
- A **tenant** is one customer of a multi-customer system. **Multi-tenant** means many customers share one system, and the system must keep their data separate. BOLA is a failure of that separation.

### 2.2 HTTP in five minutes

Almost every web API speaks **HTTP**, a request-and-response protocol.

A **request** has: a **method** (the action), a **URL** (the address), **headers** (labels with extra info) and sometimes a **body** (data). A **response** has a **status code**, headers and a body.

| Method | Meaning | Example |
|---|---|---|
| `GET` | Read something | `GET /projects/43` |
| `POST` | Create something | `POST /projects` |
| `PUT` | Replace something | `PUT /projects/43` |
| `PATCH` | Change part of something | `PATCH /projects/43` |
| `DELETE` | Remove something | `DELETE /projects/43` |

| Status | Name | Meaning in plain words |
|---|---|---|
| 200 | OK | It worked. |
| 201 | Created | It worked and a new record exists. |
| 401 | Unauthorized | "I don't know who you are." (Missing or bad login.) |
| 403 | Forbidden | "I know who you are, and you may not do this." |
| 404 | Not Found | "That doesn't exist." (Some apps return 404 on purpose to hide that a record exists.) |
| 500 | Server error | The server crashed. |

- **JSON** is the text format APIs use for data: `{"id": "proj_43", "owner_email": "aman@acme.corp"}`.
- **A header** carrying your login looks like `Authorization: Bearer <token>`.
- **cURL** is a command-line tool that sends one HTTP request. Our findings include a cURL command so anyone can reproduce the bug with one line.

> **Why this matters for the pitch:** BOLA returns **200**. Monitoring tools treat 200 as healthy. That's why the bug is invisible.

### 2.3 Logging in vs being allowed

| | Authentication | Authorization |
|---|---|---|
| Question | Who are you? | What are you allowed to do or see? |
| Typical mechanism | Password, then a **token** | Checks in the server's code |
| Failure shows up as | 401 | 403 (when done right) |
| Analogy | A hotel keycard that proves you're a guest | The card only opening **your** room |

BOLA is a missing authorization check: the keycard works, and it also opens every other room if you just change the room number.

**Token / bearer token.** After login, the server gives you a token, a long string. You attach it to each request (`Authorization: Bearer <token>`) to prove who you are. "Bearer" means whoever holds it is treated as that user.

**JWT (JSON Web Token).** One popular token format. It has three dot-separated parts (header, payload, signature). The server signs it, so it can trust the token without looking anything up. A JWT says *who you are*. It says nothing about *which records you may open*.

> **Careful:** our demo API does **not** use real JWTs. Its login returns simple fixed tokens such as `tok_live_aman_8921`, looked up in a dictionary, and the OpenAPI file says only that the scheme is `bearer`. This doesn't matter for the scanner: it treats every token as an opaque string and just sends it in the `Authorization` header, so it works the same for JWTs.

### 2.4 What BOLA is

**BOLA** (Broken Object Level Authorization) is when a server hands over an **object** (a record) to a user who isn't allowed to have it. An older name for the same family is **IDOR** (Insecure Direct Object Reference).

> **Plain English:** a library card proves you're a member (authentication). BOLA is the librarian handing you someone else's borrowing record because you asked for "record #43" and never checked whose it was.

Why it's #1:

1. **APIs expose IDs everywhere.** Every route like `/projects/{id}` is a place the check can be forgotten.
2. **The check is per record.** It has to be written correctly in every handler, by every developer, forever.
3. **It looks like success.** The response is a normal 200, so there is no error to alert on.

How it differs from other API risks (OWASP API Top 10, 2023 edition):

| Risk | What goes wrong | Example |
|---|---|---|
| **API1 BOLA** | Wrong *record* returned | Changing `43` to `44` shows a stranger's project |
| API2 Broken Authentication | Login or tokens are weak | Tokens that never expire |
| API5 Broken Function Level Authorization | Wrong *function* allowed | A normal user calling an admin-only route |

APIGuard targets the first one.

### 2.5 What OpenAPI is

> **Plain English:** OpenAPI is a standard way to write down an API as a file. It's a menu a *computer* can read. It lists every route, what inputs each takes, and what comes back. The same idea as a restaurant menu, except software can read it, so tools can work without a human explaining the API.

- It's written in **YAML** or **JSON** (two text formats for structured data).
- It was originally called **Swagger**. Since version 3 it's called OpenAPI and is maintained by the OpenAPI Initiative (part of the Linux Foundation). We support **3.x**.
- Many frameworks generate it automatically. FastAPI does by default. Spring, NestJS and Django REST have add-ons for it.

Here's a small piece of our actual demo spec, with notes:

```yaml
paths:
  /projects/{project_id}:          # a route; {project_id} is a placeholder for any ID
    get:                           # the HTTP method (read)
      operationId: getProjectById  # a unique name for this operation
      security:
        - bearerAuth: []           # this route needs a bearer token
      parameters:
        - name: project_id
          in: path                 # the value goes in the URL path
          required: true
      responses:
        '200': { description: Project retrieved }
        '403': { description: Forbidden }
        '404': { description: Project not found }
```

Other terms you may be asked about:

- **Path parameter:** the `{project_id}` placeholder inside a URL. It's how an API names one record.
- **`$ref`:** a pointer to a shared definition elsewhere in the file (for example `#/components/schemas/Project`) so it's written once. Our parser resolves these pointers.
- **Schema:** a description of the shape of data (which fields exist and their types).
- **Spec validation:** checking the file is well-formed. We use a library (`openapi-spec-validator`) to reject broken specs with a clear error.

**Why we use it as the input:** it tells us every route and which ones take an ID, without crawling or guessing, and most modern APIs already have one.

**Questions you'll get:**

- *"What if the API has no spec?"* Many frameworks can generate one. Tools can also convert a Postman collection into one. APIGuard doesn't generate specs itself.
- *"What if the spec is out of date?"* Then we test the wrong things. Routes missing from the spec aren't tested. In our demo target, the extra `/audit-log` route isn't in the spec, so the scanner never visits it.
- *"Swagger 2.0 or GraphQL?"* Not supported. Convert Swagger 2.0 to OpenAPI 3 first. GraphQL has no OpenAPI file.

### 2.6 What a graph and a DAG are

A **graph** is **nodes** (dots) joined by **edges** (lines). A subway map is a graph: stations are nodes, tracks are edges. A **directed** graph has arrows, so each edge has a direction. **Acyclic** means you can never follow the arrows and end up back where you started. A **DAG** is a **D**irected **A**cyclic **G**raph. A family tree is one, and so is "to cook dinner, first shop, then chop, then cook".

**Why a graph for an API?** Routes depend on each other. To read project 43 you first have to *create* project 43. That "must happen first" relationship is an edge.

Our graph, for the demo API:

```
 POST /auth/login          POST /projects
   (login)                 (creates a project)
                               | PRODUCES
                               v
                        [ id: project_id ]
              CONSUMES  /      |       \  CONSUMES
                       v       v        v
        GET /projects/{id}   PATCH ...   DELETE ...
                       |
                       | NESTED_UNDER (dashed in the UI)
          +------------+------------+
          v            v            v
      .../export    .../summary   .../members
```

| Node type | Meaning | Count in demo |
|---|---|---|
| Operation | One route (method + path) | 8 |
| Identifier | An ID that one route makes and others use (`project_id`) | 1 |
| Resource type | A grouping by first path segment (`projects`, `auth`) | 2 |
| **Total** | | **11** |

| Edge type | Meaning | Count in demo |
|---|---|---|
| `PRODUCES` | This route creates that ID | 1 |
| `CONSUMES` | This route needs that ID | 6 |
| `NESTED_UNDER` | This route sits under a parent route (a longer path) | 3 |
| `OPERATES_ON` | This route works on that resource type | 8 |
| **Total** | | **18** |

The UI **hides** the resource-type nodes and the `OPERATES_ON` edges, plus `CONSUMES` edges that are already implied by nesting. The result is 7 drawn edges. They carry no extra information, and hiding them keeps the picture readable.

**Producer / consumer:** a *producer* creates an ID (`POST /projects`). A *consumer* needs it (`GET /projects/{id}`).

**Provenance:** where we learned a fact. `schema` = read directly from the spec. `propagated` = inferred by passing a rule along an edge. `observed` = seen in a real response.

### 2.7 What differential testing is

> **Plain English:** it's the spot-the-difference game. Ask the same question as two different people and compare the answers.

For one route, APIGuard sends the same request twice, once as the **owner** (the *control*) and once as the **attacker** (the *probe*):

| Owner gets | Attacker gets | Verdict |
|---|---|---|
| 200 + data | 403 or 404 | **Secure.** The route correctly blocks the attacker. |
| 200 + data | 200 containing the owner's private values | **Leak confirmed.** |
| 200 + data | 200 with an empty body | **No leak.** (The "empty page" trap.) |
| 404 or error | anything | **Inconclusive.** The control failed, so we can't judge. |

**Why compare bodies, not just codes?** Some servers return 200 with nothing inside, and some return 200 with only public data. A tool that flags every 200 would drown you in false alarms.

### 2.8 Testing vocabulary

- **Scanner:** a program that sends test requests looking for bugs.
- **DAST** (Dynamic Application Security Testing): testing a *running* app from the outside, like an attacker would. ZAP and Burp Suite are well-known DAST tools. **SAST** reads the source code without running it. APIGuard is DAST-style.
- **Pentest:** a human security professional attacking a system (with permission).
- **Fuzzing:** blasting a system with lots of random or malformed input.
- **False positive:** a false alarm. **False negative:** a missed bug.
- **Recall:** found bugs ÷ real bugs. Found 6 of 6 is 100%.
- **Precision:** real bugs ÷ alarms raised. 6 real out of 6 alarms is 100%. Zero false alarms means precision stays at 100%.
- **Ground truth:** the answer key, the list of bugs we know are really there. Ours is in `benchmarks/manifests/*.json`, and the scanner never reads it.
- **Baseline:** a simpler method to compare against.
- **Ablation:** removing one part of your system to see what it contributed.

### 2.9 Streaming and async (the "live" feel)

- **SSE (Server-Sent Events):** the server keeps one web connection open and pushes messages to the browser as they happen, like a live sports ticker. Browsers have a built-in `EventSource` for it. It's one-way (server to browser), which is all we need. WebSockets are two-way and heavier. Polling means repeatedly asking "anything new?".
- **Async / `asyncio`:** a way for Python to do many waiting jobs (like network calls) without blocking. A waiter taking several tables' orders instead of standing at one table.
- **ASGI:** the standard plug between Python web servers and async apps. It also lets a client call an app **in-process**, with no network at all. Our UI scan and benchmark use that; see Q35.

### 2.10 What an LLM is and where we use it

An **LLM** (large language model) predicts text. It's good at drafting code, but it can **hallucinate**: state something wrong with total confidence. That's why we keep it out of detection. In APIGuard it only drafts the *suggested fix and test*, after the deterministic engine has already proven the bug. We reach models through **OpenRouter** (one key and one API that fronts many models, including free ones) or **Google Gemini**.

---

## Part 3: How APIGuard works

### 3.0 Map of the stages

| # | Stage | What happens | Code |
|---|---|---|---|
| 0 | Ingest | Read and validate the OpenAPI file; list the operations | `engine/spec.py` |
| 1 | Build graph | Create nodes and edges | `engine/graph.py` |
| 2 | Log in | Get real tokens for the two test users | `engine/auth.py` |
| 3 | Harvest | Owner creates a real record; we keep its ID | `engine/scanner.py` |
| 4 | Control and probe | Owner reads it (200 expected), attacker reads it (403 expected) | `engine/scanner.py` |
| 5 | Infer rule | Owner allowed + attacker denied means rule "owner only" | `engine/inference.py` |
| 6 | Propagate and test neighbours | Hand the rule to related routes and test each | `engine/inference.py`, `scanner.py` |
| 7 | Verify | Compare owner vs attacker responses | `engine/verifier.py` |
| 8 | Report | Finding with evidence, repro command, graph path, confidence | `main.py`, UI |
| 9 | Suggest fix | LLM drafts patch and test | `engine/remediation.py` |

Every HTTP request in stages 2 to 7 goes through one safety gate, `SafeExecutor` (`engine/executor.py`).

### 3.1 The demo "victim" API

The scanner needs something to attack, so the repo includes a deliberately flawed API in `backend/app/target/`. It's mounted inside the same server at `/target`.

- **Four seeded users:** `aman@acme.corp` and `taaran@adversary.io` (customers), plus an admin and a support user. The scanner uses Aman (owner) and Taaran (attacker).
- **One seeded project** (`proj_42`, owned by Aman). Scans create new ones (`proj_43` and so on).
- **Three switchable defects:** A = the main read `GET /projects/{id}` skips the ownership check, B = `GET /projects/{id}/export` skips it, C = `PATCH /projects/{id}` skips it. A **patched mode** fixes all three. By default only **B** is on, to show the indirect case.
- **Decoy routes:** `/summary` returns **200 with an empty body** to non-owners. `/members` is **declared in the spec but not implemented**, so even the owner gets 404. `/audit-log` returns 404 to non-owners but is not in the spec, so the spec-driven scanner never visits it.

### 3.2 A scan, step by step, with real values

**Stages 0 and 1: ingest and graph.** The parser validates the YAML and extracts 8 operations (login, create project, get/patch/delete project, export, summary, members). The graph builder produces 11 nodes and 18 edges. `POST /projects` is recognised as a producer because it's a `POST` on a collection with no path parameter (and isn't an auth route). `project_id` is matched to it by name.

**Stage 2: log in.**

```
POST /target/auth/login  {"username":"aman@acme.corp","password":"..."}
-> {"token":"tok_live_aman_8921","user_id":"usr_aman_101","role":"customer"}
```

The same happens for Taaran. Tokens are never shown in the UI; headers are shown as `[REDACTED]`.

**Stage 3: harvest.** Aman creates a real project.

```
POST /target/projects  (as Aman)  -> 201
{"id":"proj_43","owner_id":"usr_aman_101","owner_email":"aman@acme.corp",
 "name":"Aegis Inferred projects","confidential_data":"QNTM-SECRET-PROD-KEY-9981",
 "budget":"$240,000","billing_card":"**** **** **** 4242", ...}
```

We use a *real* ID the server just returned. Guessing IDs would mostly hit "not found" and prove nothing.

**Stage 4: control and probe on the main read route.**

```
GET /target/projects/proj_43  as Aman    -> 200   (control: the owner can read it)
GET /target/projects/proj_43  as Taaran  -> 403   (probe: "Forbidden: You do not own this project")
```

**Stage 5: infer a rule.** Owner got 200 and attacker got 403 (or 401 or 404), so the engine records a **hypothesis**: rule `owner_only` on `GET /projects/{project_id}`, provenance `observed`, status `validated`.

> **Plain English:** a hypothesis is an educated guess that we test. "Because this route is owner-only, the routes under it probably are too."

**Stage 6: propagate and test the neighbours.** The rule is handed to the operations next to it in the graph (the three `NESTED_UNDER` neighbours: export, summary, members) as **candidate** hypotheses. The scanner then runs control and probe on every remaining operation that takes an ID, reads first, then PATCH/PUT if mutations are on, and DELETE last on a throwaway record.

```
GET .../proj_43/export   as Aman    -> 200 {"export_id":..., "owner_email":"aman@acme.corp",
                                            "financial_payload":{"budget":"$240,000","billing":"**** **** **** 4242"}}
GET .../proj_43/export   as Taaran  -> 200  (same body!)        <- the bug
GET .../proj_43/summary  as Aman    -> 200 {"status":"active","task_count":12}
GET .../proj_43/summary  as Taaran  -> 200 {}                   <- empty: no leak (trap)
GET .../proj_43/members  as Aman    -> 404                       <- not implemented: inconclusive
```

> **Careful:** in the current code, propagation does not *narrow* which routes get tested. Every remaining route that takes an ID is tested. What propagation does is (a) switch on this whole second stage, and (b) attach a hypothesis, with a confidence score, to each result so the finding can say *why* the route was tested. See Part 6, row 1.

**Stage 7: verify.** For `/export`, the verifier pulls the owner's sensitive-looking values out of Aman's response (`owner_email`, `financial_payload.budget`, `financial_payload.billing`). All three appear in Taaran's response, so the result is **CONFIRMED**. The leaked fields are recorded. Severity is **CRITICAL** because a leaked field name contains "billing".

**Stage 8: the finding.** It carries: endpoint and method, severity, confidence (0.65), the owner and attacker identities, both response bodies, the leaked field names, a **graph path** (`getProjectById -> (NESTED_UNDER) -> exportProjectBilling`), a reproduction cURL, and a two-step minimized recipe (create as owner, replay as attacker). It's streamed to the UI and saved in SQLite.

### 3.3 The verifier's decision table (`DifferentialVerifier.verify`)

| # | Condition checked, in order | Result |
|---|---|---|
| 1 | Owner's control request wasn't 2xx, or the probe had no response | **INCONCLUSIVE** (we can't judge) |
| 2 | Attacker got 401, 403 or 404 | **Nothing to report** (properly blocked) |
| 3 | Attacker got 2xx with an empty body (`{}`, `[]`, nothing) | **POTENTIAL**, low (the empty-body trap; not a finding) |
| 4 | Any of the owner's sensitive values appear in the attacker's body | **CONFIRMED** |
| 5 | Attacker got 2xx, but no sensitive value matched | **LIKELY**, medium |

How "sensitive values" are chosen: walk the owner's response and collect every non-empty plain value whose **key name** contains one of: `owner`, `email`, `user_id`, `billing`, `card`, `confidential`, `secret`, `token`, `budget`, `ssn`, `passport`, `private`. A value counts as leaked if that exact text appears anywhere in the attacker's response.

> **Careful:** a result of LIKELY (row 5) is not shown in the UI at the moment. Only CONFIRMED findings are listed, and the empty-body and denied cases show on the graph as "SAFE".

### 3.4 Confidence, severity and finding status

**Confidence** is a *heuristic score*, not a statistical probability. The code says so itself. It depends on where the evidence came from:

| Evidence source (provenance) | Starting score |
|---|---|
| Documented | 0.85 |
| Schema (read from the spec) | 0.80 |
| Observed (seen in a real response) | 0.75 |
| Propagated (inferred from a neighbour) | 0.50 |
| Heuristic | 0.35 |

Each supporting observation adds 0.10; each contradiction subtracts 0.30; scores are clamped between 0.05 and 0.98. A validated rule seen directly scores 0.85 (0.75 + 0.10). A confirmed leak on a route whose rule was propagated scores **0.65** (0.50 + 0.15 bonus for a confirmed leak). That is the 0.65 you'll see on the demo finding.

**Severity:** CRITICAL if a leaked field name contains `billing`, `card` or `secret`; otherwise HIGH. A DELETE that works for the attacker is reported as CRITICAL. It's a simple rule, not CVSS scoring.

**Finding status:** `confirmed`, `likely`, `potential`, `inconclusive` (plus `not_reproducible` and `rejected`, which exist in the model but aren't produced by the current scanner).

### 3.5 Safety layers (`SafeExecutor`)

All HTTP goes through one class, so safety rules can't be bypassed by accident.

| Layer | What it does |
|---|---|
| **Host allowlist** | Requests only go to `127.0.0.1` / `localhost` unless widened. Anything else raises an error. |
| **Request budget** | A total cap (30 per scan in the app) and a per-route cap (6). A runaway scan stops itself. |
| **Mutation gate** | `POST`, `PUT`, `PATCH`, `DELETE` are refused unless "Mutations" is on. The one exception is the *setup* step that creates a test record. |
| **Response size cap** | Responses over 500 KB are rejected. |
| **Timeout** | 5 seconds per request. |
| **Secret redaction** | Headers containing authorization, cookie, token, password, api-key or secret are shown as `[REDACTED]` in logs and the UI. |
| **Deletes last** | DELETE tests run at the end, on a throwaway record created for that purpose. |

> **Careful:** "safe by default" doesn't mean "no writes". Even with Mutations off, each scan **creates** a test project on the target and leaves it there. With Mutations on it also edits that project and creates and deletes a second one. Only point it at systems where test data is acceptable.

### 3.6 Remediation: the AI part

After a finding, the **AI Remediation** window sends two prompts to the same model:

- **v1 (naive):** "Fix this BOLA security bug in our API: endpoint GET /projects/{project_id}/export allows unauthorized users to read data."
- **v2 (context-rich):** adds the resource type and the exact leaked field names, and asks for an ownership check (owner or admin) plus a pytest test.

Fallback order if a call fails: **OpenRouter, then Gemini, then a cached earlier real answer from SQLite, then a clearly labelled offline template** ("Illustrative template, not model output"). The model only ever sees finding **metadata** (route, method, resource type, leaked field *names*), never response bodies or tokens.

"Apply reference fix & re-scan" does **not** run the model's patch. It switches the demo API into its built-in patched mode and re-scans, to show that a correct fix removes the finding.

### 3.7 Reports and storage

- **Report:** the page icon exports a **Markdown** file or a printable **HTML** file (print to PDF in the browser). It lists the summary, each finding's severity, leaked attributes, graph path, reproduction cURL and a remediation sketch. Untrusted text is escaped, so a malicious route name can't inject script.
- **Storage:** SQLite (an embedded database file, `apiguard.db` at the repo root, in WAL mode) stores scans, events, findings and remediation attempts. Findings include the leaked response bodies, so treat that file as sensitive. It's git-ignored.

### 3.8 The benchmark in detail

Five versions ("variants") of the demo API, each with different planted bugs. Both scanners run against each one, and results are compared with the answer key.

| Variant | Planted bug(s) | Real bugs | Baseline found | APIGuard found | APIGuard false alarms |
|---|---|:-:|:-:|:-:|:-:|
| A | Main read `GET /projects/{id}` | 1 | 1 | 1 | 0 |
| B | `GET /projects/{id}/export` (indirect) | 1 | **0** | 1 | 0 |
| C | `PATCH /projects/{id}` (needs mutations) | 1 | 1 | 1 | 0 |
| All | A + B + C | 3 | 2 | 3 | 0 |
| Secure | None; patched, with decoys | 0 | 0 | 0 | 0 |
| **Total** | | **6** | **4** | **6** | **0** |

**Who is the baseline?** A scanner that harvests a record the same way, then tests routes **one by one, but only those it has been given a rule for**: the main read, update and delete. It has no rule for `/export`, so it never tests it. The **oracle baseline** is the same scanner, given a hand-written rule for `/export` too.

**Ablations (on variant B):**

| Configuration | Found | Requests |
|---|:-:|:-:|
| APIGuard (full) | 1 of 1 | 15 |
| Propagation OFF | 0 of 1 | 6 |
| Oracle baseline (a human wrote a rule for every route) | 1 of 1 | 9 |

**How to talk about it honestly:**

- The target and the answer key are ours, so this shows the method works on a controlled case. It doesn't show how it performs on real-world APIs.
- APIGuard uses **more** requests (15 vs 7 per scan on single-bug variants). It tests more routes, including the neighbours the baseline skips. We don't claim it's faster or cheaper.
- The oracle row is the fair comparison: if a human writes a rule for every route, a simple scanner matches us. Our claim is that we remove the need to write those rules.
- "Propagation OFF" turns off the **whole** neighbour-testing stage, not just the rule bookkeeping. It shows that stage is necessary, but it doesn't isolate rule knowledge from route coverage.
- Precision shows `n/a` when a scanner reported nothing (the baseline on variant B), because there is nothing to be precise about.
- There's no "test every route with two users, no rules" scanner in the benchmark. Such a brute-force scanner using our verifier would likely also find the export bug.

### 3.9 60-second code tours (if a judge says "show me the code")

**`verifier.py` (the heart of "proof")**
`DifferentialVerifier.verify` takes the owner's result and the attacker's result. It first handles the early exits (owner failed, attacker denied, empty body). Then `_extract_sensitive_values` walks the owner's JSON recursively and collects non-empty values under sensitive key names. If any of those strings appear in the attacker's body it returns CONFIRMED, with a confidence of the hypothesis score plus 0.15 and a severity from the field names. No hardcoded values are used (a test uses completely different data to prove that).

**`graph.py`**
`ResourceGraph.build_from_operations` makes a node per operation and per resource (first path segment). A `POST` on a collection with no path parameters becomes a producer (`PRODUCES` edge to an identifier node). Path parameters that match the resource name create `CONSUMES` edges. A GET parent whose path is a prefix of a longer path creates a `NESTED_UNDER` edge. `get_producers_for_consumer` and `get_graph_adjacent_operations` answer "who creates this ID?" and "who is next to this route?".

**`inference.py`**
`record_control_observation`: if the owner got 200 and the attacker got 401, 403 or 404, create a validated `owner_only` hypothesis (confidence 0.85). `propagate_rules` copies it as a candidate (confidence 0.50) to the graph-adjacent operations.

**`scanner.py`**
`GraphGuidedScanner.run_scan` loops over resource types: find the identifier and its producer, harvest a record, pick the primary read route, run control and probe, infer and propagate, then test the remaining ID routes (reads, then PATCH/PUT if allowed, DELETE last on a disposable record). Findings are de-duplicated by method and path.

**`executor.py`**
`SafeExecutor.execute_step` first runs `_validate_safety` (host allowlist, mutation gate, budgets), then sends the request with `httpx`, enforces the size cap, parses JSON and returns an `ExecutionResult`. Network errors don't crash the scan; they come back as status 0 with an error message.

---

## Part 4: The tech stack, piece by piece

For each: **what it is**, **why we chose it**, **a likely follow-up**.

### Backend (Python)

| Tool | What it is | Why we used it | If they ask |
|---|---|---|---|
| **Python 3.12** | The programming language | Quick to build, rich security and web libraries | "Why not Go or Node?" Speed of development; performance isn't the bottleneck for a testing tool. |
| **FastAPI** | A Python web framework: you write functions, it serves them as HTTP routes, validates input, and generates an OpenAPI file | Async, typed, and the same framework our *target* demo API uses. It's also what many of our target users build with. | "Does the app generate its own OpenAPI?" FastAPI does, but we scan a bundled demo spec, not our own. |
| **Uvicorn** | The server program that runs FastAPI | The standard choice for FastAPI | |
| **Pydantic v2** | A library that defines typed data models and validates them | Our `Operation`, `Finding`, `Hypothesis` and so on are Pydantic models, so bad data fails loudly | |
| **httpx** | An HTTP client library (like `requests`, but async) | It can call our app **in-process** through an ASGI transport, which makes tests fast and the UI scan self-contained | "Is it real traffic?" Real requests handled by the real target code, delivered in-process. See Q35. |
| **aiosqlite / SQLite (WAL)** | An embedded file database, accessed asynchronously. WAL mode lets reads and writes overlap | Zero setup for a local tool | "Won't it fall over at scale?" Yes, for many users. For a local single-user tool it's right-sized. |
| **openapi-spec-validator** | Checks a document is valid OpenAPI | Rejects broken specs with a clear error | |
| **PyYAML** | Reads YAML files | OpenAPI files are often YAML | |
| **python-dotenv, python-multipart** | Load API keys from a `.env` file; accept file uploads | Keys stay out of the code; spec upload works | |
| **pytest, pytest-asyncio** | Test framework and its async add-on | 22 tests: engine units plus integration tests against a real server on a real port | |

### Frontend (browser)

| Tool | What it is | Why we used it | If they ask |
|---|---|---|---|
| **React 19** | A library for building UIs from components | The most common choice, with the best graph-library ecosystem | |
| **TypeScript** | JavaScript with types | Catches mistakes before they run | |
| **Vite** | The dev server and bundler | Fast to start and rebuild | |
| **Tailwind CSS v4** | A utility-class styling system (`text-lg`, `bg-slate-900`) | Fast to style; our pixel theme re-maps its colour tokens so existing classes pick up new colours | |
| **@xyflow/react (React Flow)** | A library for node-and-edge diagrams (drag, zoom, custom nodes) | Purpose-built for exactly our graph view | "Why not D3?" D3 is lower-level; React Flow gives interactive nodes out of the box. |
| **dagre** | A layout algorithm that arranges a directed graph into tidy layers | React Flow draws nodes but doesn't place them. Dagre computes positions. | |
| **lucide-react** | An icon set | Consistent icons | |
| **EventSource** | The browser's built-in SSE client | Receives the live scan events | |
| **Fonts** | *Press Start 2P* (titles) and *VT323* (body), loaded from Google Fonts | The pixel look | Offline they fall back to a monospace font. |
| **Pixel-art banner** | Scenery PNGs generated by `scripts/make_hero_art.py` (Pillow + numpy, dev-only) and an SVG wordmark drawn from code (`PixelTitle.tsx`) | The theme: cream paper, black pixel title with a lime shadow, a golden tree, ruins and a resting knight. All the decoration lives in the banner, so the working panels stay readable. | The banner can be hidden with the chevron in the toolbar. |

### AI and delivery

| Tool | What it is | Notes |
|---|---|---|
| **OpenRouter** | One API and key that fronts many models, including free ones | Used first if a key is set. Auto-discovers free models. |
| **Google Gemini** | Google's models | Used next if its key is set |
| **GitHub Actions + Pages** | GitHub's build runner and free static hosting | The hosted demo replays recorded real runs with no backend (needs Pages enabled once) |
| **OWASP API Security Top 10** | The reference list of API risks | BOLA is API1:2023 |

---

## Part 5: Q&A bank

### The danger list (one-line answers to the twelve hardest questions)

| # | Question | One-line answer | Full answer |
|---|---|---|---|
| 1 | "Why not just use JWT?" | JWT proves who you are; BOLA is about which records you may open. | Q1 |
| 2 | "Anyone can build this with AI." | The code is the easy part; the method, the proof standard and the honest measurement aren't. | Q9 |
| 3 | "Does it work on my API?" | Not yet. Today it targets our demo API; making the target configurable is the next step. | Q36 |
| 4 | "Is your benchmark rigged?" | It's our own target, so it proves the method, not real-world accuracy. | Q29 |
| 5 | "If you test every route anyway, why a graph?" | The graph finds the ID, picks the control route, orders the tests and explains each result; it doesn't yet shrink the test set. | Q20 |
| 6 | "Is the dry run what actually runs?" | It's a preview of the plan's shape; the live scan sends fewer requests. | Q28 |
| 7 | "How accurate is it?" | 6 of 6 with zero false alarms on our benchmark; unmeasured elsewhere. | Q30 |
| 8 | "Is the AI patch verified?" | No. We only verify that the built-in fixed version removes the finding. | Q11 |
| 9 | "What does confidence 0.65 mean?" | A heuristic score from the evidence source, not a probability. | Q23 |
| 10 | "What about roles, OAuth, GraphQL?" | Not covered. | Q38 |
| 11 | "Is it safe to run?" | Guardrails exist (allowlist, budget, mutation gate), but it does create test data. | Q32, Q33 |
| 12 | "Is it more efficient than a basic scanner?" | No, it sends more requests; it finds more. | Q31 |

### A. Problem and value

**Q1. Why would anyone need this? If I use JWT auth, isn't my API secure?**
**Say:** "JWT tells the server *who is calling*. BOLA happens *after* that, when the server decides which record to return. User B has a perfectly valid token and asks for user A's record. If the code forgets to check that the record belongs to B, it returns it. Every attack in our demo uses a valid, logged-in user."
**If they push:** "Authentication is the keycard working. Authorization is the card opening only your room. Fixing one doesn't fix the other."

**Q2. Can't developers just add an ownership check to every route?**
**Say:** "Yes, and they should. The problem is *remembering* it on every route, from every developer, across every release. APIGuard is the regression test that catches the one somebody forgot."

**Q3. Why not hire a penetration tester?**
**Say:** "Pentesters are valuable and we're not replacing them. But a pentest is a snapshot, usually once or twice a year, and new routes ship weekly. An automated check can run on every change, and it also frees the human to look at the harder logic bugs."

**Q4. How is this different from OWASP ZAP, Burp Suite or Postman tests?**
**Say:** "Those are general tools, and they *can* test authorization, but you have to set it up: log in as two users, write the rules, and decide what counts as a violation. Burp extensions like Autorize help but still need a human driving. APIGuard automates the two-user workflow end to end and uses the API's structure to decide what to test next. We cover a gap rather than replace them."
**Careful:** don't say they "can't" do it. Say they need manual configuration.

**Q5. Who is the customer?**
**Say:** "Teams that build REST APIs and have an OpenAPI file: first as a CI check ('fail the build if a new route lets another tenant read data'), second as a pre-pentest sweep for security consultants."

**Q6. Isn't this just an IDOR checker? Those already exist.**
**Say:** "Simple IDOR checks swap IDs and look at status codes. Two things we do differently: we judge by *whether the owner's private values appear* in the attacker's response, which cuts false alarms, and we use the API's structure to reach routes like `/export` that sit next to a protected route. The honest caveat: our current benchmark is on a demo API, so we've proven the method, not the real-world numbers."

**Q7. Why now? Is there a market?**
**Say:** "APIs are how most software talks to itself, and authorization flaws are the category automated tools handle worst. There are API security platforms (Salt, Akamai's Noname, 42Crunch) and DAST tools. Many focus on traffic monitoring or schema conformance. Our angle is an open-source, auditable, deterministic tester you can run locally and in CI."

### B. Novelty and AI

**Q8. Did you use AI to build this?**
**Say (edit to match what really happened):** "Yes. [FILL IN: which tool, what for, for example Claude Code for implementation speed, code review and the UI]. The decisions that matter are mine [or ours]: judging leaks by response comparison instead of status codes, building decoys to test false alarms, measuring against a hidden answer key, and keeping AI out of detection. I can walk through any file."
**Careful:** don't claim you hand-wrote everything if you didn't, and don't hide that AI helped. Judges respect honesty and can usually tell. If you say "I can walk through any file", use Part 3.9 so it's true.

**Q9. If AI can generate code, why is this something anyone can make?**
**Say:** "Anyone can generate *code*. What's hard is knowing what counts as a real finding, how to avoid false alarms, how to measure honestly, and where *not* to use AI. We kept it out of detection because a hallucinated finding in a security tool is worse than none. Those choices came from understanding the problem, not from typing speed."

**Q10. Is the scanner itself powered by an LLM?**
**Say:** "No. Zero LLM calls in scanning. Graph building, rule inference, test planning and verification are ordinary deterministic code. Same input, same output, which is what you want from a security tool. The model is only used after a bug is already proven, to draft a fix."

**Q11. How do you know the AI-generated patch is correct?**
**Say:** "We don't claim it is. It's a suggestion for a developer to review. What we *do* verify is that a correct fix removes the finding: the 'Apply reference fix' button switches our demo API to its built-in fixed version and re-scans, and the leak disappears. We never auto-apply the model's patch."

**Q12. Does the LLM see sensitive data?**
**Say:** "Only finding metadata: route, method, resource type and the *names* of leaked fields. Not the response bodies, not tokens."

**Q13. Which model do you use?**
**Say:** "It's configurable. OpenRouter first (it can auto-pick a free model), then Gemini, then a cached real answer, then a clearly labelled offline template. [FILL IN which one you actually demoed.] The scanner doesn't depend on any model."

### C. How it works

**Q14. Walk me through a scan in 60 seconds.**
**Say:** "We read the OpenAPI file and build a graph of how routes relate. We log in as two test users. The owner creates a real record and we keep its ID. We read it as the owner (expect success) and as the attacker (expect 'forbidden'). If that holds, we've learned the rule 'owner only' and we test the neighbouring routes, like export and summary, the same way. For each one we compare the owner's response with the attacker's. If the attacker's response contains the owner's private values, that's a confirmed leak, and we save both responses and a command to reproduce it."

**Q15. What did you use to implement the graph?**
**Say:** "A small custom class in Python, `ResourceGraph`, not a graph library. It stores typed nodes (operation, identifier, resource) and typed edges (`PRODUCES`, `CONSUMES`, `NESTED_UNDER`, `OPERATES_ON`), each with a confidence and a provenance. It finds the shortest connection between two routes with a breadth-first search, which is what we show as the 'graph path' in a finding. On the screen, React Flow draws it and a library called dagre positions the boxes."
**If they push ("why not networkx?"):** "Our graph has a few dozen nodes and domain-specific rules, so a small class was simpler than adopting a general library. At large scale we'd reconsider."

**Q16. Is it really a DAG?**
**Say:** "For the relationships we use (creates, uses, sits under) there are no loops in the demo API, so yes. We don't currently check for cycles on arbitrary specs; that would be added before real-world use."

**Q17. How do you work out which route is a producer and which is a consumer?**
**Say:** "From the spec. A `POST` on a collection with no ID in the path (like `POST /projects`) is treated as the producer of a project ID. A path placeholder such as `{project_id}` is matched to it by name. Nested routes are found because their path starts with a parent's path. It's name-matching heuristics, and edges are labelled with where the evidence came from."

**Q18. What does "harvesting" mean? Why not just guess IDs?**
**Say:** "Harvesting means creating a real record as the owner and reading its ID from the response. Guessed IDs mostly hit 'not found', which tells you nothing about authorization. A real ID plus a second user gives a meaningful test."

**Q19. How does the tool learn a "rule"?**
**Say:** "By observation. If the owner gets 200 and the attacker gets 401, 403 or 404 on the same record, the engine records the hypothesis 'owner only' for that route, with confidence 0.85."

**Q20. How does propagation work, and does it decide what gets tested?**
**Say:** "After we learn 'owner only' on the main route, we hand that rule to the routes next to it in the graph, the ones nested under it, as candidate hypotheses with lower confidence. Then we test the other routes that take an ID, and each result carries the hypothesis that explains why it was tested."
**If they push ("so is the graph just decoration?"):** "Not decoration: it finds the producer and the ID to use, chooses the control route, orders the tests (reads first, deletes last) and produces the explanation and confidence for each finding. But I'll be straight: in the current version, every route with an ID is tested, not only graph neighbours, so propagation doesn't yet shrink the test set. Its payoff would grow with API size, where you'd want to prioritise. We haven't measured that yet."

**Q21. How exactly does the verifier decide a leak is real?**
**Say:** "It takes the owner's response, collects every non-empty value stored under sensitive-sounding keys (email, billing, card, budget, secret and so on), and checks whether those exact values appear in the attacker's response. If yes, confirmed. If the attacker got 200 but none match, it's only 'likely'. If the body is empty, it's 'potential'. If the owner's own request failed, it's 'inconclusive'. A table is in Part 3.3."

**Q22. What are the "traps"?**
**Say:** "Decoys we built into the demo API to test ourselves. `/summary` returns 200 with an empty body to non-owners, which fools a status-code scanner. `/members` is listed in the spec but not implemented, so even the owner gets 404; we report 'unsure', never 'secure'. A test for each is in the test suite."
**Careful:** the third decoy, `/audit-log`, exists on the demo server but isn't in the spec, so the scanner never visits it. Don't list it as one the scan exercises.

**Q23. What does "confidence 0.65" mean?**
**Say:** "It's a heuristic score based on where our evidence came from, not a statistical probability. A rule we saw directly starts at 0.75, one we inferred from a neighbour starts at 0.50, and a confirmed leak adds 0.15. So a confirmed leak on an inferred rule shows 0.65."

**Q24. How is severity decided?**
**Say:** "A simple rule: CRITICAL if a leaked field is billing, card or secret data, otherwise HIGH. It's not CVSS scoring."
**Careful:** the exported report no longer prints a CVSS number. Severity is only the simple rule above, so don't call it a CVSS score.

**Q25. Why two users and not one?**
**Say:** "Authorization is a relationship between a user and a record, so one user can't test it. We need an owner to create the record and a second, unrelated user to try to reach it."

**Q26. What are "control" and "probe"?**
**Say:** "The *control* is the owner's request, which proves the route works and gives us the owner's real data to compare against. The *probe* is the attacker's request to the same record. If the control fails, we call the result inconclusive instead of guessing."

**Q27. What other roles does it test? There's an admin and a support user.**
**Say:** "The demo API has admin and support users that are *allowed* to read any project, to show legitimate exceptions exist. The scanner uses only the owner and the attacker, so role-based bugs (for example a support user who shouldn't have access) aren't covered yet."

**Q28. Is the dry-run table exactly what will run?**
**Say:** "It's a preview of the plan's structure: create, control, probe for each route, with nothing sent. The live scan is a bit leaner, because it creates one record and reuses it, so it sends fewer requests. In the demo the table lists 12 steps and the live scan sends 8."

**Q29. How did you measure the benchmark? Isn't it rigged because you built the target?**
**Say:** "Fair question. The target is ours, with five versions: direct bug, indirect export bug, update bug, all three, and a fully fixed one. The answer key sits in separate files the scanner never reads. Results: APIGuard 6 of 6 with no false alarms; a rules-only baseline 4 of 6, missing the export route. The honest limit is that this proves the method on a controlled case. It doesn't tell you the real-world hit rate, and we say so."

**Q30. How accurate is it? What's the false-positive rate?**
**Say:** "On our benchmark: all six planted bugs found and zero false alarms on the fixed version. We haven't measured on third-party APIs, so we don't claim a general number. A false alarm could happen if a response legitimately contains a value that also appears in the owner's data under a sensitive-sounding key."

**Q31. Is it more efficient than a simple scanner?**
**Say:** "No, and I wouldn't claim it. On single-bug variants it used 15 requests against 7, because it also tests the routes the simple scanner skips. More coverage, more requests."

**Q32. How do you stop it damaging a real system?**
**Say:** "All traffic passes through one class, `SafeExecutor`. It enforces a host allowlist (loopback only by default), a total and per-route request budget, a response size cap, a timeout, secret redaction, and a mutation gate that blocks PATCH and DELETE unless switched on. Deletes run last, on a throwaway record."

**Q33. Does the scan change data?**
**Say:** "Yes, a little. Even in the default mode it creates one test project as the owner and leaves it. With Mutations enabled it edits that project and creates and deletes a second one. Use it on test environments."

**Q34. How does the live streaming work, and why that approach?**
**Say:** "The scanner pushes events into an in-memory queue, and a server-sent-events endpoint streams them to the browser, which colours graph nodes as events arrive. We chose SSE over WebSockets because we only need one-way updates, and it's simpler and reconnects by itself."

**Q35. Are the HTTP requests real? Or is it all mocked?**
**Say:** "Real requests, no mocks: genuine HTTP requests with real headers, handled by the real target application code. In the UI scan and the benchmark they're delivered in-process, with no network socket. The integration tests start a real server on a real port and run the same scanner against it."
**Careful:** the README now says this accurately too: in-process in the dashboard and benchmark, real sockets in the integration tests and the command-line tool.

**Q36. Does it work on any API?**
**Say:** "Not yet. Today the target address is fixed to the bundled demo API, and some details are tuned to it: the create-record body, the resource name and the owner field. Importing another spec changes which operations are listed but they'd still run against the demo. Making the target address, login flow and request bodies configurable is the next milestone."

**Q37. What happens if a route needs another record that itself needs a record (a chain)?**
**Say:** "Today we handle one level: find the route that creates the ID and create one record. Deeper chains aren't built yet. If we can't create the prerequisite, the test is skipped or reported inconclusive instead of guessed."

**Q38. What does it miss?**
**Say:**
- Rules beyond simple ownership (teams, sharing, time windows, roles).
- IDs that travel in the request body or query string rather than the URL path.
- Leaks in fields our key-name list doesn't recognise (those come out as 'likely', which the UI doesn't show yet).
- APIs without OpenAPI, GraphQL, and logins other than a simple username/password endpoint.
- Bugs in routes missing from the spec.

**Q39. How would it scale to hundreds of routes?**
**Say:** "Untested. Each route costs about three requests, so the request budget (30 by default) would need raising, and the graph search would be re-run per route, which is fine at that size. The plan would be to prioritise by graph structure. We haven't benchmarked it, so we're not claiming anything."

**Q40. How fast is it?**
**Say:** "The demo API answers in about a millisecond per request, so a scan finishes in a second or two (most of that is saving events to the database). On a real system, speed depends on that system's latency and the budget. The live replay in the hosted demo is deliberately slowed so people can watch."

**Q41. What's stored, and where?**
**Say:** "In a local SQLite file: scans, the event log, findings (including both response bodies) and remediation attempts. It's git-ignored and local. Treat it as sensitive, since findings contain leaked data."

**Q42. What do your tests cover?**
**Say:** "22 tests: graph building and the producer/consumer lookup; spec parsing and `$ref` resolution; the verifier (including a test with completely different data to prove nothing is hardcoded, plus the empty-body and denied traps and the failed-control case); the safety gate (allowlist, budgets, redaction); the planner; the policy evaluator; the confidence scoring; and integration tests that start a real server and run full scans for each defect and the patched case."

### D. Technology choices

**Q43. Why FastAPI, React and SQLite?**
**Say:** "FastAPI: typed, async, and auto-generates OpenAPI, and it's what many of our target users write. React with React Flow: the best fit for an interactive graph. SQLite: zero setup for a local security tool. These are choices for speed and a clean demo, not claims about scale."

**Q44. Why the Elden Ring-inspired pixel theme?**
**Say (use your real reason):** "[FILL IN]. A suggested one: the game is about finding hidden paths, which is what our tool does in APIs, and it makes the product memorable. We kept it readable on purpose: all the scenery lives in the banner at the top, and the panels below are plain cream with dark text (the banner can be hidden with one click). It uses the same stack (Tailwind colour tokens, two web fonts, an SVG wordmark) plus a few pixel-art images generated by a small script, with no extra libraries in the app. The colours carry meaning: blue is setup, green is safe, crimson is a leak, grey is unsure."

**Q45. Why did you hide parts of the graph?**
**Say:** "The full graph has 18 edges, but most only restate what's already obvious from the route paths. Drawing them made the picture unreadable, so we draw the 7 that carry information. Nothing is removed from the analysis."

### E. Security and ethics

**Q46. Could an attacker misuse this?**
**Say:** "It's a security testing tool, like ZAP or Burp, and it needs valid test credentials for two accounts, so it only works against systems where you already have accounts. By default it refuses to talk to anything but localhost. Testing systems you don't own or lack permission to test can be illegal, so it should only ever be used with authorisation."

**Q47. Is the tool itself secure?**
**Say:** "It's a prototype and it's local-first. We fixed issues in review: report text from the spec is escaped so it can't inject script, and cross-origin access is limited to the local UI. The backend has no login of its own, so don't expose it beyond localhost."

**Q48. What about privacy of the leaked data it finds?**
**Say:** "Evidence is stored locally. Tokens are redacted in logs and the UI, and the AI step only receives field names. If you point it at a real staging system, the findings database would hold real data, so protect that file."

### F. Product and future

**Q49. What would you build with another month?**
**Say:**
1. A configurable target (base URL, login flow, ID fields).
2. Build create-request bodies from the spec's schemas instead of fixed ones. The parser already resolves schemas; the scanner doesn't use them yet.
3. IDs in bodies and query strings, and team or organisation rules.
4. CI mode: a CLI that returns a failing exit code on a confirmed finding, plus a GitHub Action. A basic CLI exists (`python -m app.engine.cli scan`), but it always exits 0 and uses the demo spec.
5. Benchmarks on public intentionally vulnerable APIs (crAPI, VAmPI), with an honest comparison against ZAP and Autorize.
6. A "test every route" brute-force baseline, to measure exactly what the graph adds.

**Q50. How would this make money, or be sustained?**
**Say:** "Open-source core for trust. Paid features for teams: CI integrations, dashboards, history and trends, compliance-ready reports."

**Q51. Why will this still matter in a year?**
**Say:** "APIs keep multiplying, and authorization logic is the part automated tools handle worst. A deterministic, explainable tester that fits in CI stays useful whatever the AI trend is."

### G. Process and team

**Q52. How long did it take, and what was hardest?**
**Say:** "[FILL IN]. Candidates for 'hardest': deciding when a 200 counts as a leak (the verifier), avoiding false alarms (the decoys), and being honest about what the benchmark proves."

**Q53. Who did what?**
**Say:** "[FILL IN: who built the engine, the UI, the benchmark, the docs]."

**Q54. What did you learn / what surprised you?**
**Say (examples to adapt):** "How easy it is for a route next to a protected one to be forgotten; and that measuring honestly is harder than building."

**Q55. What would you do differently?**
**Say:** "Make the target configurable from day one, and include a brute-force baseline so we could say exactly how much the graph adds."

### H. Curveballs

**Q56. "Run it on my API right now."**
**Say:** "Honestly, not live today: the scanner is wired to our demo API. If you give me your OpenAPI file I can show the graph it builds from it, and I can walk through what we'd need to configure to scan it for real."
(Import via the upload button in the Spec panel. The graph updates. Scanning would still hit the demo target.)

**Q57. "Show me the code for X."**
Open the file and use Part 3.9. If you don't know a part, say what you do know and offer to follow up.

**Q58. "What if two users share a record legitimately?"**
**Say:** "Then 'attacker gets the owner's data' is expected, and we'd report a false alarm. That's why the rule is only 'owner only' for now, and why sharing and team rules are on the roadmap."

**Q59. "What if the server returns 404 to hide the record from non-owners?"**
**Say:** "We treat 401, 403 and 404 as proper denials when the owner can read the same record. That's the standard 'hide that it exists' pattern."

**Q60. "What if you don't know the answer?"**
**Say:** "I don't know that yet. Here's how I'd find out: [one concrete step]." Never invent a number or a capability. A short honest answer beats a long wrong one.

---

## Part 6: Where the slogans are bigger than the code

This is the table judges are most likely to find holes in. Read it twice. The right-hand column is what to say instead.

| # | The slogan says | What the code actually does | Say instead |
|---|---|---|---|
| 1 | "Propagates the rule to related routes" | Propagation attaches hypotheses to adjacent routes, and turns on the neighbour-testing stage. Every route with an ID is tested regardless. | "The graph supplies the ID, the order and the explanation; it doesn't yet narrow the test set." |
| 2 | Benchmark implies a graph advantage | Graph used 15 requests vs 7. The baseline only tests routes it has a rule for. No brute-force baseline exists. | "We find more; we don't claim to be cheaper. The fair comparison is the oracle row." |
| 3 | "Propagation OFF" ablation | It switches off the entire neighbour-testing stage. | "It shows that stage is needed, not that rule knowledge alone is what helps." |
| 4 | Dry-run table = the plan | A preview: it plans a setup per route (12 steps) vs 8 live requests. | "A preview of the plan's shape." |
| 5 | "Scans your API" | Target URL is hard-coded to the demo; resource name, owner field and create body are fixed. | "Prototype against a demo API; configurable targets are next." |
| 6 | "Confidence" | A heuristic from the evidence source, not a probability. | "A heuristic score." |
| 7 | Request bodies come from the spec | Create bodies are hard-coded. `$ref`s are resolved by the parser, but the scanner doesn't use schemas. | "Next step: generate bodies from the spec's schemas." |
| 8 | All results are shown | `LIKELY` results (200 but no known sensitive field) aren't surfaced in the UI. | "We show confirmed findings; likely ones are a gap." |
| 9 | "Multi-step dependencies" | One level only (a single producer). | "One level today." |
| 10 | "Safe by default" | Setup writes a test record, and it isn't cleaned up (the throwaway DELETE-test record is). | "Guarded, but it does create test data." |
| 11 | "Apply reference fix" fixes it | It flips the demo target to patched mode. It doesn't run the AI patch. | "Shows what a correct fix achieves." |
| 12 | Hosted demo | A replay of recorded real runs, with no backend; needs GitHub Pages enabled once. Imports and model tests are disabled there. | "A recorded replay; run it locally for the real thing." |

**Already fixed in the repo on 2026-10-31** (you may still hear the old wording, so know it was wrong):

- The README said requests use "real network sockets". It now says: in-process in the dashboard and benchmark, real sockets in the integration tests and CLI.
- "Real signed bearer tokens" and a `bearerFormat: JWT` label. The demo uses opaque fixed tokens.
- The header **Dry run** toggle did nothing on live scans. It now makes the main button preview the plan.
- The exported report printed "CVSS: 8.5" and a fixed "0.0% false positive rate". Both are gone.
- The report counted all 11 graph nodes as "endpoints". It now counts the 8 operations.
- The benchmark's "time to first finding" was really total time divided by findings. It's now labelled "Avg ms / finding".
- The benchmark panel's request-count note was typed in (13.0 vs 7.0). It now quotes the measured numbers (15.0 vs 7.0).
- `docs/DEMO_SCRIPT.md` had old button names, "20 tests" and a "BFS topological chain" claim. It was rewritten.
- A test docstring and the `/audit-log` route comment implied the scan exercises `/audit-log`. It isn't in the spec, so it never does.

---

## Part 7: Cheat sheets and checklists

### Numbers to know

| Fact | Value |
|---|---|
| OWASP ranking | API Security Top 10, **API1:2023**, BOLA |
| Operations in the demo spec | **8** |
| Graph | **11 nodes**, **18 edges** (7 drawn) |
| Seeded users | 4 (owner Aman, attacker Taaran, admin, support) |
| Benchmark | 5 variants, **6** planted bugs |
| Results | APIGuard **6/6**, baseline **4/6**, **0** false alarms |
| Requests per scan | ~8 shown in the stream (about 10 sent including a re-check); ~15 with Mutations on; baseline 7 |
| Ablation on variant B | Full 1/1 (15 req), propagation off 0/1 (6), oracle 1/1 (9) |
| Request budget | 30 per scan, 6 per route, 5 s timeout, 500 KB cap |
| Confidence starts | observed 0.75, propagated 0.50, schema 0.80, documented 0.85, heuristic 0.35 |
| Typical finding | confidence 0.65, severity CRITICAL |
| Tests | **22** |
| Scanner AI calls | **0** |

### Say / don't say

**Say**
- "Detection is deterministic. AI only drafts the fix."
- "We confirm a leak by comparing the owner's private values in the attacker's response, not by status code."
- "Here is where it falls short." (Then give one real limit.)
- "I can walk you through any part."

**Don't say**
- "100% accurate", or "zero false positives" without "on our benchmark".
- "Works on any API." It works on the demo target today.
- "Replaces pentesters, ZAP or Burp."
- "AI-powered scanner." It isn't.
- "More efficient" or "faster". It uses more requests.
- "Real network sockets" for the UI scan.

### How to answer a question you can't answer

1. Restate it in your own words (buys time).
2. Say what you *do* know that's related.
3. Say "I don't know that yet" plainly, and what you'd do to find out.
4. Never invent a number or a feature.

### Before you present

- [ ] Search this file for `FILL IN` and replace each one.
- [ ] Decide your honest answer to "did you use AI?" (Q8).
- [ ] Start both servers; open `http://127.0.0.1:5173`; click reset; run the full demo twice.
- [ ] Practise the 3-minute script out loud with a timer.
- [ ] Re-read Part 6.
- [ ] Optional: enable GitHub Pages (repo Settings, Pages, Source: GitHub Actions) and re-run the workflow, so the replay link in 1.6 works.
- [ ] Have `docs/screenshots/` open in another tab as a backup.
- [ ] Check the browser zoom is 100% and notifications are off.
- [ ] If you want a live AI answer, put a key in `backend/.env` and click the model test in the remediation window beforehand. Otherwise expect the labelled offline template.

---

## Part 8: Glossary A to Z

| Term | Meaning |
|---|---|
| **Ablation** | Removing one part of a system to see what it contributed. |
| **API** | Application Programming Interface: how programs talk to a service. |
| **ASGI** | The standard interface between Python async servers and apps; also lets a client call an app in-process. |
| **async / asyncio** | Python's way of handling many waiting tasks without blocking. |
| **Attacker (probe) identity** | The second test user (Taaran) who tries to reach the owner's record. |
| **Authentication** | Proving who you are. |
| **Authorization** | Deciding what you may access. |
| **Baseline** | A simpler method you compare against. |
| **Bearer token** | A secret string sent in the `Authorization` header; whoever holds it is treated as that user. |
| **Benchmark** | A repeatable test against a known answer key. |
| **BFS (breadth-first search)** | A way of exploring a graph level by level; we use it to find the shortest connection between two routes. |
| **BOLA** | Broken Object Level Authorization: a server returns a record to someone who shouldn't have it. |
| **Budget (request budget)** | A cap on how many requests a scan may send. |
| **CI (continuous integration)** | Automatic checks that run on every code change. |
| **Confidence** | Our heuristic score for how well-supported a rule or finding is. |
| **Control** | The owner's request, used as the "this works normally" reference. |
| **CORS** | A browser rule that stops one website calling another site's API unless that API allows it. We restrict it to the local UI. |
| **cURL** | A command-line tool that sends one HTTP request; used for reproduction steps. |
| **DAG** | Directed Acyclic Graph: arrows, with no loops. |
| **DAST** | Testing a running app from the outside. |
| **Dagre** | A library that arranges a directed graph into layers for drawing. |
| **Differential testing** | Sending the same request as two users and comparing responses. |
| **Dry run** | A preview of the test plan without sending traffic. |
| **Edge / node** | A line / a dot in a graph. |
| **Endpoint / route** | One API address plus method. |
| **EventSource** | The browser's built-in SSE client. |
| **FastAPI** | A Python web framework (async, typed, auto-generates OpenAPI). |
| **False negative / positive** | A missed bug / a false alarm. |
| **Fuzzing** | Sending lots of random or malformed input. |
| **Gemini** | Google's family of AI models. |
| **Graph path** | The chain of connections from the route we learned a rule on to the route a finding was found on. |
| **Ground truth** | The answer key listing the bugs that are really there. |
| **Hallucination** | An AI stating something false confidently. |
| **Harvest** | Creating a real record as the owner and keeping its ID. |
| **Header** | A labelled piece of extra information on a request or response (like `Authorization`). |
| **HTTP** | The request/response protocol of the web. |
| **httpx** | A Python HTTP client library with async support. |
| **Hypothesis** | A candidate rule ("this route is owner-only") that we then test. |
| **Identifier node** | A graph node for an ID that one route creates and others use. |
| **IDOR** | Insecure Direct Object Reference: an older name for the same bug family as BOLA. |
| **In-process** | Calling code directly inside the same program, with no network. |
| **Inconclusive** | We can't judge, because the owner's control request failed. |
| **JSON** | A text format for structured data. |
| **JWT** | JSON Web Token: a signed token format. Our demo uses simpler fixed tokens. |
| **LLM** | Large language model: AI that predicts text. |
| **Mutation (mutating request)** | A request that changes data: POST, PUT, PATCH, DELETE. |
| **Mutation gate** | Our guard that blocks mutating requests unless switched on. |
| **Multi-tenant** | One system serving many separate customers. |
| **Oracle baseline** | The baseline given a hand-written rule for every route. |
| **OpenAPI** | A standard file format that describes an API's routes, inputs and outputs. |
| **OpenRouter** | A service giving one API for many AI models. |
| **OWASP** | A non-profit that publishes security guidance, including the API Top 10. |
| **Owner identity** | The first test user (Aman) who creates the record. |
| **Path parameter** | A placeholder in a URL such as `{project_id}`. |
| **Pentest** | A human security expert attacking a system with permission. |
| **Policy / rule** | A statement of who may do what, such as "owner only". |
| **Precision** | Real bugs ÷ alarms raised. |
| **Probe** | The attacker's request. |
| **Producer / consumer** | A route that creates an ID / a route that needs it. |
| **Prompt** | Instructions sent to an AI model. |
| **Propagation** | Handing a learned rule to related routes as a hypothesis. |
| **Provenance** | Where a fact came from (schema, observed, propagated, and so on). |
| **Pydantic** | A Python library for typed data models and validation. |
| **pytest** | A Python test framework. |
| **React / React Flow** | A UI library / a diagram library built on it. |
| **Recall** | Real bugs found ÷ real bugs that exist. |
| **Redaction** | Hiding secrets (shown as `[REDACTED]`). |
| **Regression test** | A test that makes sure an old mistake doesn't come back. |
| **Remediation** | Fixing a bug; here, the AI-drafted suggested fix and test. |
| **Schema** | A description of the shape of data. |
| **Seed data** | Pre-loaded test users and records. |
| **SAST** | Analysing source code without running it. |
| **SSE** | Server-Sent Events: the server pushes live updates to the browser. |
| **Staging** | A safe test copy of an app. |
| **Status code** | The three-digit result of an HTTP request (200, 403, 404). |
| **SQLite (WAL)** | An embedded file database; WAL mode allows reading while writing. |
| **Swagger** | The former name of OpenAPI. |
| **Tailwind CSS** | A utility-class styling system. |
| **Tenant** | One customer of a multi-customer system. |
| **Token** | A string proving you logged in. |
| **Trap (verifier trap)** | A decoy route that tests whether the tool raises false alarms. |
| **TypeScript** | JavaScript with types. |
| **Variant** | One version of the demo API with a specific set of planted bugs. |
| **Verifier** | The component that compares owner and attacker responses and decides if a leak is real. |
| **Vite** | A fast frontend dev server and bundler. |
| **YAML** | A human-friendly text format for structured data, common for OpenAPI files. |

---

*Pitch notes: practise the demo end to end twice. If something in this file doesn't match what you see on screen, trust the screen and fix the file.*
