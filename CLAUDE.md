# Working in this repo

## Git workflow

- Commit work on the session's feature branch and push it there, so the owner can review the
  diff in the UI. Wait for them to say they're happy with it.
- Once they are, open a pull request against `main` and enable auto-merge with **squash**.
  GitHub merges it when the `build` check passes and deletes the branch. Don't push to `main`
  directly; it is protected.
- After the merge, restart the local branch from the latest `origin/main` before doing more
  work, since the squash commit replaces the branch's commits.
- If the check fails, the pull request stays open: fix it on the same branch and push again.
