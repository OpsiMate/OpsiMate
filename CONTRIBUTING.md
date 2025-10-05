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

# Pull Request Title 
### Your Pull Request title must strictly follow one of the following formats:
- [FEAT]: Short descriptive title
- [FIX]: Short descriptive title

