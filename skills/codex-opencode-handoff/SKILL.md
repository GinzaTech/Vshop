---
name: codex-opencode-handoff
description: Delegate an approved VShop implementation plan to a guarded OpenCode GLM worker while Codex owns worktrees, review, verification, and final decisions.
---

# Codex to OpenCode Handoff

Use this skill only after the user approves a design and implementation plan.
It does not authorize a push, merge, release, publish, credential change, or
other external mutation.

1. Read `AGENTS.md`, the approved spec, and the approved plan.
2. Snapshot Git status and preserve every unrelated dirty path.
3. Create or reuse a clean managed worktree from the exact verified ref. Never
   run the worker in the main checkout.
4. Create the task packet outside the repository. Require an exact refreshed
   GLM 5.3 model ID, finite allowed/protected paths, structured pnpm commands,
   a timeout of at most 120 minutes, and a maximum of two repair rounds.
5. Run `pnpm run worker:opencode -- --task-file ABSOLUTE_JSON_PATH`.
6. Stop on `MODEL_NOT_AVAILABLE`, `PROVIDER_AUTH_REQUIRED`, `DIRTY_BASELINE`,
   `WRITE_WINDOW_UNSTABLE`, `SCOPE_VIOLATION`, `NO_CHANGES`, or
   `WORKER_FAILED`. Do not widen permissions or substitute a different model.
7. `PASS_TO_REVIEW` is not completion. Read the complete diff, rerun targeted
   tests and applicable repository gates, and distinguish source, build, and
   runtime evidence.
8. Send concrete findings through a narrower repair packet. Use a maximum of
   two repair rounds, then fix locally or report the blocker.
9. Commit only reviewed files with explicit staging. Do not push, merge,
   release, or publish without the user's explicit request.
10. Archive the managed worktree only after every process has stopped and every
    patch and evidence artifact has been accounted for.
