-- 会话级报告关联表（会话→报告）
CREATE TABLE IF NOT EXISTS `rehab_session_reports` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `session_id` INT NOT NULL,
  `report_id` INT NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_session_report` (`session_id`,`report_id`),
  KEY `idx_session` (`session_id`),
  KEY `idx_report` (`report_id`),
  CONSTRAINT `fk_session_reports_session` FOREIGN KEY (`session_id`) REFERENCES `rehab_sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_session_reports_report` FOREIGN KEY (`report_id`) REFERENCES `reports` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
