# Hwise — healthcare software requirements and SDLC assistant

Hwise is a local-first [Mastra](https://mastra.ai/) TypeScript application that profiles a healthcare software project brief, compares software development lifecycle (SDLC) options using a source-linked corpus of public healthcare software development evidence, and exports formatted Markdown and HTML reports.

Hwise is **not** a clinical decision-support system. It does not provide diagnosis, treatment, triage, or patient-specific medical advice, and it does not make legal, regulatory, clinical-safety, or compliance determinations. Its dataset describes what selected projects publicly document; it does not establish undocumented practices or prescribe a lifecycle for a new product.

## What is included

- `src/mastra/healthcare-agents.ts` — `healthcareRequirementsAgent` (`maxOutputTokens: 1,800`) and `healthcareSdlcRecommendationAgent` (`maxOutputTokens: 2,200`), both wired to the BM25 RAG input processor.
- `src/mastra/healthcare-prompts.ts` — healthcare-specific instructions (`/no_think`-prefixed), required Markdown sections, evidence separation rules, and `NEEDS-VALIDATION` boundaries.
- `src/mastra/healthcare-workflow.ts` — Mastra workflow (`healthcare-requirements-then-sdlc`) and programmatic runner (`runHealthcareRequirementsThenSdlc`) that execute requirements profiling, SDLC recommendation, and preview generation while stripping `<think>...</think>` reasoning blocks via `cleanModelText`.
- `src/mastra/healthcare-preview.ts` — normalizes generated Markdown (`formatHealthcareMarkdown`: aligned pipe tables, canonical `##` headings, consistent lists and spacing) and renders a self-contained HTML report (`renderHealthcareHtml`) with a table of contents, status badges (`NEEDS-VALIDATION`, `Critical`, `High`, `Medium`, `Low`), and print styling under `artifacts/hwise-healthcare-sdlc/`.
- `src/mastra/healthcare-rag.ts` and `src/mastra/hwise-workspace.ts` — read-only `LocalFilesystem` workspace (`tools: { enabled: false }`) with BM25 retrieval over `docs/ingested/healthcare/**/*.md` (`TOP_K = 5` across 3 queries: the user brief plus fixed SDLC and healthcare domain queries, deduplicated and capped at `8` unique chunks of up to `1,400` characters per agent call). Startup checks corpus searchability via `assertHealthcareCorpusSearchable`.
- `src/mastra/hwise-model.ts` — OpenAI-compatible LM Studio client (`@ai-sdk/openai-compatible`) with extended 20-minute `undici` `headersTimeout`/`bodyTimeout` for local CPU inference; defaults to `qwen/qwen3-4b`.
- `src/mastra/hwise-coordinator.ts` and `src/mastra/index.ts` — `hwiseCoordinator` agent (`maxOutputTokens: 500`), LibSQL storage (`hwise-storage`), workspace initialization, and Mastra registration.
- `docs/ingested/healthcare/healthcare-software-sdlc.md` — retrieval-ready evidence corpus.
- `docs/ingested/healthcare/healthcare-sdlc-dataset.json` — the canonical structured dataset used to produce the corpus.

## How the workflow works

`healthcare-requirements-then-sdlc` uses an LLM-reasoned, two-stage pipeline rather than a hardcoded scoring table:

1. **`profile-healthcare-requirements`**: Turns the project brief (`{ prompt }`) into a structured Markdown requirements profile with sections for `Summary`, `Assumptions`, `Stakeholders`, `Product context`, `Requirements` (ID, category, statement, priority, acceptance criteria, verification method, evidence/assumption, confidence), `Decision factors` (requirement stability, intended users and care setting, clinical-safety impact, privacy/security risk, jurisdiction, interoperability, technical uncertainty, expected change frequency, deployment model, testing/documentation formality, budget/schedule, failure consequences, and approvals), `Traceability`, `Risks`, and `Open questions`, tagging unknowns `NEEDS-VALIDATION`.
2. **`recommend-healthcare-sdlc`**: Evaluates the requirements profile against candidate approaches (iterative, sequential, V-Model, risk-driven/Spiral, DevSecOps, and hybrids) and produces `Decision factors`, `Ranked recommendations` (at least three options with heuristic scores, strengths, weaknesses, and reversal conditions), `Recommended SDLC`, `Project-specific workflow` (activities, roles, deliverables, gates, entry/exit criteria, and requirement IDs), `Evidence and traceability`, `Human approvals`, and `Residual risk and validation plan`. Corpus projects are cited only as comparative public evidence.
3. **`write-hwise-healthcare-previews`**: Formats the combined Markdown document and writes `artifacts/hwise-healthcare-sdlc/latest.md` and `artifacts/hwise-healthcare-sdlc/latest.html` (overwriting `latest.*` on each run).

### Workflow inputs, outputs, and agents

- **Workflow ID**: `healthcare-requirements-then-sdlc` (exported as `healthcareRequirementsThenSdlc`)
  - **Input schema**: `{ prompt: string }` (minimum 1 character)
  - **Output schema**: `{ requirements: string, sdlc: string, document: string, markdownPath: string, htmlPath: string }`
- **Registered agents**:
  - `hwiseCoordinator` (`hwise-coordinator`) — explains Hwise's scope and corpus limitations and directs callers to run `healthcare-requirements-then-sdlc` (it does not execute the workflow itself).
  - `healthcareRequirementsAgent` (`hwise-healthcare-requirements-agent`) — Stage 1 requirements profiling agent.
  - `healthcareSdlcRecommendationAgent` (`hwise-healthcare-sdlc-agent`) — Stage 2 SDLC comparison and recommendation agent.

## Requirements and setup

- **Node.js**: `>=22.22.0`
- **Local LLM server**: [LM Studio](https://lmstudio.ai/) (or another OpenAI-compatible chat completions endpoint). In LM Studio, download and load `qwen/qwen3-4b` and start the local server on port `1234`.

Install dependencies, configure environment variables, and start Mastra Studio:

```sh
cp .env.example .env
npm install
npm run dev
```

In Mastra Studio, select the `healthcare-requirements-then-sdlc` workflow and submit a healthcare software project brief in `prompt`. The workflow returns the generated Markdown sections and the paths to `latest.md` and `latest.html`.

### Available scripts

```sh
npm run dev        # Start Mastra dev server and Studio (mastra dev)
npm run typecheck  # Run TypeScript type checks (tsc --noEmit)
npm run build      # Build the Mastra bundle (mastra build)
npm run check      # Run typecheck followed by build
npm run start      # Start the built Mastra server (mastra start)
```

> **Note:** Stop `mastra dev` before running `npm run build` or `npm run check`, since `mastra build` clears `.mastra/output`.

### Environment variables

Settings are defined in `.env.example`:

- `HWISE_LM_STUDIO_BASE_URL` — OpenAI-compatible API base URL (defaults to `http://127.0.0.1:1234/v1`).
- `HWISE_LM_STUDIO_API_KEY` — API key passed to the endpoint (defaults to LM Studio's placeholder `lm-studio`).
- `HWISE_LM_STUDIO_MODEL` — model catalog ID (defaults to `qwen/qwen3-4b`).
- `HWISE_MASTRA_DATABASE_URL` — LibSQL connection string for Mastra storage (defaults to `file:./hwise.db`, resolved by `mastra dev` under `src/mastra/public/`).
- `HWISE_WORKSPACE_ROOT` — root directory containing `docs/ingested/healthcare` (defaults to `.` / auto-detected workspace root; set this if launching Mastra from another working directory).

### Model and performance notes

- The model identifier must match the catalog ID served by LM Studio or your OpenAI-compatible server.
- Qwen3 4B supports thinking and non-thinking modes. Hwise prepends `/no_think` to agent system prompts and strips any `<think>...</think>` blocks via `cleanModelText`. If your LM Studio template still generates long thinking traces on CPU, disable thinking in LM Studio or switch `HWISE_LM_STUDIO_MODEL` to a non-thinking instruct build (such as `qwen/qwen3-4b-2507`).
- Running local 8B+ models on CPU-only hardware can take an hour or more across both workflow steps; `qwen/qwen3-4b` (or GPU/remote inference) is recommended on laptops without a dedicated GPU.

## Dataset handling

The indexed corpus in `docs/ingested/healthcare/` is a source-linked evidence corpus rather than a synthetic lifecycle catalog. It covers **8 projects and 30 primary-source page links**: OpenMRS, OpenEMR, DHIS2, Bahmni, GNU Health, SORMAS, OpenELIS Global, and HAPI FHIR (research date: `2026-10-05`).

The records distinguish explicit model labels from documented practices. Most reviewed primary sources do not name a formal SDLC, so Hwise preserves “Not explicitly stated in reviewed primary sources” and lists only the processes those sources describe. SORMAS’s sources name Gitflow as a development workflow; Hwise explicitly avoids presenting it as a complete end-to-end lifecycle. The corpus includes date/version context and limitations alongside primary source URLs.

The BM25 index searches the included Markdown corpus only (`docs/ingested/healthcare/**/*.md`), and server startup verifies that the index returns results. Any additions to the corpus should follow the same evidence discipline: project-maintained sources, source URLs, date/version context, and explicit limitations, without treating missing documentation as evidence that a project lacks a practice.

## Limitations and disclaimer

- Heuristic scores in `Ranked recommendations` are decision aids generated by the model, not measured probabilities, validated risk estimates, or clinical judgments.
- Generated reports and previews are **not** regulatory submissions, safety cases, or clinical validations; product-owner, clinical-safety, privacy, security, interoperability, regulatory/legal, and release-owner decisions require qualified human review.
- Do not include patient-identifiable information (PII/PHI) in project briefs passed to the workflow.

## Reference sources

- Mastra agent overview: https://mastra.ai/docs/agents/overview
- Mastra LM Studio provider notes: https://mastra.ai/models/providers/lmstudio
- LM Studio: https://lmstudio.ai/
- Healthcare project primary sources: see the links in `docs/ingested/healthcare/healthcare-software-sdlc.md` and `docs/ingested/healthcare/healthcare-sdlc-dataset.json`.

