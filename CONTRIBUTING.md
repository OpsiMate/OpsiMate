# Development

Learn how to set up and run the OpsiMate project locally for development.

## Prerequisites

- **Node.js** (v18 or higher)
- **npm** (v8 or higher)
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

# Pull Request Title 
### Your Pull Request title must strictly follow one of the following formats:
- [FEAT]: Short descriptive title
- [FIX]: Short descriptive title

