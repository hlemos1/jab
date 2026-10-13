CREATE TABLE `demo_class_runs` (
	`scope_id` text NOT NULL,
	`id` text NOT NULL,
	`plan_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`input` text NOT NULL,
	`plan` text NOT NULL,
	`timing` text NOT NULL,
	`state` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`last_command_id` text,
	`last_command_json` text,
	PRIMARY KEY(`scope_id`, `id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `demo_class_runs_one_active` ON `demo_class_runs` (`scope_id`) WHERE "demo_class_runs"."active" = 1;