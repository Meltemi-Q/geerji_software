### Story: 专业大脑模式热力图——瞬时刷新与固定结构优化

#### 背景与问题
- **现象**: 热力图出现“从下往上/从上到下”渐进式刷新；视觉抖动；颜色不随 SDK 数据变化；console 噪音多。
- **根因**:
  - 父子组件同时改写容器定位/尺寸，频繁触发 ECharts `resize`。
  - 子组件未禁用 ECharts 渐进渲染/动画。
  - 固定结构只做一半，仍有重建路径。
  - SDK 数据与通道未稳定映射。

#### 目标
- **瞬时切换**: 帧间“保持上一帧 → 瞬时替换新帧”，无渐进铺色。
- **固定结构**: 首帧初始化网格/mask/邻居；后续仅更新数值。
- **数据驱动**: SDK `hboData` 变化实时体现在颜色上。
- **去抖**: 父负责定位，子只铺满容器并按尺寸变化 `resize()`。
- **降噪**: 精简冗余代码与 console。

---

### 验收标准
- 进入页面后热力图范围固定；无周期性对齐/`resize`；窗口 `resize` 才触发一次 `chart.resize()`。
- 帧更新无上下渐进铺色，直接瞬时替换。
- SDK `hboData` 变化即刻反映在颜色上。
- 移除周期性 `setInterval` 刷新与重复对齐逻辑；控制台仅保留关键日志。

---

### 设计决策
- **对齐职责**: 父组件 `BrainModeView` 负责定位/尺寸；子组件 `HeatmapReportStyleView` 不再计算/写入 left/top/width/height，只负责 `resize()`。
- **渲染策略**: 禁用 ECharts 渐进与动画；更新使用 `replaceMerge: ['series']` 覆盖系列。
- **结构策略**: 首帧构建 `fixedGridInfo/fixedInterpolator/precomputedNeighbors`；后续只更新数值网格。
- **数据策略**: 标准化 SDK 数据（数组/Map/Object），按 `channelId` 或 index 一一映射。

---

### 精准修改

#### 1) `src/components/training/modes/HeatmapReportStyleView.vue`
- 新增：SDK 数据标准化函数（放在固定结构函数上方）。
```js
function normalizeHboData(raw, channelPositions) {
  const n = channelPositions?.length || 0
  if (!raw) return new Array(n).fill(0)

  if (Array.isArray(raw)) {
    return Array.from({ length: n }, (_, i) => {
      const v = raw[i]
      const x = Array.isArray(v) ? Number(v?.[0]) : Number(v)
      return Number.isFinite(x) ? x : 0
    })
  }

  const map = raw instanceof Map ? raw : new Map(Object.entries(raw || {}))
  return Array.from({ length: n }, (_, i) => {
    const id = channelPositions[i]?.channelId ?? i
    const v = map.get?.(String(id)) ?? map.get?.(id) ?? raw?.[id]
    const x = Array.isArray(v) ? Number(v?.[0]) : Number(v)
    return Number.isFinite(x) ? x : 0
  })
}
```
- 修改：`fastUpdateHeatmapData()` 使用标准化后的 SDK 数据。
```js
const currentData = normalizeHboData(props.hboData, props.channelPositions)
```
- 修改：初始化与每次更新的 series，禁用渐进/动画；稳定 `id`；更新使用 `replaceMerge`。
```js
const series = [{
  id: 'hmap',
  type: 'heatmap',
  name: 'hbo-heatmap',
  data: heatmapData,
  z: 3,
  emphasis: { disabled: true },
  progressive: 0,
  progressiveThreshold: 0,
  animation: false,
  animationDuration: 0,
  animationDurationUpdate: 0
}]
mainChart.setOption({ series }, { replaceMerge: ['series'], lazyUpdate: true })
```
- 删除：子组件对齐逻辑
  - 移除 `calculateHeatmapPosition()` 与 `applyHeatmapAlignment()`。
  - 移除初始化后 `setTimeout(applyHeatmapAlignment, 100)`。
  - 移除 `watch(props.alignment, ...)`。
- 简化尺寸监听：仅在尺寸变化时 `mainChart.resize()`，不改 DOM 样式。
```js
if (!window.ResizeObserver) {
  const handleResize = () => { if (mainChart && !mainChart.isDisposed()) mainChart.resize() }
  window.addEventListener('resize', handleResize)
  return () => window.removeEventListener('resize', handleResize)
}
resizeObserver = new ResizeObserver(() => {
  if (mainChart && !mainChart.isDisposed()) mainChart.resize()
})
```
- 简化数据监听：移除 `cancelIdleCallback` 相关；变更为直接更新。
```js
watch([() => props.hboData, () => props.channelPositions], () => {
  if (!isEChartsReady) return
  updateHeatmapDisplay()
}, { deep: true, immediate: false })
```
- Loading 控制：帧更新不再设置 `isLoading`（仅初始化阶段可用）。
- Console 清理：保留 error；大对象/高频 log 注释或置于调试开关。

#### 2) `src/components/training/modes/BrainModeView.vue`
- 删除：周期性定位与刷新
  - 移除 `setupResponsiveUpdates()` 内的 `syncInterval` 与滚动监听。
  - 移除 `startUpdateLoop()` / `updateHeatmapRender()` 及其调用。
- 覆盖层去冗余（二选一保留）：
  - 保留 `overlayPoints/overlayViewBox`（`coverageOverlayRef` `<polygon>`）。
  - 删除 `coverageAreaRef`、`createCoverageAreaSVG()`、`updateCoverageArea()` 及所有调用。
- Console 清理：删除频繁 DOMRect dump 和帧级日志，保留关键错误/一次性信息。

#### 3) 删除未用/备份文件
- 删除 `src/components/training/modes/heatmap/HeatmapReportStyleView.vue.bak`
- 若未引用，删除：
  - `src/components/training/modes/heatmap/DockOverlayRenderer.vue`
  - `src/components/training/modes/EnhancedHeatmapModeView.vue`

---

### 风险与兼容
- 子组件不再写定位，需要父容器 `position: relative`，子容器 100% 铺满。
- `channelPositions` 需先于 `hboData` 就绪；`watch([hboData, channelPositions])` 已覆盖联动。
- 使用 `replaceMerge: ['series']` 会覆盖系列属性（系列属性固定，安全）。

---

### 测试计划
- 视觉：进入 Brain 模式后连续两帧截图对比，确认无“自下而上”渐进铺色；帧间瞬时替换。
- 数据：模拟 `hboData` 变化（数组/Map/Object），颜色实时变化。
- 交互：窗口 `resize` 仅触发一次 `chart.resize()`；无持续闪烁。
- 回归：6-dock 三角形 mask 生效；不同分辨率布局稳定。

---

### Console 策略（可选）
```js
const DEBUG = import.meta.env.VITE_APP_DEBUG === 'true'
// 使用方式：
DEBUG && console.debug('[heatmap]', payload)
```
- 默认关闭 DEBUG，生产仅保留 error。

---

### 提交信息建议
- feat: heatmap instant swap + fixed structure; SDK data mapping; remove redundant alignment and timers
- chore: prune backup/unused files; reduce logging
