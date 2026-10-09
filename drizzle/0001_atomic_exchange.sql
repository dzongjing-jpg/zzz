ALTER TABLE `ledger` ADD `operation_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `ledger_operation_key_unique` ON `ledger` (`operation_key`);