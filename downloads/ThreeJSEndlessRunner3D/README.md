# 3D无尽跑酷游戏

## 项目简介

这是一个基于Three.js开发的3D无尽跑酷游戏。玩家控制一个雪球在山坡上滚动，通过收集金币来获得分数。游戏采用程序化生成的3D地形，提供无尽的游戏体验。

## 游戏特色

- **3D渲染**：基于WebGL的流畅3D图形
- **无尽地形**：程序化生成的滚动地形
- **收集玩法**：收集金币获得分数
- **物理系统**：真实的重力和碰撞检测
- **视觉效果**：动态光照和阴影系统

## 技术栈

- **Three.js** - 3D图形渲染引擎
- **WebGL** - 硬件加速图形API
- **JavaScript ES5** - 游戏逻辑实现
- **HTML5 Canvas** - 渲染表面

## 项目结构

```
├── EndlessRoller.html          # 主游戏入口页面
├── ItemsForGame.html           # 游戏元素测试页面
├── ThreeScene.html             # 基础场景测试页面
├── assets/                     # 游戏资源
│   └── coin.png               # 金币贴图
├── lib/                       # 第三方库
│   ├── three.min.js           # Three.js核心库
│   └── stats.min.js           # 性能监控工具
└── src/                       # 源代码
    ├── endlessroller.js       # 主游戏逻辑
    ├── itemsforgame.js        # 游戏元素测试
    ├── threescene.js          # 基础场景
    └── OrbitControls.js       # 相机控制器
```

## 游戏玩法

### 操作控制
- **←→ 方向键**：控制雪球左右移动
- **↑ 方向键**：跳跃

### 游戏目标
- 收集路径上的金币获得分数
- 每个金币价值10分
- 随时间自动获得分数奖励

### 游戏机制
- 雪球在球形地形上滚动
- 三条车道可供移动
- 金币会旋转并闪闪发光
- 收集金币时会有视觉反馈

## 技术实现

### 核心系统

#### 地形生成
- 基于球形几何体的程序化地形
- 顶点扰动算法创造自然起伏
- 分层结构支持细节变化

#### 物理系统
- 重力模拟（gravity: 0.005）
- 弹跳机制（bounceValue动态调整）
- 球体在曲面上的滚动物理

#### 渲染系统
- PBR材质和光照
- 实时阴影映射
- 天空背景渲染

#### 对象池管理
- 金币对象复用机制
- 动态添加和回收系统
- 内存优化设计

### 关键算法

#### 球坐标系统
```javascript
sphericalHelper.set(worldRadius+0.18, pathAngleValues[row], -rollingGroundSphere.rotation.x+4);
newTree.position.setFromSpherical(sphericalHelper);
```

#### 碰撞检测
```javascript
if(treePos.distanceTo(heroSphere.position)<=0.6){
    // 金币收集逻辑
}
```

#### 地形滚动
```javascript
rollingGroundSphere.rotation.x += rollingSpeed;
heroSphere.rotation.x -= heroRollingSpeed;
```

## 运行说明

### 环境要求
- 现代浏览器（支持WebGL）
- 本地服务器环境（推荐）

### 启动方法
1. 启动本地HTTP服务器
2. 访问 `EndlessRoller.html`
3. 开始游戏

### 性能优化
- 对象池减少GC压力
- LOD系统（可扩展）
- 视锥剔除优化

## 开发历史

### 原始版本
- 基于Tuts+教程的躲避树木游戏
- 简单的碰撞和爆炸系统

### 当前版本改进
- **游戏机制**：从躲避改为收集
- **视觉效果**：金币贴图和旋转动画
- **用户体验**：更友好的分数系统
- **技术优化**：改进的渲染管线

## 扩展可能

### 短期优化
- [ ] 音效系统
- [ ] 特效增强
- [ ] 难度递增
- [ ] 成就系统

### 长期规划
- [ ] 多角色系统
- [ ] 道具系统
- [ ] 关卡设计
- [ ] 多人模式

## 技术细节

### 性能指标
- 渲染帧率：60 FPS（目标）
- 对象池大小：10个金币
- 地形细分：40x40段
- 光源数量：2个（环境光+方向光）

### 兼容性
- Chrome 50+
- Firefox 45+
- Safari 10+
- Edge 12+

## 许可证

MIT License - 详见 LICENSE 文件

## 贡献指南

欢迎提交Issue和Pull Request来改进游戏！

---

*一个充满乐趣的3D收集游戏，展示了现代Web 3D技术的强大能力。*