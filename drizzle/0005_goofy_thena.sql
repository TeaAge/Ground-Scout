CREATE TABLE `market_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`listing_key` text NOT NULL,
	`job_id` text NOT NULL,
	`event_type` text NOT NULL,
	`origin` text NOT NULL,
	`source_at` text,
	`received_at` text NOT NULL,
	`fingerprint` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_market_events_owner_listing` ON `market_events` (`owner_id`,`listing_key`,`received_at`);--> statement-breakpoint
CREATE TABLE `market_inventory` (
	`owner_id` text NOT NULL,
	`listing_key` text NOT NULL,
	`payload` text NOT NULL,
	`origin` text NOT NULL,
	`fingerprint` text NOT NULL,
	`first_seen` text NOT NULL,
	`last_seen` text NOT NULL,
	`last_source_at` text,
	`last_job_id` text NOT NULL,
	`sightings` integer DEFAULT 1 NOT NULL,
	`change_count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`owner_id`, `listing_key`)
);
--> statement-breakpoint
CREATE INDEX `idx_inventory_owner_seen` ON `market_inventory` (`owner_id`,`last_seen`);