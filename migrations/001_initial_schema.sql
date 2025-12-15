-- ========================================
-- RHC (Resource Health Checker) - Initial Schema
-- PostgreSQL 12+
-- ========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- TABLE: resources (Catalog)
-- ========================================
CREATE TABLE IF NOT EXISTS resources (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    subtype VARCHAR(100),
    enabled BOOLEAN DEFAULT true,
    owner VARCHAR(255),
    env VARCHAR(50),
    criticality VARCHAR(50),
    tags TEXT[], -- Array of strings

    -- Connection info (JSONB for flexibility)
    connection JSONB,
    config JSONB,

    -- Health Policy (JSONB)
    policy JSONB,

    -- Metadata
    source VARCHAR(50), -- 'registry_snapshot', 'manual', 'sync'
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for resources
CREATE INDEX idx_resources_type ON resources(type);
CREATE INDEX idx_resources_subtype ON resources(subtype);
CREATE INDEX idx_resources_enabled ON resources(enabled);
CREATE INDEX idx_resources_env ON resources(env);
CREATE INDEX idx_resources_owner ON resources(owner);
CREATE INDEX idx_resources_criticality ON resources(criticality);
CREATE INDEX idx_resources_tags ON resources USING GIN(tags);

-- ========================================
-- TABLE: health_status (Current Status)
-- ========================================
CREATE TABLE IF NOT EXISTS health_status (
    resource_id VARCHAR(255) PRIMARY KEY REFERENCES resources(id) ON DELETE CASCADE,
    resource_name VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_subtype VARCHAR(100),
    env VARCHAR(50),

    -- Status
    current_status VARCHAR(20) NOT NULL CHECK (current_status IN ('UP', 'DEGRADED', 'DOWN')),
    last_check_at TIMESTAMPTZ NOT NULL,
    last_success_at TIMESTAMPTZ,
    consecutive_failures INTEGER DEFAULT 0,

    -- Summary (JSONB for rich information)
    summary JSONB,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for health_status
CREATE INDEX idx_health_status_current_status ON health_status(current_status);
CREATE INDEX idx_health_status_type ON health_status(resource_type);
CREATE INDEX idx_health_status_env ON health_status(env);
CREATE INDEX idx_health_status_last_check ON health_status(last_check_at DESC);
CREATE INDEX idx_health_status_consecutive_failures ON health_status(consecutive_failures);

-- ========================================
-- TABLE: health_checks (Check History)
-- ========================================
CREATE TABLE IF NOT EXISTS health_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id VARCHAR(255) NOT NULL REFERENCES resources(id) ON DELETE CASCADE,

    -- Execution info
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    execution_type VARCHAR(20) NOT NULL CHECK (execution_type IN ('SCHEDULED', 'MANUAL', 'EVENT')),

    -- Results
    final_status VARCHAR(20) NOT NULL CHECK (final_status IN ('UP', 'DEGRADED', 'DOWN')),
    duration_ms INTEGER,

    -- Metrics and evaluations (JSONB for flexibility)
    metrics JSONB,
    rule_evaluations JSONB,

    -- Error handling
    error_message TEXT,
    collector_debug JSONB,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for health_checks (optimized for common queries)
CREATE INDEX idx_health_checks_resource_id ON health_checks(resource_id);
CREATE INDEX idx_health_checks_executed_at ON health_checks(executed_at DESC);
CREATE INDEX idx_health_checks_final_status ON health_checks(final_status);
CREATE INDEX idx_health_checks_execution_type ON health_checks(execution_type);
CREATE INDEX idx_health_checks_resource_executed ON health_checks(resource_id, executed_at DESC);

-- ========================================
-- TABLE: notification_channels (for future use)
-- ========================================
CREATE TABLE IF NOT EXISTS notification_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('email', 'slack', 'webhook', 'teams', 'pagerduty')),
    enabled BOOLEAN DEFAULT true,

    -- Channel configuration (JSONB)
    config JSONB NOT NULL,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_channels_type ON notification_channels(type);
CREATE INDEX idx_notification_channels_enabled ON notification_channels(enabled);

-- ========================================
-- TABLE: alert_rules (for future use)
-- ========================================
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_id VARCHAR(255) REFERENCES resources(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT true,

    -- Condition (e.g., "status == DOWN" or "consecutive_failures > 3")
    condition TEXT NOT NULL,

    -- Notification channels (array of UUIDs)
    channel_ids UUID[],

    -- Cooldown (ISO-8601 duration, e.g., "PT5M" = 5 minutes)
    cooldown VARCHAR(50),
    last_triggered_at TIMESTAMPTZ,

    -- Escalation
    escalate_after VARCHAR(50), -- ISO-8601 duration
    escalation_channel_ids UUID[],

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alert_rules_resource_id ON alert_rules(resource_id);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);

-- ========================================
-- TABLE: alert_history (for future use)
-- ========================================
CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_rule_id UUID REFERENCES alert_rules(id) ON DELETE CASCADE,
    resource_id VARCHAR(255) NOT NULL,

    -- Trigger info
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status_at_trigger VARCHAR(20) NOT NULL,

    -- Notification results
    channels_notified JSONB, -- { "channel_id": "success/failed", ... }

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alert_history_triggered_at ON alert_history(triggered_at DESC);
CREATE INDEX idx_alert_history_resource_id ON alert_history(resource_id);

-- ========================================
-- FUNCTION: Update updated_at timestamp
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- TRIGGERS: Auto-update updated_at
-- ========================================
CREATE TRIGGER update_resources_updated_at
    BEFORE UPDATE ON resources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_health_status_updated_at
    BEFORE UPDATE ON health_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_channels_updated_at
    BEFORE UPDATE ON notification_channels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_rules_updated_at
    BEFORE UPDATE ON alert_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- FUNCTION: Cleanup old health_checks
-- ========================================
-- Keep only last 5000 checks per resource (matching memory store limit)
CREATE OR REPLACE FUNCTION cleanup_old_health_checks()
RETURNS void AS $$
BEGIN
    DELETE FROM health_checks
    WHERE id IN (
        SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY resource_id ORDER BY executed_at DESC) as rn
            FROM health_checks
        ) sub
        WHERE rn > 5000
    );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- COMMENTS (Documentation)
-- ========================================
COMMENT ON TABLE resources IS 'Catalog of all monitored resources';
COMMENT ON TABLE health_status IS 'Current health status of each resource (one row per resource)';
COMMENT ON TABLE health_checks IS 'Historical record of all health checks executed';
COMMENT ON TABLE notification_channels IS 'Configuration for notification channels (email, slack, etc)';
COMMENT ON TABLE alert_rules IS 'Alert rules configuration for resources';
COMMENT ON TABLE alert_history IS 'History of triggered alerts';

COMMENT ON COLUMN resources.connection IS 'Connection details (endpoint, auth, etc) as JSON';
COMMENT ON COLUMN resources.config IS 'Additional configuration specific to resource type as JSON';
COMMENT ON COLUMN resources.policy IS 'Health check policy (schedule, metrics, rules) as JSON';
COMMENT ON COLUMN health_status.summary IS 'Rich summary with message, failed_rules, key_metrics, runtime_dependencies, connection_info as JSON';
COMMENT ON COLUMN health_checks.metrics IS 'Collected metrics from the check as JSON';
COMMENT ON COLUMN health_checks.rule_evaluations IS 'Result of rule evaluations as JSON';
