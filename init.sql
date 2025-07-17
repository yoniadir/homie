-- Create the rental_apartments table
CREATE TABLE IF NOT EXISTS `rental_apartments` (
  `id` VARCHAR(255) PRIMARY KEY,
  `title` TEXT,
  `price` VARCHAR(255),
  `location` VARCHAR(255),
  `rooms` VARCHAR(255),
  `floor` VARCHAR(255),
  `description` TEXT,
  `image_url` TEXT,
  `link` TEXT NOT NULL,
  `isWhatsappMessageSent` BOOLEAN DEFAULT FALSE,
  `scraped_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_location` (`location`),
  INDEX `idx_price` (`price`),
  INDEX `idx_rooms` (`rooms`),
  INDEX `idx_scraped_at` (`scraped_at`),
  INDEX `idx_link` (`link`),
  INDEX `idx_whatsapp_sent` (`isWhatsappMessageSent`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; 