CREATE TABLE `llm_snapshot_items` (
	`snapshot_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`listing_key` text NOT NULL,
	`position` integer NOT NULL,
	`payload` text NOT NULL,
	`source_text` text NOT NULL,
	PRIMARY KEY(`snapshot_id`, `listing_key`)
);
--> statement-breakpoint
CREATE INDEX `idx_llm_items_owner_snapshot_position` ON `llm_snapshot_items` (`owner_id`,`snapshot_id`,`position`);--> statement-breakpoint
CREATE TABLE `llm_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`metadata` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_llm_snapshots_owner_created` ON `llm_snapshots` (`owner_id`,`created_at`);