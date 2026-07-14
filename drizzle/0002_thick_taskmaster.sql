ALTER TYPE "public"."DeviceType" ADD VALUE 'tablet';--> statement-breakpoint
ALTER TABLE "DeviceSession" ADD COLUMN "deviceHash" text;--> statement-breakpoint
ALTER TABLE "DeviceSession" ADD COLUMN "deviceLabel" text;--> statement-breakpoint
ALTER TABLE "DeviceSession" ADD COLUMN "osInfo" text;--> statement-breakpoint
ALTER TABLE "DeviceSession" ADD COLUMN "lockedByDeviceLabel" text;--> statement-breakpoint
ALTER TABLE "GlobalSessionLockSettings" ADD COLUMN "allowDesktop" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "GlobalSessionLockSettings" ADD COLUMN "allowTablet" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "GlobalSessionLockSettings" ADD COLUMN "allowMobile" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "GlobalSessionLockSettings" ADD COLUMN "maxConcurrentSessions" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "isSessionLockedExempt" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "VideoLibraryNode" ADD COLUMN "attachments" jsonb;