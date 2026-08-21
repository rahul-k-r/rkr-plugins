---
description: "Run the repo's full local quality gate (build, static analysis, tests, lint) and report real PASS/FAIL per step."
---

# /sdlc:build-check

Run the full local quality gate for the target repo. Use this before marking any story done, opening a PR, or as a sanity pass before a commit.

## Resolving the gate

Take the commands from the repo's `CLAUDE.md` build/test section. If not documented there, use the stack defaults and confirm with the user:

- **Go:** `go build ./...` · `go vet ./...` · `go test ./... -race -count=1` · `golangci-lint run`
- **Python:** `ruff check .` · `ruff format --check .` · `mypy .` (if configured) · `pytest` — inside the repo's venv/uv/poetry environment
- **React / Next.js:** `npm run lint` · `npm run typecheck` (or `tsc --noEmit`) · `npm test` · `npm run build` — using the repo's actual package manager and script names from `package.json`
- Mixed repos: run every applicable stack's gate.

## Steps

Run the commands in order, stopping and reporting on first failure:

- Report **PASS** or **FAIL** per step with the command output.
- On failure, show the full error output and stop — do not proceed to the next step.
- If a listed linter isn't installed locally and the repo treats in-PR CI as authoritative for lint, mark it **"deferred to CI lint"** rather than FAIL.

## Success output

```
✓ <command>   — ok
...

Quality gate passed. Safe to commit.
```

## On failure

Show the exact error, identify the file and line, and either:
- Fix it immediately if it's a simple compile or lint error (unused import, type mismatch, shadow variable)
- Report it clearly and wait for instruction if it requires design decisions

## Notes

- Run from the repo root.
- Zero tests in a package is not a failure.
- **Windows/CRLF:** with `core.autocrlf=true`, formatters (`gofmt -l`, `ruff format --check`, prettier) can flag entire files as unformatted — every line "changed" with identical content. That's a working-tree CRLF artifact git normalizes on commit, not a gate failure. Verify real diffs with `git diff --stat` / `git diff --cached`, and only reformat files you actually intend to change.
