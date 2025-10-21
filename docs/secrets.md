# Secrets Management in OpsiMate

## Overview

Secrets are sensitive pieces of information such as API keys, passwords, tokens, and private keys that are required by providers, services, or integrations in OpsiMate. Managing secrets securely is essential to protect your infrastructure and data from unauthorized access.

OpsiMate provides secure mechanisms for storing and referencing secrets, ensuring they are never exposed in plain text or hardcoded in your configuration files.

---

## Why Use Secrets?

- **Security:** Prevent accidental exposure of sensitive credentials
- **Flexibility:** Easily update secrets without changing code
- **Compliance:** Meet security and audit requirements
- **Centralization:** Manage all secrets in one place

---

## How to Add a Secret

### Method 1: Using the OpsiMate UI

1. Navigate to the **Secrets** section in the dashboard
2. Click **Add Secret**
3. Enter a name (e.g., `AWS_API_KEY`), value, and optional description
4. Choose the scope (Provider, Service, Integration)
5. Save the secret

Secrets are encrypted and stored securely. You can reference them by name in your provider, service, or integration configuration.

### Method 2: Using the Configuration File

You can also define secrets in your OpsiMate configuration YAML file:

```yaml
secrets:
  AWS_API_KEY: "your-aws-api-key-here"
  DB_PASSWORD: "supersecretpassword"
  SLACK_TOKEN: "xoxb-1234567890"

providers:
  - name: aws-prod
    type: aws
    credentials:
      api_key: ${AWS_API_KEY}

services:
  - name: database
    type: postgres
    env:
      DB_PASSWORD: ${DB_PASSWORD}

integrations:
  - name: slack
    type: slack
    token: ${SLACK_TOKEN}
```

**Note:** Use `${SECRET_NAME}` syntax to reference secrets in your config.

---

## Scope of Secrets

Secrets can be used in:
- **Providers:** API keys, SSH keys, cloud credentials
- **Services:** Database passwords, service tokens
- **Integrations:** Third-party tokens (Slack, PagerDuty, etc.)

You can restrict secrets to specific scopes for better security and organization.

---

## Best Practices for Secret Management

- **Never hardcode secrets in code or public config files**
- **Use environment variables or the secrets manager**
- **Rotate secrets regularly**
- **Limit access to secrets by role and scope**
- **Audit secret usage and access logs**
- **Use strong, randomly generated values for secrets**
- **Remove unused secrets promptly**

---

## Example: Referencing Secrets in Configuration

Here’s a sample YAML snippet showing secrets usage:

```yaml
secrets:
  GRAFANA_API_KEY: "grafana-xyz-123"

integrations:
  - name: grafana
    type: grafana
    api_key: ${GRAFANA_API_KEY}
```

---

## Security Notes

- Secrets are encrypted at rest and never exposed in logs or UI
- Only authorized users can view or edit secrets
- OpsiMate supports integration with external secret managers (coming soon)
- Always use the secrets manager or environment variables for sensitive data

---

## Sidebar Link

This page is linked under **Core Features** and **Configuration** in the documentation sidebar for easy access.

---

## Need Help?

- [Online Documentation](https://opsimate.vercel.app/)
- [GitHub Issues](https://github.com/OpsiMate/OpsiMate/issues)
- [Slack Community](https://join.slack.com/t/opsimate/shared_invite/zt-39bq3x6et-NrVCZzH7xuBGIXmOjJM7gA)

---

*Last updated: October 2025*
