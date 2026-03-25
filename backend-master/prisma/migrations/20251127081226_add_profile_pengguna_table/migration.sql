-- CreateTable
CREATE TABLE `profile_pengguna` (
    `no_reg` VARCHAR(20) NOT NULL,
    `profile_pic` VARCHAR(255) NULL,
    `signature_path` VARCHAR(255) NULL,

    PRIMARY KEY (`no_reg`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
