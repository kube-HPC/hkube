---
description: "Use when working on algorithm-queue: priority scoring, task dispatch, heuristic weights, queue persistence, batch scoring."
applyTo: "core/algorithm-queue/**"
---
# algorithm-queue

**Spec:** Consult `.specs/algorithm-queue.md` before making logic changes.

- Priority-scored task queue engine. One in-memory queue per algorithm name.
- Tasks arrive from pipeline-driver via Redis, scored by weighted heuristic system (priority, attempts, entrance-time, batch, current-batch-place).
- Dispatches highest-scored task to workers via Redis producer.
- Scoring re-evaluates all tasks on a periodic interval.
- Persists snapshots to S3/FS and scoring data to etcd.

**Logic-Gate:** If changing heuristic weights, scoring formulas, or dispatch logic, update the Logic Contract in the spec first.
