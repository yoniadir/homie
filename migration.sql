-- Migration: Replace isWhatsappMessageSent with notified_at for notification tracking
-- Run this on existing databases that have the old schema.

-- Add new column
ALTER TABLE rental_apartments
  ADD COLUMN notified_at TIMESTAMP NULL DEFAULT NULL AFTER link;

-- Add index for performance
ALTER TABLE rental_apartments
  ADD INDEX idx_notified_at (notified_at);

-- Migrate existing data: set notified_at for rows that were marked as WhatsApp sent
UPDATE rental_apartments SET notified_at = updated_at WHERE isWhatsappMessageSent = TRUE;

-- Drop old column and index
ALTER TABLE rental_apartments DROP INDEX idx_whatsapp_sent;
ALTER TABLE rental_apartments DROP COLUMN isWhatsappMessageSent;
