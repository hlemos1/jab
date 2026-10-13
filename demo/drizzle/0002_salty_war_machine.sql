CREATE TABLE `demo_class_plans` (
	`scope_id` text NOT NULL,
	`id` text NOT NULL,
	`created_at` text NOT NULL,
	`input` text NOT NULL,
	`plan` text NOT NULL,
	PRIMARY KEY(`scope_id`, `id`)
);
