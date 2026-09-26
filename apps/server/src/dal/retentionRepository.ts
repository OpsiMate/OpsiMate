# Data Retention

Admins can configure automatic data retention (Settings → Data Retention).

## What gets purged

| Resource | Default Window |
| --- | --- |
| Audit logs | 90 days |
| Alert history events | 90 days |
| Alert status history | 90 days |
| Active alerts | 30 days (by last update) |
| Resolved alerts | 180 days |
| Alert comments | 365 days |
| Root causes | 365 days |

## Off by default

Every policy starts disabled. No data is deleted until an admin explicitly enables it.

## Schedule

The job runs every 24 hours, with an optional VACUUM afterwards.

## Run now

You can run the job immediately using the "Run now" button in Settings.

## API

- `GET /api/v1/retention`
- `PUT /api/v1/retention/policies/:resource`
- `PUT /api/v1/retention/config`
- `POST /api/v1/retention/run`