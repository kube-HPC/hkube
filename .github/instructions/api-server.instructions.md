---
description: "Use when working on api-server: REST/GraphQL endpoints, pipeline validation, DAG construction, webhook dispatch, AJV schemas."
applyTo: "core/api-server/**"
---
# api-server

**Spec:** Consult `.specs/api-server.md` before making logic changes.

- Central API gateway. REST (Express) + GraphQL (Apollo).
- Manages algorithms, pipelines, experiments, builds, and job execution.
- Validates via AJV schema validation, orchestrates pipeline creation (DAG construction, streaming flow parsing, sub-pipeline composition).
- Persists state to MongoDB/Etcd, publishes jobs to pipeline-driver-queue via Redis.
- Dispatches webhook callbacks on job completion.
- Internal API for trigger-service and worker sub-pipeline requests.

**Logic-Gate:** If changing validation schemas, DAG construction, or job publishing logic, update the Logic Contract in the spec first.
