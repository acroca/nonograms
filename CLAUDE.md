# Working in this repo

## Git workflow

- Commit work on the session's feature branch and push it there, so the owner can review the
  diff in the UI. Wait for them to say they're happy with it.
- Once they are, open a pull request against `main` and enable auto-merge with **squash**.
  GitHub merges it when the `build` check passes and deletes the branch. If auto-merge is
  refused because the check has already passed, squash-merge the pull request directly.
  Don't push to `main` directly; it is protected.
- Don't watch or subscribe to the pull request: send it and move on. If the owner reports a
  failed check, fix it on the same branch and push again.
- After the merge, restart the local branch from the latest `origin/main` before doing more
  work, since the squash commit replaces the branch's commits.
