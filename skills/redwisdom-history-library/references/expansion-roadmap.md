# Expansion Roadmap

## 60 to 150 cases

- Add batches of 15-25 cases.
- Raise every problem class to at least 12 cases.
- Include success, partial success, correction, retreat, cost, and failure patterns.
- Diversify periods, organizational scale, civilian work, economic work, investigation, governance, and coalition cases.
- Add at least two labeled evaluation queries for each new case family.

## 150 to 300 cases

- Raise each class to 20 or more cases while limiting overrepresented articles and periods.
- Add cross-category cases only when each assigned type has direct editorial justification.
- Add adversarial prompts for superficial similarity, mixed intents, high-stakes questions, and no-analogy utility requests.
- Maintain a held-out evaluation set that is not used while tuning weights.
- Track retrieval misses by classification, recall, reranking, citation, or analogy-boundary failure.

## Release gates

- Source coverage: 100%.
- Top-three accepted-case hit rate: greater than 85%.
- Problem-type top-three rate: at least 85%.
- Citation accuracy: greater than 95%.
- Forced or superficial analogy rate: below 5%.

Do not lower thresholds to publish a batch. Revise labels, aliases, case boundaries, or ranking weights and rerun the full evaluation.
