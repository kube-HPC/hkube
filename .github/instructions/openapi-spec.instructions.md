---
description: "Use when working on openapi-spec: Swagger/OpenAPI generation, YAML fragments, API schema compilation."
applyTo: "core/openapi-spec/**"
---
# openapi-spec

**Spec:** Consult `.specs/openapi-spec.md` before making changes.

- Build-time tool (not a runtime service).
- Compiles modular YAML fragments into a single `swagger.json` (OpenAPI 3.0).
- Distributes the compiled spec to consuming services that serve the API.

**Logic-Gate:** If adding/removing API paths or changing schema definitions, update the spec first.
