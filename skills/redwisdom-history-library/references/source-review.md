# Source And Review Policy

## Evidence levels

1. `primary`: exact text from the local Mao Selected Works search index. Require a valid article, paragraph anchor, exact excerpt, and SHA-256 hash.
2. `authoritative-history`: a source that supports context or outcome. Approved production hosts are `12371.cn` subdomains currently listed in the validator.
3. `editorial`: challenge, actions, outcome, transfer method, and limits. These are summaries, not quotations.

## Review states

- `draft`: incomplete or not source-audited; never retrieve.
- `source-reviewed`: primary excerpt, authoritative context, citation mapping, and analogy boundary checked; `reviewerType` must be `source-audit`.
- `editor-approved`: separately approved by a human editor; `reviewerType` must be `human-editor`.
- `rejected`: contains unsupported facts, weak analogy, unsuitable framing, or unresolved source conflict.

Record review decisions in `data/history-source-review.json`. The build script must not automatically approve unknown case IDs.

## Claim checks

- `challenge`: verify the problem existed in the stated period.
- `actions`: verify each stated action rather than infer it from a later result.
- `outcome`: distinguish immediate documented results from later historical consequences.
- `sourceBoundary`: state what the material does not prove.
- `transferMethod`: translate structure into investigation or action, not historical goals or struggle methods.
- `limits`: cover legal, ethical, professional, and context differences.

When sources disagree, preserve the disagreement or omit the disputed claim. Never choose the more dramatic account merely because it produces a stronger analogy.
