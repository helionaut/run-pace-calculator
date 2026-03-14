---
tracker:
  kind: linear
  project_slug: "8fde3d6f1b81"
  active_states:
    - Todo
    - In Progress
    - Merging
    - Rework
  terminal_states:
    - Closed
    - Cancelled
    - Canceled
    - Duplicate
    - Done
polling:
  interval_ms: 5000
workspace:
  root: /home/helionaut/workspaces
hooks:
  after_create: |
    git clone --depth 1 --branch main https://github.com/helionaut/run-pace-calculator .
  before_remove: |
    true
agent:
  max_concurrent_agents: 3
  max_turns: 20
codex:
  command: codex --config shell_environment_policy.inherit=all --config model_reasoning_effort=xhigh --model gpt-5.3-codex app-server
  approval_policy: never
  thread_sandbox: danger-full-access
  turn_sandbox_policy:
    type: dangerFullAccess
---

You are working on a Linear ticket `{{ issue.identifier }}` for repository `run-pace-calculator`.

{% if attempt %}
Continuation context:

- This is retry attempt #{{ attempt }} because the ticket is still in an active state.
- Resume from the current workspace state instead of restarting from scratch.
- Do not repeat already-completed investigation or validation unless needed for new code changes.
{% endif %}

Issue context:
Identifier: {{ issue.identifier }}
Title: {{ issue.title }}
Current status: {{ issue.state }}
Labels: {{ issue.labels }}
URL: {{ issue.url }}

Description:
{% if issue.description %}
{{ issue.description }}
{% else %}
No description provided.
{% endif %}

Instructions:

1. This is an unattended orchestration session. Work autonomously end-to-end unless blocked by missing auth, missing secrets, or missing required infrastructure.
2. Keep a single persistent workpad comment on the issue and update it as you go.
3. Use repo-local skills from `.codex/skills`.
4. Work test-first by default for behavior changes:
   - add or update tests before, or at least in the same change as, the implementation
   - do not hand off behavior changes without explicit test evidence
   - if the task is too ambiguous to write meaningful tests, clarify the acceptance criteria in the workpad before coding
5. Validate meaningful behavior before handoff.
6. Treat local validation and remote validation separately:
   - local `npm test` / `npm run build` / `npm run check` prove the workspace head is healthy
   - GitHub PR checks prove the published review artifact is healthy
   - do not treat local green results as sufficient if the linked GitHub PR is still red, stale, or missing the latest head
7. When the workspace head is newer than the linked PR, treat publishing that head as the next required action:
   - re-check `gh auth status`, GitHub DNS, and GitHub HTTPS from the current environment before reusing any earlier blocker note
   - if those checks pass, push the current branch head, refresh or create the PR, and wait for remote checks instead of producing another offline handoff
   - only fall back to offline handoff if the current turn re-verifies that GitHub auth/network/push is still unavailable
   - do not keep repeating the same blocked note across turns without a fresh publish-path recheck
8. Move the issue to `Human Review` only after all of the following are true:
   - implementation is complete
   - local validation and test evidence are complete
   - the linked PR exists and targets the correct branch
   - the linked PR reflects the current head that you want reviewed
   - required GitHub checks on that PR are green
9. If local validation passes but the linked PR is still red, stale, or unpublished:
   - keep the issue in `Rework`
   - state clearly in the workpad that the remaining blocker is remote CI / PR freshness
   - do not describe the issue as ready for review yet

Repo metadata:

- GitHub repo: `https://github.com/helionaut/run-pace-calculator`
- Local repo root: `/home/helionaut/src/projects/run-pace-calculator`
- Symphony workspace root: `/home/helionaut/workspaces`

Default flow:

- `Todo` -> move to `In Progress`
- `In Progress` -> implement and validate
- `Rework` -> address review feedback
- `Merging` -> land the approved PR
- `Done` -> stop
