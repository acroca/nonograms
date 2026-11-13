# Working in this repo

## Git workflow

- Commit work on the session's feature branch, push it, and open a pull request against `main`
  straight away, without auto-merge. Cloudflare builds the branch and comments a preview
  link on the pull request, so the owner can try the change as well as read the diff. Wait for
  them to say they're happy with it; push follow-up fixes to the same branch.
- Once they are, squash-merge the pull request. If the `build` check is still running, enable
  auto-merge with **squash** instead, and GitHub merges it when the check passes. The branch
  is deleted on merge. Don't push to `main` directly; it is protected.
- Don't watch or subscribe to the pull request. If the owner reports a failed check, fix it
  on the same branch and push again.
- After the merge, restart the local branch from the latest `origin/main` before doing more
  work, since the squash commit replaces the branch's commits.
