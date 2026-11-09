# Development

Learn how to set up and run the OpsiMate project locally for development.

## Prerequisites

- **Node.js** (v22 or higher — the pre-commit hook needs 22.22.1+; CI runs 24, the Docker images 26)
- **pnpm** (the repo is a pnpm workspace; enable it with `corepack enable`)
- **Git**

## Development Setup

### To set up OpsiMate locally for development:

1. **Fork the Repository**
   - Go to the [OpsiMate GitHub repository](https://github.com/OpsiMate/OpsiMate)
   - Click **“Fork”** in the top-right corner to create your own copy.

2. **Clone Your Fork**
   ```bash
   git clone https://github.com/<your-username>/OpsiMate.git
   cd OpsiMate

3. **Install dependencies:**
   ```bash
   pnpm install
   ```

4. **Build the project:**
   ```bash
   pnpm run build
   ```
5. **Specify the config file (optional):**
   ```bash
   export CONFIG_FILE=/path/to/config.yml
   ```

6. **Start development server:**
   ```bash
   pnpm run dev
   ```

# Development Commands

- `pnpm run test` - Run test suite
- `pnpm run lint` - Check code quality
- `pnpm run check` - Run the same format and lint checks as CI
- `pnpm run fix` - Fix formatting and auto-fixable lint issues

`pnpm install` also sets up a pre-commit hook that runs Prettier on your staged files.

If CI says a format check failed, run `pnpm --filter <package> format-fix` (for example `pnpm --filter @OpsiMate/server format-fix`) and commit the result.

# How to Make a Pull Request (PR)

1. **Create a New Branch:** Use a clear and short name for your branch, for example

```bash
git checkout -b feat/your-feature-name
```

```bash
feat/add-login-page

fix/docker-compose-path
```

2. **Make Your Changes:**
Edit the code, docs, or configuration as needed.

```bash
git add .
git commit -m "Add login page UI"
```

3. **Push to Your Fork:** 

```bash
git push origin feat/your-feature-name
```

4. **Open a Pull Request:**

a. Go to your fork on GitHub.  
b. Click Compare & pull request.  
c. Choose the base repository as OpsiMate/OpsiMate and branch as main.  
d. Add a meaningful title and a clear description of what you changed.

# Working on a Good First Issue

Good-first-issues are how new people get into the project, so we try to spread them around:

- **One at a time.** New contributors keep at most **one** open PR on a `good first issue`. Finish it (merged or closed) before starting the next. Extra PRs opened in parallel are closed without review, and the issue goes back to the pool.
- **Comment to claim.** Before you start, comment "I'd like to work on this" on the issue. If someone already claimed it in the last few days, pick another one.
- **Run it before you open it.** Run the tests for what you changed (`pnpm --filter @OpsiMate/server test` or `pnpm --filter @OpsiMate/client test:run`), Prettier, and for client changes the typecheck gate (`pnpm --filter @OpsiMate/client typecheck`). For docs, preview the page (`npm start` in the documentation repo).
- **Read the whole issue.** Most issues list several behaviours or checks; a PR that covers only some of them will get a request for the rest.
- **Docs issues go to the docs repository.** Issues with a "📍 Where this lives" note are fixed in https://github.com/OpsiMate/documentation, not here.
- **Using AI tools is fine; unchecked output is not.** PRs that change unrelated files, paste tests into source files, or don't do what the issue asks are closed and labelled `spam` (they don't count for Hacktoberfest).

# How a Pull Request Gets Reviewed

Every PR goes through the same steps. Knowing them up front saves a round trip:

1. **CI must be green.** Lint, Prettier, the typecheck gates and all three test suites run on every push. A red check is looked at before anything else; fix it or explain it in a comment.
2. **CodeRabbit reviews first.** Reply on **every** thread it opens, either with the commit that fixes it or with why it does not apply. Threads left without an answer are read as "not done". Pushing a fix without replying is the most common reason a PR stalls.
3. **A maintainer reviews on top of current main.** They run the tests for what you changed and check every item the issue lists. Expect specific requests; answer each one.
4. **Merge.** Squash, with your commits as the PR's history. Contributor PRs are merged by a maintainer only.

Rules the reviews enforce, so you can apply them before pushing:

- **Named interfaces everywhere.** No anonymous inline object types, in tests included. Declare an `interface` for every object shape and use it (a `type` alias is for unions and mapped types, not for object literals). This is checked in review, not by lint.
- **No wall-clock assertions in tests.** Timing bounds flake on a loaded CI runner. Count the expensive call, assert on order or on the mocked clock, never on elapsed milliseconds.
- **Stay inside the issue.** A PR that touches unrelated files, reformats code it does not change, or bundles a second fix gets a request to split it.
- **Proof in the PR.** A screenshot for UI or docs changes (light and dark if the change is visual), the test output for tests.
- **Dependencies and config need a second look.** PRs from contributors that change workflows, hooks, scripts, `package.json`, the lockfile, tool configs, Dockerfiles, infrastructure, `index.html` or shell scripts, or whose branch was force-pushed, fail the *Sensitive change guard* check until a maintainer reads them and adds the `maintainer-reviewed` label. That is expected; mention in the PR why the change is needed.
- **Keep the claim alive.** An assigned issue with no activity and no open PR for 14 days is released automatically with a comment, so someone else can take it. If you need longer, say so on the issue; a maintainer can add `keep-assigned`.
- **Check-in dates are real.** When a review asks for changes by a date and nothing happens, the PR is closed and the issue goes back to the pool. Comment to get it reassigned if you come back.

# Pull Request Title 
### Your Pull Request title must strictly follow one of the following formats:
- [FEAT]: Short descriptive title
- [FIX]: Short descriptive title

