# Configuration Examples

This folder contains example configuration files for different deployment scenarios.

## Available Configurations

### `config.yml`
- **Purpose**: Local development configuration
- **Database**: Uses local file system path
- **SSH Keys**: Uses local file system path
- **Usage**: Copy to project root as `config.yml` for local development

### `container-config.yml`
- **Purpose**: Docker container configuration with volume mounts
- **Database**: Container path with volume mount
- **SSH Keys**: Container path with volume mount
- **Usage**: Mount as volume in Docker container

### `docker-config.yml`
- **Purpose**: Alternative Docker configuration
- **Usage**: Alternative container configuration example

### `custom-docker-config.yml`
- **Purpose**: Example of custom Docker configuration
- **Features**: Shows how to customize database names and paths
- **Usage**: Template for creating environment-specific configs

## How to Use

### For Local Development
```bash
# Copy the local development config
cp configuration_example/config.yml ./config.yml

# Edit paths to match your local setup
# Then run: npm run dev
```

### For Docker
```bash
# Use the container config as a volume mount
docker run -d \
  --name OpsiMate-app \
  -p 3001:3001 -p 8080:8080 \
  -v $(pwd)/data/database:/app/data/database \
  -v $(pwd)/data/private-keys:/app/data/private-keys \
  -v $(pwd)/configuration_example/container-config.yml:/app/config/config.yml \
  OpsiMate
```

### For Custom Environments
```bash
# Create your own config based on examples
cp configuration_example/container-config.yml my-production-config.yml

# Edit as needed, then mount it
docker run -d \
  --name OpsiMate-prod \
  -p 3001:3001 -p 8080:8080 \
  -v $(pwd)/data/database:/app/data/database \
  -v $(pwd)/data/private-keys:/app/data/private-keys \
  -v $(pwd)/my-production-config.yml:/app/config/config.yml \
  OpsiMate
```

## LDAP / Active Directory Login

OpsiMate can sign users in against an LDAP directory (OpenLDAP, Active Directory, FreeIPA, ...).
Nobody needs to be invited: a directory user's OpsiMate account is created the first time they log in, and their role is re-read from their groups at every login.

How it works:

1. OpsiMate binds with a read-only service account and searches `search_base` for the email the user typed.
2. It checks the password by binding as that entry. OpsiMate never stores directory passwords.
3. It reads the user's groups (`memberOf`, or a group search) and maps them to a role through `role_mapping`. The highest role wins. Users in no mapped group are refused unless `default_role` is set.

Security notes:

- **Prefer full group DNs in `role_mapping`, at least for `admin`.** A bare name like `admins` matches *any* group whose name is `admins`, anywhere the lookup can see. Anyone who can create or own a group there could grant themselves that role.
- An OpsiMate account belongs to the directory entry (DN) that created it. If another entry later answers for the same email (for example a reused address, or an entry that was moved or renamed), that login is refused and the server log says so. Delete the OpsiMate user to let the new entry sign in.
- After 5 failed directory logins for an email within 15 minutes, OpsiMate answers 429 without asking the directory. This protects the account from being locked by the directory's own lockout policy. Keep your directory lockout threshold above this number. The trade-off is that anyone who knows a user's email can block that user's OpsiMate login for 15 minutes. Without the limit, the same guesses would lock their directory account everywhere. If your directory has no lockout policy, you can raise the limit or turn it off with `login_max_failures` / `LDAP_LOGIN_MAX_FAILURES` (`0` = no limit).
- Role and name changes in the directory apply at the user's next login. A session that is already open keeps its role until the token expires.

Local accounts, such as the first admin, always sign in locally. That is your way in if the directory is down or misconfigured. A directory entry can never take over a local account with the same email.

Configure it in the `ldap:` section of your config file (see the commented example in `default-config.yml`) or with environment variables:

| Variable | Example |
|---|---|
| `LDAP_ENABLED` | `true` |
| `LDAP_URL` | `ldaps://ldap.example.com:636` |
| `LDAP_START_TLS` | `true` (with an `ldap://` URL) |
| `LDAP_BIND_DN` / `LDAP_BIND_PASSWORD` | service account |
| `LDAP_SEARCH_BASE` | `ou=people,dc=example,dc=com` |
| `LDAP_SEARCH_FILTER` | `(mail={{email}})` |
| `LDAP_NAME_ATTRIBUTE` / `LDAP_EMAIL_ATTRIBUTE` | `displayName` / `mail` |
| `LDAP_GROUPS_ATTRIBUTE` | `memberOf` |
| `LDAP_GROUP_SEARCH_BASE` / `LDAP_GROUP_SEARCH_FILTER` | `ou=groups,dc=example,dc=com` / `(member={{dn}})` |
| `LDAP_ROLE_ADMIN_GROUPS`, `LDAP_ROLE_EDITOR_GROUPS`, `LDAP_ROLE_OPERATION_GROUPS`, `LDAP_ROLE_VIEWER_GROUPS` | `cn=ops,ou=groups,dc=example,dc=com;sre` (`;` or `\|` separated) |
| `LDAP_DEFAULT_ROLE` | `viewer` |
| `LDAP_TLS_CA_FILE` | `/app/data/ldap-ca.pem` |
| `LDAP_TLS_REJECT_UNAUTHORIZED` | `true` (only set `false` for testing) |
| `LDAP_TIMEOUT_MS` | `5000` |
| `LDAP_LOGIN_MAX_FAILURES` | `5` (default; `0` = no limit) |

Use `ldaps://` or StartTLS: with plain `ldap://` passwords cross the network unencrypted, and OpsiMate logs a warning at startup. If the configuration is incomplete, LDAP stays off and the reason is logged.

For directory accounts, passwords and emails are managed in the directory. OpsiMate hides the password change, admin reset and "forgot password" for them.
