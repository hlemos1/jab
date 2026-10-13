CREATE TABLE `demo_unit_classes` (
	`unit_id` text NOT NULL,
	`id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`request_input` text NOT NULL,
	`input` text NOT NULL,
	`plan` text NOT NULL,
	`timing` text NOT NULL,
	`state` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`last_command_id` text,
	`last_command_json` text,
	PRIMARY KEY(`unit_id`, `id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `demo_unit_classes_one_active` ON `demo_unit_classes` (`unit_id`) WHERE "demo_unit_classes"."active" = 1;