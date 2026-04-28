---
description: "Use when working on worker: algorithm lifecycle, job consumption, data I/O, retry logic, TTL enforcement, streaming auto-scaling."
applyTo: "core/worker/**"
---
# worker

**Spec:** Consult `.specs/worker.md` before making logic changes.

- Per-algorithm sidecar process for lifecycle management of a single algorithm container.
- Handles job consumption, data I/O, retry logic, TTL enforcement, streaming auto-scaling, and tracing.
- Communication: WebSocket (default), Socket.IO, Loopback (test).
- One worker pod per algorithm container.

**Logic-Gate:** If changing state machine transitions, retry logic, TTL enforcement, or auto-scaling decisions, update the Logic Contract in the spec first.
