-- CreateTable
CREATE TABLE `swipes` (
    `id` VARCHAR(30) NOT NULL,
    `swiperId` VARCHAR(30) NOT NULL,
    `targetUserId` VARCHAR(30) NOT NULL,
    `action` ENUM('LIKE', 'PASS') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `swipes_targetUserId_action_idx`(`targetUserId`, `action`),
    INDEX `swipes_swiperId_action_idx`(`swiperId`, `action`),
    UNIQUE INDEX `swipes_swiperId_targetUserId_key`(`swiperId`, `targetUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `matches` (
    `id` VARCHAR(30) NOT NULL,
    `userOneId` VARCHAR(30) NOT NULL,
    `userTwoId` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `matches_userOneId_createdAt_idx`(`userOneId`, `createdAt`),
    INDEX `matches_userTwoId_createdAt_idx`(`userTwoId`, `createdAt`),
    UNIQUE INDEX `matches_userOneId_userTwoId_key`(`userOneId`, `userTwoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blocks` (
    `id` VARCHAR(30) NOT NULL,
    `blockerId` VARCHAR(30) NOT NULL,
    `blockedUserId` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `blocks_blockedUserId_idx`(`blockedUserId`),
    UNIQUE INDEX `blocks_blockerId_blockedUserId_key`(`blockerId`, `blockedUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `swipes` ADD CONSTRAINT `swipes_swiperId_fkey` FOREIGN KEY (`swiperId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `swipes` ADD CONSTRAINT `swipes_targetUserId_fkey` FOREIGN KEY (`targetUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matches` ADD CONSTRAINT `matches_userOneId_fkey` FOREIGN KEY (`userOneId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matches` ADD CONSTRAINT `matches_userTwoId_fkey` FOREIGN KEY (`userTwoId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `blocks` ADD CONSTRAINT `blocks_blockerId_fkey` FOREIGN KEY (`blockerId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `blocks` ADD CONSTRAINT `blocks_blockedUserId_fkey` FOREIGN KEY (`blockedUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
