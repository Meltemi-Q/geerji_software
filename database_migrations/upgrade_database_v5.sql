-- 戈尔基康复训练系统数据库升级脚本 v5.0
-- 日期: 2025-09-04
-- 目的: 支持患者详细信息、训练会话、截图数据存储

-- 备份现有数据库
PRAGMA foreign_keys = OFF;

-- 扩展患者表，增加详细健康信息
ALTER TABLE patients ADD COLUMN phone VARCHAR(20) DEFAULT NULL;
ALTER TABLE patients ADD COLUMN height REAL DEFAULT NULL;
ALTER TABLE patients ADD COLUMN weight REAL DEFAULT NULL;
ALTER TABLE patients ADD COLUMN bmi REAL DEFAULT NULL;
ALTER TABLE patients ADD COLUMN blood_pressure_systolic INTEGER DEFAULT NULL;
ALTER TABLE patients ADD COLUMN blood_pressure_diastolic INTEGER DEFAULT NULL;
ALTER TABLE patients ADD COLUMN hypertension BOOLEAN DEFAULT 0;
ALTER TABLE patients ADD COLUMN diabetes BOOLEAN DEFAULT 0;
ALTER TABLE patients ADD COLUMN smoking BOOLEAN DEFAULT 0;
ALTER TABLE patients ADD COLUMN heart_disease BOOLEAN DEFAULT 0;
ALTER TABLE patients ADD COLUMN dyslipidemia BOOLEAN DEFAULT 0;
ALTER TABLE patients ADD COLUMN risk_level VARCHAR(20) DEFAULT NULL;

-- 创建训练会话表
CREATE TABLE IF NOT EXISTS training_sessions (
    session_id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(20) NOT NULL,
    session_start DATETIME NOT NULL,
    session_end DATETIME DEFAULT NULL,
    training_mode VARCHAR(20) NOT NULL, -- 'brain', 'heatmap', 'curve', 'game'
    total_duration INTEGER DEFAULT NULL, -- 总训练时长（秒）
    hbo_avg REAL DEFAULT NULL,           -- 平均血氧值
    hbo_max REAL DEFAULT NULL,           -- 最大血氧值
    hbo_min REAL DEFAULT NULL,           -- 最小血氧值
    data_quality_score REAL DEFAULT NULL, -- 数据质量评分
    screenshot_path TEXT DEFAULT NULL,   -- 截图文件路径
    assessment_summary TEXT DEFAULT NULL, -- 评估总结
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
);

-- 创建血氧数据记录表（用于存储实时数据点）
CREATE TABLE IF NOT EXISTS hbo_data_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id VARCHAR(50) NOT NULL,
    timestamp_ms BIGINT NOT NULL,       -- 毫秒级时间戳
    hbo_value REAL NOT NULL,            -- 血氧值
    channel_id INTEGER DEFAULT NULL,    -- 通道ID
    data_quality REAL DEFAULT NULL,     -- 数据质量
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES training_sessions(session_id)
);

-- 扩展数据记录表，支持更多数据类型
ALTER TABLE data_records ADD COLUMN session_id VARCHAR(50) DEFAULT NULL;
ALTER TABLE data_records ADD COLUMN report_type VARCHAR(20) DEFAULT NULL; -- 'screenshot', 'pdf', 'hbo_data', 'assessment'
ALTER TABLE data_records ADD COLUMN mime_type VARCHAR(50) DEFAULT NULL;
ALTER TABLE data_records ADD COLUMN metadata TEXT DEFAULT NULL; -- JSON格式的元数据

-- 创建索引提高查询性能
CREATE INDEX IF NOT EXISTS idx_training_sessions_patient_id ON training_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_start_time ON training_sessions(session_start);
CREATE INDEX IF NOT EXISTS idx_hbo_data_points_session_id ON hbo_data_points(session_id);
CREATE INDEX IF NOT EXISTS idx_hbo_data_points_timestamp ON hbo_data_points(timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_data_records_session_id ON data_records(session_id);

-- 重新启用外键约束
PRAGMA foreign_keys = ON;

-- 验证表结构
SELECT 'DATABASE UPGRADE v5.0 COMPLETED' as status;
SELECT count(*) as total_patients FROM patients;
SELECT count(*) as total_sessions FROM training_sessions;
SELECT count(*) as total_data_records FROM data_records;