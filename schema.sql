-- Job Scheduler — database schema
-- Import this once in Hostinger hPanel > Databases > phpMyAdmin.
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS.
--
-- IMPORTANT (fixes "#1046 - No database selected"):
--   On Hostinger you cannot CREATE DATABASE from SQL — create the database in
--   hPanel > Databases first, then either:
--     (a) click that database in phpMyAdmin's left sidebar BEFORE running this, or
--     (b) keep the USE line below (set to this account's database).

USE `u152711565_Jobsched`;

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ---------------------------------------------------------------------------
-- Single admin user (just you). Password is set during deploy (see DEPLOY.md).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_user (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(64)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- OAuth tokens for Google (one row, provider = 'google').
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oauth_tokens (
  provider      VARCHAR(32)  NOT NULL,
  access_token  TEXT         NULL,
  refresh_token TEXT         NULL,
  expires_at    INT UNSIGNED NULL,
  scope         TEXT         NULL,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Clients (kitchen / joinery companies you install for).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(160) NOT NULL,
  email      VARCHAR(190) NULL,
  phone      VARCHAR(60)  NULL,
  notes      TEXT         NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Jobs (the install pipeline).
--   status: pending | confirmed | cancelled | completed
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jobs (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id       INT UNSIGNED NULL,
  title           VARCHAR(200) NOT NULL,
  client_name     VARCHAR(160) NULL,
  client_email    VARCHAR(190) NULL,
  location        VARCHAR(255) NULL,
  description     TEXT         NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
  starts_at       DATETIME     NULL,
  ends_at         DATETIME     NULL,
  gcal_event_id   VARCHAR(255) NULL,
  drive_folder_id VARCHAR(255) NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_status (status),
  KEY idx_starts (starts_at),
  CONSTRAINT fk_jobs_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Maintenance reports — one per report, attached to a job.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id      INT UNSIGNED NOT NULL,
  site        VARCHAR(255) NULL,
  technician  VARCHAR(160) NULL,
  report_date DATE         NULL,
  summary     TEXT         NULL,
  recommendations TEXT     NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_job (job_id),
  CONSTRAINT fk_reports_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Report line items — the "custom depending on the job" part.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_items (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id     INT UNSIGNED NOT NULL,
  position      INT          NOT NULL DEFAULT 0,
  area          VARCHAR(200) NULL,
  item_condition VARCHAR(120) NULL,
  action_taken  TEXT         NULL,
  recommendation TEXT        NULL,
  cost          DECIMAL(10,2) NULL,
  PRIMARY KEY (id),
  KEY idx_report (report_id),
  CONSTRAINT fk_items_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Seed your 3 existing clients (migrated from the Base44 dashboard).
-- ---------------------------------------------------------------------------
INSERT INTO clients (name, email) VALUES
  ('Mii Kitchens', NULL),
  ('Harrington Kitchens', NULL),
  ('Peter Baldwin', NULL);
