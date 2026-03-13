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
    local_repo=/home/helionaut/src/projects/run-pace-calculator
    remote_repo=https://github.com/helionaut/run-pace-calculator.git

    if [ -d "$local_repo/.git" ]; then
      git clone --depth 1 "file://$local_repo" .
      git remote set-url origin "$remote_repo"
    else
      git clone --depth 1 "$remote_repo" .
    fi
  before_remove: |
    true
agent:
  max_concurrent_agents: 4
  max_turns: 20
codex:
  command: codex --config shell_environment_policy.inherit=all --config model_reasoning_effort=xhigh --model gpt-5.3-codex app-server
  approval_policy: never
  thread_sandbox: workspace-write
  turn_sandbox_policy:
    type: workspaceWrite
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
6. Move the issue to `Human Review` only after the implementation, validation, test evidence, and PR linkage are complete.

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
