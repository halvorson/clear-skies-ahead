# Agent Assignments — Visual Tasks Sprint

## Coordination rules
- Agents A and B write code in parallel.
- **B reviews → merges A's PR**, then C starts.
- **C reviews → merges B's PR** (after branching from updated main).
- **A reviews → merges C's PR**.
- No agent reviews its own PR.
- Each agent updates its own row below (PR number + URL) after pushing.

---

## Agent A — Live compass + CTA icon fix (Tasks 1, 2, 3)

| Field | Value |
|---|---|
| Branch | `task/a-compass-icon` |
| Files | `src/ui/ResultScreen.ts`, `src/styles.css` |
| PR written | — |
| Reviewed by | **Agent B** |
| Reviews | Agent C's PR |
| Status | 🟡 writing |

---

## Agent B — Spinning sun + stable layout (Tasks 4, 5)

| Field | Value |
|---|---|
| Branch | `task/b-loading-visual` |
| Files | `src/ui/LoadingScreen.ts`, `src/styles.css` |
| PR written | — |
| Reviewed by | **Agent C** |
| Reviews | Agent A's PR |
| Status | 🟡 writing |

---

## Agent C — Loading log logic chain (Tasks 6, 7, 8, 9)

| Field | Value |
|---|---|
| Branch | `task/c-loading-logic` |
| Files | `src/ui/LoadingScreen.ts`, `src/ui/App.ts`, `src/core/search.ts` |
| PR written | — |
| Reviewed by | **Agent A** |
| Reviews | Agent B's PR |
| Status | ⏳ waiting for B to merge |
| Note | Branch from main **after** B's PR merges |
