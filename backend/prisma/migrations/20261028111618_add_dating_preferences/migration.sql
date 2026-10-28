-- AlterTable
ALTER TABLE `user_profiles` ADD COLUMN `maxPreferredAge` INTEGER NULL,
    ADD COLUMN `minPreferredAge` INTEGER NULL,
    ADD COLUMN `preferredGender` VARCHAR(40) NULL,
    ADD COLUMN `relationshipGoal` VARCHAR(60) NULL;
