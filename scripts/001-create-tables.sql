-- SafetyGuard Database Schema
-- Creates all tables for the application

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);

-- Analysis runs table
CREATE TABLE IF NOT EXISTS analysis_runs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    repo_url VARCHAR(512),
    upload_id VARCHAR(36),
    branch VARCHAR(255) NOT NULL DEFAULT 'main',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    enabled_agents JSONB NOT NULL DEFAULT '{}',
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    error_message VARCHAR(2000),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    repo_url VARCHAR(512),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Safety reports table
CREATE TABLE IF NOT EXISTS safety_reports (
    id VARCHAR(36) PRIMARY KEY,
    run_id VARCHAR(36) NOT NULL UNIQUE REFERENCES analysis_runs(id),
    overall_score FLOAT NOT NULL,
    dimension_scores JSONB NOT NULL,
    findings JSONB NOT NULL,
    dependency_graph JSONB,
    code_graph JSONB,
    code_index_status VARCHAR(32),
    code_index_error VARCHAR(2000),
    executive_summary VARCHAR(5000),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- User app settings table
CREATE TABLE IF NOT EXISTS user_app_settings (
    user_id VARCHAR(36) PRIMARY KEY REFERENCES users(id),
    data JSONB NOT NULL DEFAULT '{}'
);

-- Workflow webhooks table
CREATE TABLE IF NOT EXISTS workflow_webhooks (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    name VARCHAR(120) NOT NULL,
    url VARCHAR(2048) NOT NULL,
    secret VARCHAR(512),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_workflow_webhooks_user_id ON workflow_webhooks(user_id);

-- Create anonymous user for non-authenticated access
INSERT INTO users (id, email, hashed_password, full_name, is_active, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'anon@safetyguard.local',
    '',
    'Anonymous',
    TRUE,
    NOW()
)
ON CONFLICT (id) DO NOTHING;
