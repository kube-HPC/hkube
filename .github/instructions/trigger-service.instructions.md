---
description: "Use when working on trigger-service: cron triggers, pipeline-completion triggers, scheduled pipeline execution."
applyTo: "core/trigger-service/**"
---
# trigger-service

**Spec:** Consult `.specs/trigger-service.md` before making logic changes.

- Event-driven orchestration engine.
- Triggers stored pipeline executions via cron schedules and pipeline-completion events.
- Singleton modules with EventEmitter pub/sub pattern.

**Logic-Gate:** If changing trigger evaluation, cron scheduling, or pipeline-completion chaining logic, update the Logic Contract in the spec first.
