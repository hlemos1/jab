CREATE TABLE `demo_class_reports` (
	`scope_id` text NOT NULL,
	`id` text NOT NULL,
	`created_at` text NOT NULL,
	`request_id` text NOT NULL,
	`payload` text NOT NULL,
	`hash` text NOT NULL,
	PRIMARY KEY(`scope_id`, `id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `demo_class_reports_request` ON `demo_class_reports` (`scope_id`,`request_id`);