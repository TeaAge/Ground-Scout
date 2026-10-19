CREATE TABLE `crawl_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`source_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_crawl_runs_owner_created` ON `crawl_runs` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `crawl_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`config` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_crawl_sources_owner_updated` ON `crawl_sources` (`owner_id`,`updated_at`);--> statement-breakpoint
ALTER TABLE `source_documents` ADD `metadata` text;