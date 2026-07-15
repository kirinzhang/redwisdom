# Schema And Retrieval Contract

## Canonical files

- `data/history-case.schema.json`: v3 case contract.
- `data/history-problem-types.json`: 12 problem classes and no-analogy cues.
- `data/history-case-additions.json`: manually reviewed candidate content.
- `data/history-source-review.json`: explicit review batches and publish gate.
- `data/history-cases.json`: compiled, published output.
- `data/evaluation/history-retrieval-150.json`: labeled retrieval set.

## Required case sections

- Identity: `id`, `title`, `period`, `caseKind`, `problemTypes`.
- Historical record: `challenge`, `actions`, `outcome`.
- Transfer controls: `sourceBoundary`, `transferMethod`, `limits`.
- Retrieval: `methodology`, `applicableProblems`, `keywords`, `retrieval.aliases`, `retrieval.negativeCues`.
- Evidence: `source`, `evidence`, `verification`, `review`.

## Retrieval sequence

1. Block explicit no-analogy utility intents.
2. Classify the query into up to three problem types.
3. Build weighted documents from titles, aliases, applicable problems, methods, challenges, and transfer text.
4. Compute BM25-style lexical relevance.
5. Add category fit, exact-phrase, and semantic-method scores.
6. Subtract case-specific negative-cue penalties.
7. Rerank and return up to three source-reviewed cases above the minimum score.

The UI model must expose only stored case fields and deterministic links. The model prompt may choose fewer cases, but it must state similarities, differences, transfer method, and source boundary.
