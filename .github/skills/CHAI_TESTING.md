---
name: extend-mocha-chai-suite
description: "Extends existing Mocha/Chai test suites in /core/[service-name]/test/ to cover new Logic Contract updates."
---

# Skill: Spec-Driven Test Extension

When invoking this skill to validate a Node.js `/core/` implementation, you must extend the existing Mocha/Chai test suite rather than creating a new one. The tests must act as a verifiable proof of the newly updated Logic Contract.

## Execution Protocol
1. **Context & Style Gathering**: 
   - Locate the existing test files in `/core/[service-name]/test/` or `/core/[service-name]/tests/`.
   - Analyze the existing file to determine the established styling and conventions (e.g., use of `describe`/`context`, arrow functions, `expect` vs `should` syntax, and indentation).
   - Identify the existing mocking/stubbing strategy for Southbound dependencies (e.g., Sinon, dependency injection, proxyquire). You **must strictly adhere** to this established strategy.
2. **Spec Binding**: Any new `describe` or `it` block added MUST explicitly reference the corresponding heading or rule number from the newly updated `/.specs/[service-name].md` file. 
   - *Example:* `it('[Spec #Decision-Matrix] should scale to max_pods when queue_depth exceeds threshold', () => { ... })`
3. **Side-Effect Isolation**: Ensure your new tests do not trigger real infrastructure changes. Use the identified mocking strategy to verify that the correct commands *would* have been issued (e.g., `patchPod` was called with the right payload).
4. **State Verification**: Assert against the "State Sovereignty" rules defined in the Spec. Verify that "Owned" state mutates correctly and "Observed" state remains untouched.

## Output Trigger
Once the user approves the markdown Spec Proposal and the code changes are made, automatically output the `git diff` or the appended blocks for the existing `[service-name].spec.js` (or `.test.js`) files.