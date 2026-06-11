CREATE TABLE `check_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`checkId` int NOT NULL,
	`category` enum('yakujiho','keihyo','iryokokoku','other') NOT NULL,
	`riskLevel` enum('high','medium','low') NOT NULL,
	`violationText` text,
	`reason` text NOT NULL,
	`suggestion` text,
	`legalBasis` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `check_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`imageUrl` text NOT NULL,
	`imageKey` varchar(512) NOT NULL,
	`fileName` varchar(255),
	`extractedText` text,
	`overallRisk` enum('high','medium','low','safe') NOT NULL DEFAULT 'safe',
	`totalViolations` int NOT NULL DEFAULT 0,
	`summary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `checks_id` PRIMARY KEY(`id`)
);
