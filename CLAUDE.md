# Working in this repo

## Git workflow

- Commit work on the session's feature branch and push it there, so the owner can review the
  diff in the UI. Wait for them to say they're happy with it.
- Once they are, rebase onto the latest `origin/main` and push the same commits to `main`
  (never force-push `main`).
- After pushing to `main`, delete the session's remote branch (`git push origin --delete <branch>`).
  Later work in the same session pushes it again.
- Don't open pull requests unless explicitly asked.
