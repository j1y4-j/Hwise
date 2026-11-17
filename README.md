# Hwise — healthcare software requirements and SDLC assistant

Hwise is a local-first Mastra TypeScript starter adapted to the agent/workflow structure in [SAI](https://github.com/Master9Wayne/SAI). It profiles a healthcare software brief, then compares lifecycle options using a small source-linked corpus of public healthcare software development evidence.

Hwise is **not** a clinical decision-support system. It does not provide patient-specific medical advice or make legal, regulatory, clinical-safety, or compliance determinations. Its dataset describes what selected projects publicly document; it does not establish undocumented practices or prescribe a lifecycle for a new product.

## What is included

- `src/mastra/healthcare-agents.ts` — requirements and SDLC recommendation agents.
- `src/mastra/healthcare-prompts.ts` — healthcare-specific instructions, evidence separation, and validation boundaries.
- `src/mastra/healthcare-workflow.ts` — Mastra workflow that profiles requirements and recommends an SDLC, writing Markdown and escaped HTML previews under `artifacts/hwise-healthcare-sdlc/`.
- `src/mastra/healthcare-rag.ts` and `hwise-workspace.ts` — read-only BM25 retrieval over the included corpus.
- `src/mastra/hwise-model.ts` — OpenAI-compatible LM Studio client; default model is `qwen/qwen3-8b`.
- `src/mastra/hwise-coordinator.ts` and `index.ts` — Hwise assistant and Mastra registration.
- `docs/ingested/healthcare/healthcare-software-sdlc.md` — retrieval-ready evidence corpus.
- `docs/ingested/healthcare/healthcare-sdlc-dataset.json` — the canonical structured dataset used to produce the corpus.

## Requirements and run

Use Node.js **22.22 or later** and [LM Studio](https://lmstudio.ai/). In LM Studio, download/load the model catalog entry `qwen/qwen3-8b` and start its local OpenAI-compatible server on port `1234` (or set a different URL below).

```sh
cp .env.example .env
npm install
npm run dev
```

To type-check and build:

```sh
npm run check
```

In Mastra Studio, select workflow `healthcare-requirements-then-sdlc` and pass a healthcare software project brief. The workflow returns the requirements profile, recommendation, and paths to its generated previews. It also registers `hwiseCoordinator`, `healthcareRequirementsAgent`, and `healthcareSdlcRecommendationAgent`.

Environment settings are in `.env.example`:

- `HWISE_LM_STUDIO_BASE_URL` defaults to `http://127.0.0.1:1234/v1`.
- `HWISE_LM_STUDIO_API_KEY` defaults to LM Studio's local placeholder `lm-studio`.
- `HWISE_LM_STUDIO_MODEL` defaults to `qwen/qwen3-8b`.
- `HWISE_MASTRA_DATABASE_URL` defaults to local file storage at `./hwise.db`.
- `HWISE_WORKSPACE_ROOT` defaults to the current project root. Set it if running Mastra from another directory.

The model identifier is the exact LM Studio catalog ID; another server may require a different model ID. Qwen3 8B supports thinking and non-thinking modes, with the LM Studio catalog indicating thinking is enabled by default. This bundle does not override that model setting.

## Dataset handling

The indexed corpus is the healthcare dataset delivered earlier, not a synthetic lifecycle catalog. It has **8 projects and 30 primary-source page links**: OpenMRS, OpenEMR, DHIS2, Bahmni, GNU Health, SORMAS, OpenELIS Global, and HAPI FHIR. Its research date is 2026-10-05.

The records distinguish explicit model labels from documented practices. Most reviewed primary sources do not name a formal SDLC, so Hwise preserves “Not explicitly stated in reviewed primary sources” and lists only the processes those sources describe. SORMAS’s sources name Gitflow as a development workflow; Hwise explicitly avoids presenting it as a complete end-to-end lifecycle. The corpus includes dates/version notes and limitations alongside source URLs.

The BM25 index searches the included Markdown corpus only. Additions should use the same evidence discipline: project-maintained sources, source URLs, source/version context, and clear limitations. Do not turn missing documentation into claims that a project lacks a practice.

## Integration with an existing SAI checkout

This folder is a small standalone Hwise starter with its own `src/mastra/index.ts`; it is not an automatic edit or push to the linked GitHub repository. To integrate its healthcare agents into an existing SAI app, copy the Hwise `docs/ingested/healthcare/` directory and Mastra TypeScript modules, then merge the healthcare agent/workflow registrations into the app’s existing `src/mastra/index.ts`. Do not replace SAI’s existing education registrations unless that is intended. Use the Hwise-specific `HWISE_*` environment variables so the healthcare model setting does not silently change SAI’s model.

## Reference sources

- SAI repository structure and conventions: https://github.com/Master9Wayne/SAI
- Mastra agent overview: https://mastra.ai/docs/agents/overview
- Mastra LM Studio model-provider notes: https://mastra.ai/models/providers/lmstudio
- LM Studio Qwen3 8B catalog entry: https://lmstudio.ai/models/qwen/qwen3-8b
- Qwen official Qwen3-8B model card: https://huggingface.co/Qwen/Qwen3-8B
- Healthcare project evidence: see the links next to each record in `docs/ingested/healthcare/healthcare-software-sdlc.md` and the structured dataset JSON.


## Dependency validation note

`npm run check` completed successfully in the creation environment (TypeScript check and Mastra build). `npm audit` reported six high-severity findings in the dependency tree, including the Mastra CLI/deployer and transitive packages. They were not automatically force-upgraded because npm proposed a breaking CLI change. Review and resolve the audit findings before production use, especially before handling sensitive or regulated data. The included starter does not claim security or regulatory approval.
