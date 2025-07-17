-- Add the new column to existing table
ALTER TABLE rental_apartments 
ADD COLUMN isWhatsappMessageSent BOOLEAN DEFAULT FALSE;

-- Add index for performance
ALTER TABLE rental_apartments 
ADD INDEX idx_whatsapp_sent (isWhatsappMessageSent); 