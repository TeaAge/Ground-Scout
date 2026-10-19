CREATE TABLE `search_documents` (
	`job_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`document_key` text NOT NULL,
	`source_url` text NOT NULL,
	`page_start` integer NOT NULL,
	`payload` text NOT NULL,
	`text_content` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`job_id`, `document_key`)
);
--> statement-breakpoint
CREATE INDEX `idx_search_documents_owner_job` ON `search_documents` (`owner_id`,`job_id`);--> statement-breakpoint
CREATE TABLE `search_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`config` text NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`lease_token` text,
	`lease_until` text,
	`requests` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_search_jobs_owner_updated` ON `search_jobs` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `search_listings` (
	`job_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`listing_key` text NOT NULL,
	`title` text NOT NULL,
	`location` text NOT NULL,
	`source_url` text NOT NULL,
	`source` text NOT NULL,
	`state` text,
	`building` text NOT NULL,
	`solar` text NOT NULL,
	`asking_price` integer,
	`valuation` integer,
	`area` integer,
	`expired` integer DEFAULT 0 NOT NULL,
	`broker` integer DEFAULT 0 NOT NULL,
	`payload` text NOT NULL,
	`first_seen` text NOT NULL,
	`last_seen` text NOT NULL,
	PRIMARY KEY(`job_id`, `listing_key`)
);
--> statement-breakpoint
CREATE INDEX `idx_listings_owner_job` ON `search_listings` (`owner_id`,`job_id`);--> statement-breakpoint
CREATE INDEX `idx_listings_job_price` ON `search_listings` (`owner_id`,`job_id`,`asking_price`);--> statement-breakpoint
CREATE TABLE `search_tasks` (
	`job_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`task_key` text NOT NULL,
	`url` text NOT NULL,
	`host` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`priority` integer DEFAULT 50 NOT NULL,
	`payload` text NOT NULL,
	`report` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`retry_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`job_id`, `task_key`)
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_owner_job_queue` ON `search_tasks` (`owner_id`,`job_id`,`status`,`priority`);--> statement-breakpoint
CREATE INDEX `idx_tasks_owner_host` ON `search_tasks` (`owner_id`,`job_id`,`host`,`status`);