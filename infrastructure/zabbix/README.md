# OpsiMate webhook

## Overview

This guide describes how to integrate your Zabbix installation with [OpsiMate](https://opsimate.dev) using the Zabbix webhook feature. This guide provides instructions on setting up a media type, a user and an action in Zabbix.

Zabbix problem notifications create firing alerts in OpsiMate; the matching recovery notification resolves the alert. Alerts carry the Zabbix severity, host and event tags, and link back to the problem in the Zabbix frontend.

## Requirements

Zabbix version: 7.0 and higher.

OpsiMate version: any release that provides the Zabbix webhook endpoint `POST /api/v1/alerts/custom/zabbix` (OpsiMate 1.x). The OpsiMate server must be reachable from the Zabbix server (not from the Zabbix frontend).

## Parameters

After importing the webhook, you can configure it using webhook parameters.

### Configurable parameters

The configurable parameters are intended to be changed according to the webhook setup as well as the user's preferences and environment.

| Name           | Value                           | Description                                                                                                                                                                                          |
| -------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| opsimate_url   | \<put your OpsiMate URL\>       | Base URL of the OpsiMate server, for example `http://opsimate.example.com:3001`. The webhook path `/api/v1/alerts/custom/zabbix` is appended automatically (a full webhook URL is accepted as well). |
| opsimate_token | \<put your OpsiMate API token\> | OpsiMate API token: the value of the `API_TOKEN` environment variable of the OpsiMate server (default `opsimate`). Sent as the `x-api-token` header.                                                 |
| zabbix_url     | \{$ZABBIX\.URL\}                | Current Zabbix frontend URL. Used by OpsiMate to build the link back to the problem (`tr_events.php?triggerid=...&eventid=...`).                                                                     |

### Internal parameters

Internal parameters are reserved for predefined macros that are not meant to be changed.

| Name                | Value                     | Description                                                                                                                                                              |
| ------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| alert_message       | \{ALERT\.MESSAGE\}        | 'Default message' value from action configuration. Shown as the alert summary in OpsiMate.                                                                               |
| event_date          | \{EVENT\.DATE\}           | Date of the event that triggered an action.                                                                                                                              |
| event_id            | \{EVENT\.ID\}             | Numeric ID of the event that triggered an action. The OpsiMate alert ID is `ZABBIX_<event_id>`.                                                                          |
| event_name          | \{EVENT\.NAME\}           | Name of the problem event.                                                                                                                                               |
| event_recovery_date | \{EVENT\.RECOVERY\.DATE\} | Date of the recovery event. Empty for problem notifications.                                                                                                             |
| event_recovery_time | \{EVENT\.RECOVERY\.TIME\} | Time of the recovery event. Empty for problem notifications.                                                                                                             |
| event_source        | \{EVENT\.SOURCE\}         | Numeric value of the event source. Supported values: 0 - Trigger, 3 - Internal.                                                                                          |
| event_tags          | \{EVENT\.TAGS\}           | A comma-separated list of event tags (`tag:value`). Stored as alert tags in OpsiMate.                                                                                    |
| event_time          | \{EVENT\.TIME\}           | Time of the event that triggered an action.                                                                                                                              |
| event_update_status | \{EVENT\.UPDATE\.STATUS\} | Numeric value of the problem update status. Possible values: 0 - Webhook was called because of problem/recovery event, 1 - Update operation (not forwarded to OpsiMate). |
| event_value         | \{EVENT\.VALUE\}          | Numeric value of the event that triggered an action (1 for problem, 0 for recovering).                                                                                   |
| host_ip             | \{HOST\.IP\}              | IP address of the host. Stored as the `host_ip` alert tag.                                                                                                               |
| host_name           | \{HOST\.NAME\}            | Visible name of the host. Stored as the `host` alert tag.                                                                                                                |
| item_name           | \{ITEM\.NAME\}            | Name of the item that caused the problem.                                                                                                                                |
| item_value          | \{ITEM\.VALUE\}           | Latest value of the item that caused the problem.                                                                                                                        |
| trigger_id          | \{TRIGGER\.ID\}           | Numeric ID of the trigger of this action.                                                                                                                                |
| trigger_name        | \{TRIGGER\.NAME\}         | Name of the trigger. Used as the alert name in OpsiMate.                                                                                                                 |
| trigger_severity    | \{TRIGGER\.SEVERITY\}     | Trigger severity name. Stored as the `severity` alert tag.                                                                                                               |
| trigger_status      | \{TRIGGER\.STATUS\}       | Trigger status: PROBLEM or OK.                                                                                                                                           |
| trigger_url         | \{TRIGGER\.URL\}          | Trigger URL, if the trigger has one. Takes precedence over the link built from `zabbix_url`.                                                                             |

> Please be aware that each webhook supports an HTTP proxy. To use this feature, add a new media type parameter with the name `http_proxy` and set its value to the proxy URL.

## Service setup

1. Deploy OpsiMate following the [OpsiMate getting started guide](https://docs.opsimate.dev/docs/getting-started/deploy). The server listens on port `3001` by default.

2. Find the API token of your OpsiMate server: it is the `API_TOKEN` environment variable of the server (already defined in the provided `docker-compose.yml`; the default value is `opsimate`). Change it from the default in production.

3. Make sure the OpsiMate server URL is reachable from the Zabbix server. OpsiMate running on `localhost` of another machine cannot be reached; expose it behind a reverse proxy or a tunnel.

## Zabbix configuration

The configuration consists of a _media type_ in Zabbix, which will invoke the webhook to send alerts to OpsiMate through the OpsiMate alerts API.

1. Create a global macro `{$ZABBIX.URL}` following instructions in [Zabbix documentation](https://www.zabbix.com/documentation/7.0/manual/config/macros/user_macros) with Zabbix frontend URL - for example, `http://192.168.7.123:8081`.

2. Import the OpsiMate media type from this file [media_opsimate.yaml](media_opsimate.yaml) following instructions in [Zabbix documentation](https://www.zabbix.com/documentation/7.0/manual/web_interface/frontend_sections/alerts/mediatypes).

3. Change the values of the variables:

   - `opsimate_url` (for example, `http://opsimate.example.com:3001`);
   - `opsimate_token` (the `API_TOKEN` of the OpsiMate server).

4. Enable the media type (it is imported disabled).

For more information on Zabbix webhook configuration, see [Zabbix documentation](https://www.zabbix.com/documentation/7.0/manual/config/notifications/media/webhook).

To utilize the media type, it is recommended to create a dedicated Zabbix user to represent OpsiMate.
See more details on creating [Zabbix user](https://www.zabbix.com/documentation/7.0/manual/web_interface/frontend_sections/users/user_list).
The OpsiMate user should suffice the default settings as this user will not be logging into Zabbix. Note that in order to be notified about problems on a host, this user must have at least read permissions for this host.
Add a media of the type `OpsiMate` to this user; the _Send to_ field is not used by the webhook, so any value (for example, `opsimate`) can be entered.
When configuring alert action, add this user in the _Send to users_ field (in Operation details) - this will tell Zabbix to use the OpsiMate webhook when sending notifications from this action.
Use the OpsiMate user in any actions of your choice. The text from "Action Operations" becomes the alert summary in OpsiMate when the problem occurs; the recovery operation of the same action resolves the alert in OpsiMate. Update operations (acknowledgements, messages, severity changes) are accepted by the webhook but not forwarded.

### Testing

Media testing can be done manually, from the `Media types` page. Press the `Test` button opposite the previously defined media type.

1. Leave all `{MACRO}` values as they are and press `Test`: unresolved macros are not sent, and OpsiMate creates a firing alert named `Test Alert` with the summary `Test Alert from Zabbix was created successfully`.
2. To simulate a problem, set `event_id` = `12345`, `trigger_id` = `1`, `trigger_name` = `Media type test`, `event_value` = `1`, `trigger_status` = `PROBLEM`, and press `Test`. A firing alert `ZABBIX_12345` appears in OpsiMate.
3. To close the problem, set `event_value` = `0` and `trigger_status` = `OK` on the test page and press `Test` again. The alert moves to the resolved alerts in OpsiMate.

### Internal alerts

To receive notifications about an internal problem and recovery events in OpsiMate, mark the Custom message checkbox in the internal action configuration and specify custom message templates for problem and recovery operations.
If an internal action operation is configured without a custom message, the notification will not be sent.
Note that this step is required only for notifications about internal events; for other event types specifying a custom message is optional.

See more details on [Notifications upon events](https://www.zabbix.com/documentation/7.0/manual/config/notifications) in Zabbix documentation and on the [Zabbix integration](https://docs.opsimate.dev/docs/integrations/zabbix) in OpsiMate documentation.

### Known issues

OpsiMate stores event tags as `key: value` pairs split on the first colon; a tag value containing a colon is truncated at that colon.

## Feedback

Please report any issues with the media type at [`https://github.com/OpsiMate/OpsiMate/issues`](https://github.com/OpsiMate/OpsiMate/issues).

You can also provide feedback, discuss the media type, or ask for help in the [OpsiMate community Slack](https://join.slack.com/t/opsimate/shared_invite/zt-39bq3x6et-NrVCZzH7xuBGIXmOjJM7gA) or [GitHub issues](https://github.com/OpsiMate/OpsiMate/issues) or at [`ZABBIX forums`](https://www.zabbix.com/forum/zabbix-suggestions-and-feedback).
