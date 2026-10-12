CREATE TABLE `demo_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`avatar` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `demo_redemptions` (
	`guest_id` text NOT NULL,
	`benefit` text NOT NULL,
	`cost` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`guest_id`, `benefit`)
);
--> statement-breakpoint
CREATE TABLE `demo_sessions` (
	`id` text NOT NULL,
	`guest_id` text NOT NULL,
	`created_at` text NOT NULL,
	`result` text NOT NULL,
	`hash` text NOT NULL,
	`reward` integer NOT NULL,
	`chain_status` text DEFAULT 'not_submitted' NOT NULL,
	`signature` text,
	`chain_error` text,
	`anchor_at` text,
	PRIMARY KEY(`guest_id`, `id`)
);
