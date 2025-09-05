# 热力图重构Story：从D3迁移到ECharts+IDW

## 📋 项目背景

**任务目标**：移除D3热力图依赖，使用现有的ECharts+IDW代码实现统一的热力图渲染方案  
**时间**：2025-09-04  
**执行者**：Claude Code  

## 🎯 核心需求

1. **移除D3依赖**：清理所有D3.js相关的热力图渲染代码
2. **复用现有代码**：充分利用已有的ECharts和IDW插值实现
3. **保留12dock倒梯形**：保持现有的蓝色覆盖区域显示
4. **实现6dock三角形**：正确显示SDK数据（顶部1个、中间2个、底部3个节点）
5. **三层叠加**：大脑图片底层 → 12dock覆盖层 → 6dock热力图顶层

## 📚 现有资源清单

### 可直接复用的核心代码
- ✅ `src/utils/heatmap/interpolation/idw.js` - 完整的IDW插值算法
- ✅ `src/components/training/modes/heatmap/HeatmapReportStyleView.vue` - ECharts热力图组件
- ✅ `src/components/training/modes/heatmap/TriangleDataProcessor.js` - Triangle数据处理器
- ✅ `src/components/training/modes/heatmap/HeatmapCoordinator.js` - 坐标系统管理
- ✅ `src/components/training/modes/heatmap/DockOverlayRenderer.vue` - 12dock覆盖层

### Triangle布局配置文件
- `fnirs_sdk/config/device_profiles/triangle/layout.json` - 6dock基础布局
- `fnirs_sdk/config/device_profiles/triangle/renumbered_full_layout.json` - 12dock完整布局
- `public/config/triangle_layout.json` - 前端访问的三角形布局

## 📝 实施计划

### 阶段1：分析和清理D3依赖 ⏳

#### 1.1 识别D3代码位置
- [ ] 扫描 `BrainModeView.vue` 中的D3相关代码
- [ ] 检查其他组件中的D3引用
- [ ] 分析 `package.json` 中的D3依赖

#### 1.2 清理D3代码
- [ ] 移除D3渲染逻辑
- [ ] 删除D3相关导入语句
- [ ] 清理未使用的D3工具函数

#### 1.3 验证清理效果
- [ ] 确保编译无错误
- [ ] Playwright截图验证界面正常

---

### 阶段2：验证6dock三角形布局 ⏳

#### 2.1 检查Triangle配置
- [ ] 验证 `triangle/layout.json` 中的6个dock位置
- [ ] 确认坐标系统（188.72 × 110.29 mm）
- [ ] 验证三角形布局（顶1、中2、底3）

#### 2.2 验证数据流
- [ ] 检查SDK数据到达前端
- [ ] 验证通道映射正确性
- [ ] 确认432通道数据处理

#### 2.3 截图验证
- [ ] Playwright截图显示6dock位置
- [ ] 验证三角形形状正确

---

### 阶段3：优化HeatmapReportStyleView组件 ⏳

#### 3.1 组件集成优化
- [ ] 确保组件接收正确的props
- [ ] 优化IDW插值参数
- [ ] 调整ECharts配置

#### 3.2 6dock mask优化
- [ ] 实现三角形边界裁剪
- [ ] 优化显示效果
- [ ] 调整颜色映射

#### 3.3 性能优化
- [ ] 优化渲染频率
- [ ] 减少不必要的重绘
- [ ] 内存管理优化

---

### 阶段4：调整三层叠加渲染 ⏳

#### 4.1 层次结构设置
- [ ] 底层：设置大脑图片z-index
- [ ] 中层：12dock覆盖层z-index
- [ ] 顶层：6dock热力图z-index

#### 4.2 透明度和混合
- [ ] 调整12dock覆盖层透明度
- [ ] 优化热力图透明度
- [ ] 确保层次清晰可见

#### 4.3 坐标对齐
- [ ] 验证三层坐标系统一致
- [ ] 调整缩放和位置参数
- [ ] 确保完美对齐

---

### 阶段5：集成测试 ⏳

#### 5.1 功能测试
- [ ] 测试实时数据更新
- [ ] 验证模式切换
- [ ] 测试响应式布局

#### 5.2 Playwright自动化验证
- [ ] 编写测试脚本
- [ ] 截图对比验证
- [ ] 性能测试

#### 5.3 用户验收
- [ ] 完整流程演示
- [ ] 收集反馈
- [ ] 最终优化

---

## 🚀 执行进度

| 阶段 | 任务 | 状态 | 完成时间 | 验证截图 |
|------|------|------|----------|----------|
| 1.1 | 识别D3代码位置 | ⏳ 待开始 | - | - |
| 1.2 | 清理D3代码 | ⏳ 待开始 | - | - |
| 1.3 | 验证清理效果 | ⏳ 待开始 | - | - |
| 2.1 | 检查Triangle配置 | ⏳ 待开始 | - | - |
| 2.2 | 验证数据流 | ⏳ 待开始 | - | - |
| 2.3 | 截图验证 | ⏳ 待开始 | - | - |
| 3.1 | 组件集成优化 | ⏳ 待开始 | - | - |
| 3.2 | 6dock mask优化 | ⏳ 待开始 | - | - |
| 3.3 | 性能优化 | ⏳ 待开始 | - | - |
| 4.1 | 层次结构设置 | ⏳ 待开始 | - | - |
| 4.2 | 透明度和混合 | ⏳ 待开始 | - | - |
| 4.3 | 坐标对齐 | ⏳ 待开始 | - | - |
| 5.1 | 功能测试 | ⏳ 待开始 | - | - |
| 5.2 | Playwright验证 | ⏳ 待开始 | - | - |
| 5.3 | 用户验收 | ⏳ 待开始 | - | - |

## 🔧 技术要点

### IDW插值参数
```javascript
{
  k: 8,              // K近邻数量
  power: 2,          // 距离权重指数
  maxDistance: 35,   // 最大影响距离
  useQualityWeight: true,  // 使用质量权重
  smoothing: true,   // 启用高斯平滑
  sigma: 1.5        // 高斯平滑参数
}
```

### ECharts热力图配置
```javascript
{
  type: 'heatmap',
  visualMap: {
    min: -0.05,
    max: 0.05,
    calculable: false,
    inRange: {
      color: ['#313695', '#4575b4', '#74add1', '#abd9e9', 
              '#e0f3f8', '#fee090', '#fdae61', '#f46d43', 
              '#d73027', '#a50026']
    }
  }
}
```

### 坐标映射参数
```javascript
{
  position: { x: 0.5, y: 0.25 },  // 相对位置
  scale: { x: 0.75, y: 0.6 },     // 缩放比例
  dimensions: { x: 188.72, y: 110.29 }  // Triangle物理尺寸(mm)
}
```

## 📊 预期成果

1. **代码简化**：移除冗余的D3依赖，统一使用ECharts
2. **性能提升**：单一渲染引擎，减少资源消耗
3. **维护性改善**：代码结构更清晰，易于维护
4. **视觉效果**：三层叠加清晰，热力图准确对齐
5. **数据准确性**：完全基于SDK真实数据

## 🔍 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| D3代码耦合度高 | 清理困难 | 逐步替换，保持备份 |
| 坐标系统不一致 | 对齐问题 | 使用统一的坐标管理器 |
| 性能下降 | 用户体验差 | 优化渲染频率和算法 |
| 6dock布局错误 | 显示异常 | 严格验证配置文件 |

## 📝 备注

- 每完成一个小任务立即使用Playwright截图验证
- 保持与用户的及时沟通，确认效果
- 优先复用现有代码，避免重新造轮子
- 关注真实SDK数据的正确性

---

**文档状态**：🟢 执行中  
**最后更新**：2025-09-04  
**下一步**：开始阶段1.1 - 识别D3代码位置