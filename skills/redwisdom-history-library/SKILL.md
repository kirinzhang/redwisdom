---
name: redwisdom-history-library
description: Build, review, expand, retrieve, and evaluate Red Wisdom's source-backed CPC history method-case library. Use when adding or editing party-history cases, checking Mao Selected Works citations, assigning review states, tuning problem classification or hybrid retrieval, creating “党史镜鉴” answers, or expanding the library from 60 toward 150-300 cases without fabricated history.
---

# Red Wisdom History Library

Maintain historical facts as an updateable, auditable case library. Distill only the analysis workflow and method-selection ability into prompts or models.

## Workflow

1. Inspect `data/history-problem-types.json`, current category coverage, and evaluation failures before selecting new cases.
2. Start every candidate in `data/history-case-additions.json`. Do not edit compiled excerpts or hashes in `data/history-cases.json` by hand.
3. Locate a primary passage in `data/search-index.json`; record an exact `articleId`, `anchor`, and `excerptNeedle`.
4. Open and read at least one approved authoritative history source. Verify the historical setting, action, and outcome separately.
5. Keep historical description, editorial summary, modern transfer method, and analogy limit in separate fields. Never add motives, dialogue, numbers, causal claims, or outcomes absent from the sources.
6. Add the case ID to `data/history-source-review.json` only after all three checks pass. Use `source-reviewed` with `source-audit`; reserve `editor-approved` and `human-editor` for an identifiable human editorial decision.
7. Run `npm run build:history`, `npm run validate:history`, and `npm run eval:history` in that order.
8. Reject a release if source coverage is below 100%, top-three case hit rate is below 85%, citation accuracy is below 95%, or forced analogy rate is 5% or higher.

## Source Discipline

- Treat AI extraction as a draft only.
- Require exact local primary-text evidence and an approved authoritative-history URL for every published case.
- Use `sourceBoundary` and `limits` as prohibitions, not optional caveats.
- Do not convert military, political, or class-struggle history into enemy labels for modern personal relationships.
- Return no history analogy for utility questions or when similarity is only superficial.
- Read [source-review.md](references/source-review.md) when reviewing evidence or changing status.

## Data And Retrieval

- Read [schema-and-retrieval.md](references/schema-and-retrieval.md) before changing fields, ranking weights, or the “党史镜鉴” payload.
- Keep problem classification multi-label. Use lexical relevance, category fit, semantic method overlap, and explicit negative cues as separate ranking signals.
- Preserve deterministic original-text and authoritative-source links in the UI even when the generated answer omits a citation.
- Do not let model output invent case IDs or source links.

## Expansion

Read [expansion-roadmap.md](references/expansion-roadmap.md) before adding a batch. Expand by coverage gaps and scenario diversity, not by mechanically splitting articles. Add or revise evaluation prompts with each batch so retrieval quality cannot improve by memorizing a static test set.

Do not fine-tune historical facts. Consider fine-tuning only after a reviewed corpus demonstrates a stable analysis format, sound clarification questions, method selection, source use, and explicit analogy boundaries.
