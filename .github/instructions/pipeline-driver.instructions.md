---
description: "Use when working on pipeline-driver: DAG execution, task lifecycle, node dispatch, progress tracking, pipeline completion."
applyTo: "core/pipeline-driver/**"
---
# pipeline-driver

**Spec:** Consult `.specs/pipeline-driver.md` before making logic changes.

- DAG-based pipeline execution orchestrator.
- Receives pipeline jobs from Redis, builds in-memory DAG of algorithm nodes.
- Dispatches tasks to algorithm-queues, tracks task lifecycle events.
- Computes progress, persists graph state, terminates pipelines on completion/failure.

**Logic-Gate:** If changing DAG traversal, task dispatch, progress computation, or completion logic, update the Logic Contract in the spec first.
