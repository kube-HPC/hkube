---
description: "Use when working on resource-manager: resource allocation, pod scaling recommendations, metric processing, weighted scoring."
applyTo: "core/resource-manager/**"
---
# resource-manager

**Spec:** Consult `.specs/resource-manager.md` before making logic changes.

- Timer-driven resource-recommendation engine (1s interval).
- Observes algorithm/driver work-queues, cluster capacity, Prometheus metrics, and algorithm templates.
- Produces weighted allocation recommendations written to etcd (`algorithms.requirements`, `pipelineDrivers.requirements`).
- Recommendation modes: `flat` (default), `map`.
- Consumers: task-executor, pipeline-driver-queue.

**Logic-Gate:** If changing metric calculations, scoring weights, or allocation formulas, update the Logic Contract in the spec first.
