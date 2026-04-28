---
description: "Use when working on pipeline-driver-queue: pipeline scheduling, concurrency limits, heuristic scoring, job dispatch to drivers."
applyTo: "core/pipeline-driver-queue/**"
---
# pipeline-driver-queue

**Spec:** Consult `.specs/pipeline-driver-queue.md` before making logic changes.

- Priority-aware scheduling queue between pipeline submission and execution.
- Scores pipeline jobs via configurable heuristics, enforces pipeline-level concurrency limits.
- Three timer-driven loops: `_checkQueue` (500ms), `_updateState` (5s), `_checkConcurrencyJobsInterval` (5s).
- Dispatches eligible jobs to pipeline-drivers via Redis.

**Logic-Gate:** If changing scoring heuristics, concurrency enforcement, or dispatch logic, update the Logic Contract in the spec first.
