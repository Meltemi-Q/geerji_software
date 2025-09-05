# Phase 8: 端到端测试验证计划

## 测试概述
验证完整的云端数据同步功能，从患者信息登记到训练完成的全流程测试。

## 测试环境准备

### 1. 服务器环境检查
- ✅ 服务器地址: 36.134.11.254:5002
- ✅ 数据库: 已扩展的 geerji.db (patients, training_sessions, hbo_data_points表)
- ✅ API服务: api_server_v4.py 运行状态

### 2. 前端环境检查
- ✅ 开发服务器: http://localhost:3000
- ✅ 所有依赖模块已导入
- ✅ 本地存储功能正常

## 测试用例设计

### Test Case 1: 患者信息登记与上传
**目标**: 验证患者信息能正确上传到云端
**步骤**:
1. 进入待机界面
2. 点击基础信息登记
3. 填写完整患者信息
4. 提交并验证上传状态
5. 检查服务器数据库 patients 表

**期望结果**:
- 前端显示上传成功状态
- 服务器数据库新增患者记录
- localStorage 保存 current_patient_id

### Test Case 2: 训练会话完整流程
**目标**: 验证训练会话的创建、数据收集和结束流程
**步骤**:
1. 完成患者登记后开始训练
2. 验证训练会话自动创建
3. 模式切换测试（大脑→热力图→曲线→游戏）
4. 验证血氧数据实时收集
5. 正常停止训练
6. 验证会话完成和数据上传

**期望结果**:
- 训练会话成功创建 (training_sessions表)
- 血氧数据批量上传 (hbo_data_points表)
- 会话状态正确管理
- 训练时长计算准确

### Test Case 3: 评估报告生成与截图上传
**目标**: 验证评估界面的截图捕获和上传功能
**步骤**:
1. 完成训练进入评估界面
2. 验证评估数据显示正确
3. 点击"保存记录"按钮
4. 验证截图捕获过程
5. 验证云端上传状态
6. 检查服务器端截图文件

**期望结果**:
- 评估界面正确渲染
- 截图捕获成功（包含四个卡片内容）
- 截图成功上传到服务器
- 完整会话数据包上传成功

### Test Case 4: 异常情况处理
**目标**: 验证网络中断、服务器异常等情况的处理
**步骤**:
1. 模拟网络中断情况
2. 验证本地数据缓存机制
3. 恢复网络连接
4. 验证数据重试上传功能
5. 测试紧急停止功能

**期望结果**:
- 离线模式正常工作
- 数据缓存在 localStorage
- 网络恢复后自动重传
- 紧急停止正确结束会话

### Test Case 5: 会话恢复功能
**目标**: 验证应用重启后的会话恢复
**步骤**:
1. 开始训练会话但不完成
2. 刷新浏览器或重启应用
3. 验证会话恢复提示
4. 验证数据完整性

**期望结果**:
- 未完成会话能正确检测
- 过期会话自动清理
- 有效会话能正确恢复

## 数据验证检查点

### 数据库验证
```sql
-- 检查患者数据
SELECT * FROM patients ORDER BY created_at DESC LIMIT 5;

-- 检查训练会话
SELECT * FROM training_sessions ORDER BY session_start DESC LIMIT 5;

-- 检查血氧数据
SELECT session_id, COUNT(*) as data_count, 
       AVG(hbo_value) as avg_hbo,
       MIN(timestamp_ms) as start_time,
       MAX(timestamp_ms) as end_time
FROM hbo_data_points 
GROUP BY session_id 
ORDER BY start_time DESC 
LIMIT 5;

-- 检查截图上传记录
SELECT * FROM data_records 
WHERE data_type = 'screenshot' 
ORDER BY created_at DESC LIMIT 5;
```

### 前端状态验证
```javascript
// 检查本地存储状态
console.log('Patient ID:', localStorage.getItem('current_patient_id'));
console.log('Session ID:', localStorage.getItem('current_session_id'));
console.log('Current Session:', localStorage.getItem('current_session'));

// 检查会话管理器状态
console.log('Session Status:', sessionManager.getSessionStatus());
```

## 性能基准测试

### 数据上传性能
- 批量血氧数据上传: 目标 < 2秒/100数据点
- 截图上传: 目标 < 5秒/张
- 患者信息上传: 目标 < 1秒

### 内存使用检查
- 长时间训练内存增长检查
- 数据缓存内存占用监控
- 浏览器性能影响评估

## 兼容性测试

### 浏览器兼容性
- Chrome (主要目标)
- Edge 
- Firefox (备选)

### 设备兼容性
- 平板设备 (主要目标)
- 桌面浏览器
- 不同分辨率适配

## 测试执行计划

### 阶段1: 基础功能验证 (30分钟)
- Test Case 1: 患者信息上传
- Test Case 2: 基础训练会话

### 阶段2: 完整流程测试 (45分钟)
- Test Case 2: 完整训练流程
- Test Case 3: 评估报告生成

### 阶段3: 异常情况测试 (30分钟)
- Test Case 4: 网络中断处理
- Test Case 5: 会话恢复

### 阶段4: 性能与兼容性 (15分钟)
- 性能基准测试
- 多浏览器兼容性检查

## 问题记录模板

```markdown
### Bug Report #[序号]
**问题描述**: [详细描述]
**复现步骤**: [步骤列表]
**期望结果**: [期望行为]
**实际结果**: [实际行为]  
**优先级**: [高/中/低]
**状态**: [待修复/已修复/已验证]
**修复方案**: [解决方案描述]
```

## 测试通过标准

✅ 所有核心功能测试用例通过  
✅ 数据库记录完整无误  
✅ 云端上传成功率 > 95%  
✅ 异常情况处理正确  
✅ 性能指标达标  
✅ 无严重内存泄漏  
✅ 主要浏览器兼容性正常  

---

**测试负责人**: Claude  
**创建时间**: 2025-09-04  
**计划完成时间**: 2025-09-04  