-- AlterTable
ALTER TABLE `messages` ADD COLUMN `readAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `messages_conversationId_readAt_senderId_idx` ON `messages`(`conversationId`, `readAt`, `senderId`);
