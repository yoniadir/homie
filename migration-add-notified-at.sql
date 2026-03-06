-- Add notified_at for Telegram (and other) notification tracking.
-- Run this if you get: Unknown column 'notified_at' in 'field list'
-- Safe to run on tables that don't have the old isWhatsappMessageSent column.

-- Add column (ignore error if it already exists)
ALTER TABLE rental_apartments
  ADD COLUMN notified_at TIMESTAMP NULL DEFAULT NULL AFTER link;

-- Add index (ignore error if it already exists)
ALTER TABLE rental_apartments
  ADD INDEX idx_notified_at (notified_at);
