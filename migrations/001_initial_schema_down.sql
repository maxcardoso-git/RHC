-- ========================================
-- RHC (Resource Health Checker) - Rollback Initial Schema
-- ========================================

-- Drop triggers
DROP TRIGGER IF EXISTS update_alert_rules_updated_at ON alert_rules;
DROP TRIGGER IF EXISTS update_notification_channels_updated_at ON notification_channels;
DROP TRIGGER IF EXISTS update_health_status_updated_at ON health_status;
DROP TRIGGER IF EXISTS update_resources_updated_at ON resources;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS cleanup_old_health_checks();

-- Drop tables (in reverse order of creation due to foreign keys)
DROP TABLE IF EXISTS alert_history;
DROP TABLE IF EXISTS alert_rules;
DROP TABLE IF EXISTS notification_channels;
DROP TABLE IF EXISTS health_checks;
DROP TABLE IF EXISTS health_status;
DROP TABLE IF EXISTS resources;

-- Note: We don't drop the uuid-ossp extension as it might be used by other schemas
