CREATE TABLE `demo_unit_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`role` text NOT NULL,
	`code_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`claimed_by` text,
	`claimed_at` text,
	`claim_nonce` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `demo_unit_invites_hash` ON `demo_unit_invites` (`code_hash`);--> statement-breakpoint
CREATE TABLE `demo_unit_members` (
	`unit_id` text NOT NULL,
	`scope_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`unit_id`, `scope_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `demo_unit_members_id` ON `demo_unit_members` (`id`);--> statement-breakpoint
CREATE TABLE `demo_units` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_scope` text NOT NULL,
	`name` text NOT NULL,
	`owner_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `demo_units_owner` ON `demo_units` (`owner_scope`);