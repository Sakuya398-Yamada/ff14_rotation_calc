CREATE TABLE `user_owners` (
	`owner_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`linked_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_user_owners_user` ON `user_owners` (`user_id`);