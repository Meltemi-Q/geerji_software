# HM测试页面开发计划

## 项目背景
实现fNIRS热力图测试页面，采用正三角形布局（底宽顶尖），连接fnirs_sdk实时数据，支持6节点和12节点配置。

## 技术方案
- **坐标系翻转**：采用方案A，视觉Y轴翻转，使物理顶部（Y值大）显示在屏幕底部
- **数据源**：fnirs_sdk实时数据流（http://localhost:8091/api/fnirs/data）
- **节点配置**：优先6节点，扩展12节点

---

## 功能1：SDK数据连接与实时获取

### 1.1 建立SDK连接
**实现内容**：
- 配置API端点：`http://localhost:8091/api/fnirs/data`
- 创建数据获取函数`fetchSDKData()`
- 处理连接错误和重试机制

**验收标准**：
- Console显示"SDK连接成功"
- 能获取到432通道数据结构

### 1.2 数据格式解析
**实现内容**：
- 解析hboData（432通道含氧血红蛋白）
- 解析hbrData（432通道脱氧血红蛋白）
- 解析frameId和timestamp
- 计算SO2（血氧饱和度）

**验收标准**：
- Console输出数据范围统计
- 数据值在合理范围（-0.05到0.05）

### 1.3 实时更新机制
**实现内容**：
- 设置125ms更新间隔（8Hz）
- 实现数据缓存和差异更新
- 添加数据流状态指示器

**验收标准**：
- Playwright截图显示数据流状态为"实时"
- Console每秒显示8次更新日志

### 验收方法
```javascript
// playwright_test_sdk_connection.js
await page.goto('http://localhost:3001#hm')
await page.waitForTimeout(2000)
const logs = await page.evaluate(() => window.sdkLogs)
expect(logs).toContain('SDK连接成功')
await page.screenshot({ path: 'test-1-sdk-connected.png' })
```

---

## 功能2：坐标系翻转与节点显示

### 2.1 坐标翻转算法实现
**实现内容**：
- 实现Y轴翻转：`renderY = containerHeight - physicalY`
- 保持X轴不变
- 更新所有节点坐标转换

**验收标准**：
- 6节点形成正三角形（底宽顶尖）
- dock_10,11在底部，dock_2,5在顶部

### 2.2 6节点正确显示
**实现内容**：
- 筛选节点：[2, 5, 6, 9, 10, 11]
- 应用翻转坐标
- 显示节点编号和位置

**验收标准**：
- Playwright截图显示6个蓝色节点
- 底部2个节点（10,11），中间2个（6,9），顶部2个（2,5）

### 2.3 12节点扩展显示
**实现内容**：
- 显示全部12个节点
- 6节点高亮，其余灰色显示
- 添加节点显示开关

**验收标准**：
- 截图显示12个节点，6个蓝色，6个灰色
- 形成完整倒梯形轮廓

### 验收方法
```javascript
// playwright_test_coordinate_flip.js
await page.goto('http://localhost:3001#hm')
const nodePositions = await page.evaluate(() => {
  return window.getNodePositions()
})
// 验证Y坐标翻转
expect(nodePositions['dock_10'].y).toBeLessThan(nodePositions['dock_2'].y)
await page.screenshot({ path: 'test-2-triangle-layout.png' })
```

---

## 功能3：三角形背景绘制

### 3.1 凸包算法实现
**实现内容**：
- 计算6节点凸包
- 生成三角形路径
- 添加10%边距扩展

**验收标准**：
- 生成正确的三角形SVG路径
- 包围所有6个节点

### 3.2 背景样式渲染
**实现内容**：
- 填充色：半透明黄色（#ffd700, opacity: 0.2）
- 边框：2px虚线（#ffaa00）
- 支持颜色自定义

**验收标准**：
- Playwright截图显示黄色三角形背景
- 背景在节点下层

### 3.3 12节点梯形背景（可选）
**实现内容**：
- 计算12节点凸包
- 生成梯形路径
- 切换显示模式

**验收标准**：
- 截图显示梯形背景包围12个节点

### 验收方法
```javascript
// playwright_test_triangle_background.js
await page.goto('http://localhost:3001#hm')
const hasBackground = await page.$('.triangle-background')
expect(hasBackground).toBeTruthy()
await page.screenshot({ path: 'test-3-triangle-bg.png' })
```

---

## 功能4：热力图渲染

### 4.1 通道位置映射
**实现内容**：
- 432通道映射到物理位置
- 计算源-探测器中点
- 距离过滤（30-80mm）

**验收标准**：
- Console显示993个有效通道
- 通道位置正确分布

### 4.2 IDW插值算法
**实现内容**：
- 实现反距离权重插值
- 生成50x50插值网格
- 应用三角形边界裁剪

**验收标准**：
- 热力图平滑过渡
- 边界清晰不溢出

### 4.3 色谱映射显示
**实现内容**：
- 实现Spectral色谱（蓝-绿-黄-红）
- 动态范围调整
- 透明度控制

**验收标准**：
- Playwright截图显示彩色热力图
- 颜色范围合理（冷色到暖色）

### 验收方法
```javascript
// playwright_test_heatmap_render.js
await page.goto('http://localhost:3001#hm')
await page.waitForTimeout(3000) // 等待数据和渲染
const canvas = await page.$('canvas.heatmap-layer')
expect(canvas).toBeTruthy()
await page.screenshot({ path: 'test-4-heatmap-render.png' })
```

---

## 功能5：交互控制面板

### 5.1 层控制开关
**实现内容**：
- 背景层开关
- 节点层开关
- 热力图层开关
- 等高线层开关

**验收标准**：
- 每个开关独立控制对应层显示

### 5.2 参数调节器
**实现内容**：
- 透明度滑块（0-1）
- 节点大小调节
- 色谱类型选择
- Y轴翻转开关

**验收标准**：
- 参数变化实时反映在显示上

### 5.3 数据源切换
**实现内容**：
- SDK实时数据/模拟数据切换
- 6节点/12节点模式切换
- HbO/HbR/SO2数据选择

**验收标准**：
- 切换后显示相应数据和布局

### 验收方法
```javascript
// playwright_test_controls.js
await page.goto('http://localhost:3001#hm')
// 测试层控制
await page.click('#toggle-nodes')
await page.screenshot({ path: 'test-5-no-nodes.png' })
await page.click('#toggle-nodes')
// 测试参数调节
await page.fill('#opacity-slider', '0.5')
await page.screenshot({ path: 'test-5-half-opacity.png' })
```

---

## 开发顺序和时间估算

1. **功能1（SDK数据连接）**：45分钟
   - 1.1 建立连接：15分钟
   - 1.2 数据解析：15分钟
   - 1.3 实时更新：15分钟
   - 验收测试：10分钟

2. **功能2（坐标翻转）**：60分钟
   - 2.1 翻转算法：20分钟
   - 2.2 6节点显示：20分钟
   - 2.3 12节点扩展：20分钟
   - 验收测试：10分钟

3. **功能3（背景绘制）**：30分钟
   - 3.1 凸包算法：15分钟
   - 3.2 样式渲染：10分钟
   - 3.3 梯形背景：5分钟
   - 验收测试：5分钟

4. **功能4（热力图）**：75分钟
   - 4.1 通道映射：25分钟
   - 4.2 IDW插值：30分钟
   - 4.3 色谱显示：20分钟
   - 验收测试：15分钟

5. **功能5（交互控制）**：30分钟
   - 5.1 层控制：10分钟
   - 5.2 参数调节：10分钟
   - 5.3 数据切换：10分钟
   - 验收测试：10分钟

**总计**：约4小时

---

## 验收标准总结

### 必须达到的效果
1. ✅ 6个节点形成正三角形（底宽顶尖）
2. ✅ 连接SDK实时数据，8Hz更新
3. ✅ 黄色三角形背景包围节点
4. ✅ 热力图显示血氧变化
5. ✅ 所有功能可通过Playwright截图验证

### 质量指标
- 无Console错误
- 响应时间 < 200ms
- 内存占用稳定
- 视觉效果流畅

---

## 测试验收脚本

创建`test_hm_acceptance.js`统一验收脚本：

```javascript
const { chromium } = require('playwright')

async function runAcceptanceTests() {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()
  
  // 功能1验收
  console.log('测试功能1：SDK数据连接...')
  await testSDKConnection(page)
  
  // 功能2验收
  console.log('测试功能2：坐标翻转...')
  await testCoordinateFlip(page)
  
  // 功能3验收
  console.log('测试功能3：三角形背景...')
  await testTriangleBackground(page)
  
  // 功能4验收
  console.log('测试功能4：热力图渲染...')
  await testHeatmapRender(page)
  
  // 功能5验收
  console.log('测试功能5：交互控制...')
  await testInteractiveControls(page)
  
  console.log('所有测试通过！')
  await browser.close()
}

runAcceptanceTests()
```

每完成一个大功能，运行对应测试确保达标后再进行下一步。