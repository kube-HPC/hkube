---
description: "Use when working on gc-service: garbage collection, cron cleaners, stale data purging, dry-run cleaning."
applyTo: "core/gc-service/**"
---
# gc-service

**Spec:** Consult `.specs/gc-service.md` before making logic changes.

- Cron-based garbage collection engine with 11 independent configurable cleaners.
- Purges stale data from Etcd, Redis, MongoDB, S3/FS storage, Kubernetes jobs, and local filesystem.
- Exposes REST API for on-demand cleaning, dry-runs, and status inspection.

**Logic-Gate:** If changing cleaner schedules, retention policies, or purge logic, update the Logic Contract in the spec first.
