CREATE TABLE `evidence_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`document_id` text NOT NULL,
	`check_id` text NOT NULL,
	`statement` text NOT NULL,
	`quote` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_claims_owner_id` ON `evidence_claims` (`owner_id`,`id`);--> statement-breakpoint
CREATE TABLE `market_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`source_url` text NOT NULL,
	`fingerprint` text NOT NULL,
	`payload` text NOT NULL,
	`observed_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_observations_owner_listing_time` ON `market_observations` (`owner_id`,`listing_id`,`observed_at`);--> statement-breakpoint
CREATE TABLE `source_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`source_url` text,
	`origin` text NOT NULL,
	`text_content` text NOT NULL,
	`text_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_documents_owner_created` ON `source_documents` (`owner_id`,`created_at`);