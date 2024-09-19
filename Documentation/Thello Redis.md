# Thello Redis notifications

## EVENT_RECORDING

## EVENT_TENANT_CONFIG_CHANGED
This event can be sent to trigger an immediate reload/configuration for specified tenant
the TierGroupBackgroundServiceQueue calls the method UpdateTenantConfigAsync()
The same method is also called for every tenant of the tiergroup at startup
Once completed, the UpdateTenantConfigBatchCompletedAsync() method is called once


The core service reacts to this event by:
- Recompiling KSL scripts
- Sending to every phone having at least one active sip account
-- a notification to provision
-- a notification to download phonebook (if supported by phone model)

The provisioning service reacts to this event by:
- Generate asterisk config files
- Reload asterisk config if needed

## EVENT_TENANT_CONFIG_UPDATING
Indicates to user-interface that a tenant config is under progress
the Portal reacts to this event by displaying a blue popup once completed
possible states are defined in enum TenantUpdatingState

## EVENT_TENANT_NOTIFICATION
Send a notification for specified tenant

## EVENT_TENANT_ACTIVE_BLOC
## EVENT_PHONE_EXTERNAL_SYNC
## EVENT_PHONE_DIAL
