CREATE TABLE `timelines` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`schema_ver` integer NOT NULL,
	`data` text NOT NULL,
	`job` text NOT NULL,
	`level` integer NOT NULL,
	`title` text,
	`content_id` text,
	`owner_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `timelines`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "timelines_data_json_valid" CHECK(json_valid("timelines"."data"))
);
--> statement-breakpoint
CREATE INDEX `idx_timelines_owner` ON `timelines` (`owner_hash`,`created_at`);