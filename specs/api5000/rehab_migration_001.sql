-- 5000端口统一入口：康复相关增量表（不修改既有 users / reports）
-- MySQL 8.x

-- 统一身份绑定表（二维码/小程序/OpenID/身份证/5002外部患者ID等绑定到 users.id）
CREATE TABLE IF NOT EXISTS `identity_bindings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `id_type` VARCHAR(64) NOT NULL,     -- id_card | mp_openid | qr_token | external_patient_id_5002 | other
  `id_value` VARCHAR(191) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_identity` (`id_type`,`id_value`),
  KEY `idx_user` (`user_id`),
  CONSTRAINT `fk_identity_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 会话表（一次训练/采集）
CREATE TABLE IF NOT EXISTS `rehab_sessions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `session_uuid` VARCHAR(64) NOT NULL,
  `manufacturer` VARCHAR(50) DEFAULT 'golgi',
  `data_version` VARCHAR(20) DEFAULT 'v2.2.0',
  `status` VARCHAR(20) DEFAULT 'active', -- active/completed/failed
  `start_time` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `end_time` TIMESTAMP NULL DEFAULT NULL,
  `notes` VARCHAR(500) DEFAULT NULL,
  `device_id` VARCHAR(64) DEFAULT NULL,
  `instance_id` VARCHAR(64) DEFAULT NULL,
  `app_type` VARCHAR(20) DEFAULT NULL,   -- vue | pyside | miniapp
  `mode` VARCHAR(20) DEFAULT NULL,       -- rehab | client
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_session_uuid` (`session_uuid`),
  KEY `idx_user_time` (`user_id`,`start_time`),
  CONSTRAINT `fk_rehab_session_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- fNIRS数据记录
CREATE TABLE IF NOT EXISTS `rehab_fnirs_records` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `session_id` INT NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `file_size_mb` DECIMAL(10,3) DEFAULT NULL,
  `duration_seconds` INT DEFAULT NULL,
  `channels` INT DEFAULT 432,
  `fs` INT DEFAULT 8,
  `wavelengths` VARCHAR(50) DEFAULT '735,850',
  `metadata_json` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_session` (`session_id`),
  CONSTRAINT `fk_fnirs_session` FOREIGN KEY (`session_id`) REFERENCES `rehab_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 运动数据记录
CREATE TABLE IF NOT EXISTS `rehab_motion_records` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `session_id` INT NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `file_size_mb` DECIMAL(10,3) DEFAULT NULL,
  `duration_seconds` INT DEFAULT NULL,
  `device_name` VARCHAR(100) DEFAULT '康莲设备',
  `metadata_json` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_session` (`session_id`),
  CONSTRAINT `fk_motion_session` FOREIGN KEY (`session_id`) REFERENCES `rehab_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 结束
