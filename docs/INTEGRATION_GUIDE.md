# External Documentation Integration Guide

This guide explains how to integrate the TV Mode documentation into the external documentation site at https://opsimate.vercel.app/

## Overview

The OpsiMate documentation is hosted separately from the main repository. This guide helps maintainers sync the TV Mode documentation to the external site.

## Documentation Site Integration

### For Mintlify-based Documentation

If the documentation site uses Mintlify (common for Vercel deployments):

1. **Add the TV Mode page to the documentation repository**
   - Copy `docs/tv-mode.md` to the docs site repository
   - Place it in the appropriate directory (e.g., `core-features/` or `interface/`)

2. **Update the navigation configuration**
   
   In `mint.json` or similar configuration file, add the TV Mode entry:

   ```json
   {
     "group": "Core Features",
     "pages": [
       "core-features/dashboard",
       "core-features/tv-mode",
       "core-features/providers"
     ]
   }
   ```

3. **Adjust image paths**
   - Update image references to match the docs site structure
   - Upload screenshots to the docs site's image directory

### For Docusaurus-based Documentation

If using Docusaurus:

1. **Add the document**
   - Copy to `docs/core-features/tv-mode.md` in the docs repository

2. **Update sidebars.js**

   ```javascript
   module.exports = {
     docs: [
       {
         type: 'category',
         label: 'Core Features',
         items: [
           'core-features/dashboard',
           'core-features/tv-mode',
           'core-features/providers',
         ],
       },
     ],
   };
   ```

3. **Add frontmatter to the markdown file**

   ```markdown
   ---
   id: tv-mode
   title: TV Mode
   sidebar_label: TV Mode
   description: Full-screen monitoring interface for wall displays
   ---
   ```

### For Nextra-based Documentation

If using Nextra (Next.js-based):

1. **Add the page**
   - Copy to `pages/core-features/tv-mode.mdx` in the docs repository

2. **Update _meta.json**

   ```json
   {
     "dashboard": "Dashboard",
     "tv-mode": "TV Mode",
     "providers": "Providers"
   }
   ```

### For VitePress

If using VitePress:

1. **Add the document**
   - Copy to `docs/guide/tv-mode.md`

2. **Update .vitepress/config.js**

   ```javascript
   export default {
     themeConfig: {
       sidebar: [
         {
           text: 'Core Features',
           items: [
             { text: 'Dashboard', link: '/guide/dashboard' },
             { text: 'TV Mode', link: '/guide/tv-mode' },
             { text: 'Providers', link: '/guide/providers' }
           ]
         }
       ]
     }
   }
   ```

## Content Adjustments for External Docs

When moving the documentation to the external site, make these adjustments:

### 1. Update Image Paths

Change from:
```markdown
![OpsiMate TV Mode](../assets/images/tv-mode.png)
```

To (adjust based on your docs site structure):
```markdown
![OpsiMate TV Mode](/images/tv-mode.png)
```

### 2. Update Internal Links

Change repository-relative links to docs-site-relative links:

From:
```markdown
[Contributing Guide](../CONTRIBUTING.md)
```

To:
```markdown
[Contributing Guide](/contributing)
```

### 3. Add Navigation Elements

If your docs platform supports it, add:

- **Next/Previous page navigation**
- **Edit this page on GitHub** link
- **Table of contents** in the sidebar

Example for Docusaurus frontmatter:
```yaml
---
sidebar_position: 2
---
```

### 4. SEO Optimization

Add metadata for better search engine visibility:

```yaml
---
title: TV Mode - OpsiMate Documentation
description: Learn how to use TV Mode for full-screen monitoring on wall displays and operations centers
keywords: [tv mode, monitoring, dashboard, operations center, noc]
---
```

## URL Structure

Recommended URL structure for the TV Mode documentation:

```url
https://opsimate.vercel.app/docs/tv-mode
```

Or:
```url
https://opsimate.vercel.app/core-features/tv-mode
```

Or:
```url
https://opsimate.vercel.app/interface/tv-mode
```

Choose based on your existing documentation organization.

## Sidebar Organization

Recommended sidebar structure:

```text
📚 Documentation
├── 🚀 Getting Started
│   ├── Installation
│   ├── Quick Start
│   └── Configuration
├── ⚡ Core Features
│   ├── Dashboard
│   ├── TV Mode          ← Add here
│   ├── Providers
│   ├── Service Management
│   └── Tags & Organization
├── 🔌 Integrations
│   ├── Grafana
│   ├── Kibana
│   └── Datadog
└── 📖 Reference
    ├── API Documentation
    └── Configuration
```

## Checklist for Documentation Site Integration

- [ ] Copy `docs/tv-mode.md` to documentation site repository
- [ ] Update navigation/sidebar configuration
- [ ] Adjust image paths to match docs site structure
- [ ] Upload screenshots to docs site
- [ ] Update internal links
- [ ] Add appropriate frontmatter/metadata
- [ ] Test all links and images
- [ ] Verify responsive display
- [ ] Check syntax highlighting for code blocks
- [ ] Review on mobile devices
- [ ] Deploy and verify on production

## Keeping Documentation in Sync

### Option 1: Manual Sync
- Update both repositories when TV Mode changes
- Maintain a changelog of documentation updates

### Option 2: Automated Sync
- Set up a GitHub Action to sync docs automatically
- Trigger on changes to `docs/` directory in main repository

Example GitHub Action:
```yaml
name: Sync Documentation

on:
  push:
    paths:
      - 'docs/**'
    branches:
      - main

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout main repo
        uses: actions/checkout@v3
        
      - name: Checkout docs repo
        uses: actions/checkout@v3
        with:
          repository: OpsiMate/docs
          token: ${{ secrets.DOCS_SYNC_TOKEN }}
          path: docs-repo
          
      - name: Copy documentation
        run: |
          cp -r docs/* docs-repo/docs/
          
      - name: Commit and push
        run: |
          cd docs-repo
          git config user.name "Documentation Sync Bot"
          git config user.email "bot@opsimate.com"
          git add .
          git commit -m "Sync documentation from main repository"
          git push
```

## Testing the Documentation

Before publishing:

1. **Test locally**
   - Run the docs site locally
   - Verify all links work
   - Check image rendering
   - Test responsive design

2. **Review content**
   - Proofread for typos
   - Verify technical accuracy
   - Check code examples
   - Ensure consistency with other docs

3. **Preview deployment**
   - Use Vercel preview deployments
   - Share with team for review

4. **Production deployment**
   - Merge to main branch
   - Verify production deployment

## Support

For help with documentation site integration:

- Check the documentation platform's official guides
- Refer to existing pages in the docs site for examples
- Contact the documentation maintainers
- Open an issue in the docs repository

---

*This guide will be updated as the documentation site structure evolves.*
