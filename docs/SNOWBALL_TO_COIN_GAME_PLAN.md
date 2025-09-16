# 🎮 滚雪球游戏改造方案

## 📋 项目概览

**原游戏**: ThreeJSEndlessRunner3D（Three.js 3D滚雪球游戏）
**目标**: 改造为蓝天背景的金币收集游戏，集成到现有康复训练系统
**核心改动**: 背景换蓝天、树换金币、集成现有记分系统

---

## 🎯 游戏资源分析

### 现有游戏结构
```
downloads/ThreeJSEndlessRunner3D/
├── EndlessRoller.html        # 主游戏页面
├── src/
│   ├── endlessroller.js      # 核心游戏逻辑（13KB）
│   ├── OrbitControls.js      # 相机控制
│   ├── itemsforgame.js       # 游戏物品
│   └── threescene.js         # 场景设置
└── lib/
    ├── three.min.js          # Three.js库
    └── stats.min.js          # 性能统计
```

### 核心游戏机制
- **3车道系统**: leftLane(-1), middleLane(0), rightLane(1)
- **滚动机制**: 球形世界上的滚动效果（worldRadius=26）
- **障碍物系统**: 树木池（treesPool）动态生成
- **碰撞检测**: 距离检测（0.6单位触发碰撞）
- **分数系统**: 基于时间和躲避障碍物

---

## 🎨 视觉改造方案

### 1. 背景改造（蓝天效果）

**当前背景**:
```javascript
scene.fog = new THREE.FogExp2( 0xf0fff0, 0.14 );  // 雾效
renderer.setClearColor(0xfffafa, 1);              // 淡白色背景
```

**改造方案A - 静态蓝天渐变**:
```javascript
// 创建蓝天渐变背景
function createSkyGradient() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    
    // 天空渐变（从浅蓝到深蓝）
    const gradient = context.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#87CEEB');     // 天空蓝
    gradient.addColorStop(0.4, '#4A90E2');   // 中间蓝
    gradient.addColorStop(1, '#1E3A8A');     // 深蓝
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);
    
    // 添加云朵（可选）
    drawClouds(context);
    
    return canvas;
}

// 应用到场景
const skyTexture = new THREE.CanvasTexture(createSkyGradient());
scene.background = skyTexture;
```

**改造方案B - 动态天空盒**:
```javascript
// 使用CubeTextureLoader加载天空盒
const loader = new THREE.CubeTextureLoader();
const skyboxTexture = loader.load([
    'assets/skybox/px.jpg', // 右
    'assets/skybox/nx.jpg', // 左
    'assets/skybox/py.jpg', // 上
    'assets/skybox/ny.jpg', // 下
    'assets/skybox/pz.jpg', // 前
    'assets/skybox/nz.jpg'  // 后
]);
scene.background = skyboxTexture;
```

**改造方案C - 简单GIF/视频背景**:
```javascript
// 使用视频或GIF作为背景
const video = document.createElement('video');
video.src = 'assets/sky-animation.mp4';
video.loop = true;
video.muted = true;
video.play();

const videoTexture = new THREE.VideoTexture(video);
scene.background = videoTexture;
```

### 推荐方案：**方案A + 动态云朵**
- 性能最优
- 易于实现
- 可添加飘动的云朵效果增加生动感

---

## 💰 树木改造为金币

### 当前树木生成逻辑
```javascript
function createTree(){
    // 复杂的树木几何体生成
    var sides=8;
    var tiers=6;
    // ... 多层树木构造
}
```

### 金币改造方案

**方案1 - 3D金币模型**:
```javascript
function createCoin() {
    const coin = new THREE.Group();
    
    // 金币主体（圆柱体）
    const coinGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 32);
    const coinMaterial = new THREE.MeshPhongMaterial({
        color: 0xFFD700,        // 金色
        emissive: 0xFFA500,     // 发光效果
        emissiveIntensity: 0.3,
        shininess: 100,
        specular: 0xFFFFFF
    });
    
    const coinMesh = new THREE.Mesh(coinGeometry, coinMaterial);
    
    // 添加"￥"符号或其他装饰
    const textGeometry = new THREE.TextGeometry('￥', {
        font: font,  // 需要加载字体
        size: 0.25,
        height: 0.02
    });
    const textMaterial = new THREE.MeshPhongMaterial({
        color: 0xFFFFFF
    });
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    textMesh.position.z = 0.06;
    
    coin.add(coinMesh);
    coin.add(textMesh);
    
    // 添加旋转动画
    coin.userData = {
        rotationSpeed: 0.05,
        floatAmplitude: 0.1,
        floatSpeed: 0.02
    };
    
    return coin;
}
```

**方案2 - 精灵图金币（推荐）**:
```javascript
function createCoinSprite() {
    // 使用精灵图，性能更好
    const coinTexture = new THREE.TextureLoader().load('assets/coin.png');
    const coinMaterial = new THREE.SpriteMaterial({
        map: coinTexture,
        color: 0xFFFFFF,
        transparent: true,
        opacity: 1
    });
    
    const coin = new THREE.Sprite(coinMaterial);
    coin.scale.set(0.8, 0.8, 1);
    
    // 金币闪光效果
    coin.userData = {
        glowIntensity: 0,
        collected: false
    };
    
    return coin;
}

// 金币动画更新
function updateCoins(deltaTime) {
    coinsInPath.forEach(coin => {
        // 旋转动画
        coin.rotation.y += deltaTime * 2;
        
        // 上下浮动
        coin.position.y = coin.userData.baseY + 
            Math.sin(Date.now() * 0.003) * 0.1;
        
        // 闪光效果
        coin.material.opacity = 0.8 + 
            Math.sin(Date.now() * 0.005) * 0.2;
    });
}
```

---

## 📊 记分系统集成

### 现有系统分析

**原游戏记分**:
```javascript
score+=2*treeReleaseInterval;
scoreText.innerHTML=score.toString();
```

**现有康复系统记分（GameDataDisplay.vue）**:
```javascript
const score = ref(0);
const onCoinCollected = (coinData) => {
    score.value += coinData.value;
    emit('coin-collected', coinData);
}
```

### 集成方案

```javascript
// 改造后的金币收集系统
class CoinCollectionSystem {
    constructor() {
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.coinsCollected = 0;
        
        // 金币价值配置
        this.coinValues = {
            normal: 10,      // 普通金币
            silver: 50,      // 银币（可选）
            gold: 100,       // 金币
            special: 200     // 特殊金币
        };
    }
    
    collectCoin(coin) {
        // 播放收集音效
        this.playCollectSound();
        
        // 计算分数
        const baseValue = this.coinValues[coin.type] || 10;
        const comboBonus = Math.min(this.combo * 5, 50);
        const totalValue = baseValue + comboBonus;
        
        this.score += totalValue;
        this.combo++;
        this.coinsCollected++;
        
        // 更新最高连击
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        
        // 触发收集动画
        this.showCollectAnimation(coin.position, totalValue);
        
        // 发送事件到Vue组件
        this.emitCollectEvent({
            score: this.score,
            value: totalValue,
            combo: this.combo,
            type: coin.type,
            timestamp: Date.now()
        });
        
        // 移除金币
        this.removeCoin(coin);
    }
    
    resetCombo() {
        this.combo = 0;
    }
    
    emitCollectEvent(data) {
        // 发送自定义事件，Vue组件监听
        window.dispatchEvent(new CustomEvent('coinCollected', {
            detail: data
        }));
    }
    
    showCollectAnimation(position, value) {
        // 创建"+10"等分数提示
        const scorePopup = document.createElement('div');
        scorePopup.className = 'score-popup';
        scorePopup.textContent = `+${value}`;
        scorePopup.style.cssText = `
            position: absolute;
            color: #FFD700;
            font-size: 24px;
            font-weight: bold;
            animation: scoreFloat 1s ease-out forwards;
        `;
        document.body.appendChild(scorePopup);
        
        // 1秒后移除
        setTimeout(() => scorePopup.remove(), 1000);
    }
}
```

---

## 🎮 游戏机制优化

### 1. 碰撞检测改造
```javascript
// 原版：碰撞树木导致游戏结束
if(treePos.distanceTo(heroSphere.position)<=0.6){
    hasCollided=true;
    explode();
}

// 改造：碰撞金币得分
if(coinPos.distanceTo(heroSphere.position)<=0.8){ // 更大的收集范围
    collectCoin(coin);
    // 不结束游戏，继续运行
}
```

### 2. 难度系统
```javascript
class DifficultyManager {
    constructor() {
        this.level = 1;
        this.speedMultiplier = 1.0;
        this.coinSpawnRate = 0.5;
    }
    
    update(score) {
        // 每100分升一级
        const newLevel = Math.floor(score / 100) + 1;
        if (newLevel !== this.level) {
            this.level = newLevel;
            this.speedMultiplier = 1 + (this.level - 1) * 0.1;
            this.coinSpawnRate = Math.max(0.2, 0.5 - this.level * 0.05);
            
            // 显示升级提示
            this.showLevelUp();
        }
    }
}
```

---

## 🔧 技术实施步骤

### 第一阶段：基础改造（1天）
1. ✅ 下载并分析原游戏代码
2. ⬜ 创建项目副本用于改造
3. ⬜ 替换背景为蓝天渐变
4. ⬜ 测试基础场景渲染

### 第二阶段：金币系统（1-2天）
1. ⬜ 创建金币模型/精灵
2. ⬜ 替换树木生成逻辑为金币生成
3. ⬜ 实现金币旋转和浮动动画
4. ⬜ 修改碰撞检测为收集机制

### 第三阶段：记分集成（1天）
1. ⬜ 创建CoinCollectionSystem类
2. ⬜ 集成到现有Vue组件系统
3. ⬜ 添加分数显示UI
4. ⬜ 实现连击系统

### 第四阶段：视觉效果（1天）
1. ⬜ 添加金币收集特效
2. ⬜ 实现分数弹出动画
3. ⬜ 添加云朵飘动效果
4. ⬜ 优化光影效果

### 第五阶段：集成测试（1天）
1. ⬜ 集成到GameComponent.vue
2. ⬜ 测试与现有系统的兼容性
3. ⬜ 性能优化
4. ⬜ Bug修复

---

## 📦 资源需求

### 需要准备的资源
1. **金币图片/模型**
   - coin.png（精灵图）
   - coin_shine.png（闪光效果）
   - 或3D金币模型（.obj/.gltf）

2. **天空背景资源**
   - 蓝天渐变图片
   - 云朵素材（可选）
   - 或天空盒6张图片

3. **音效资源**
   - coin_collect.mp3（收集音效）
   - level_up.mp3（升级音效）
   - combo_break.mp3（连击中断）

4. **字体资源**（如果金币上显示文字）
   - 支持中文的3D字体文件

---

## 🚀 性能考虑

### 优化建议
1. **使用对象池**：金币循环利用，避免频繁创建销毁
2. **LOD系统**：远处金币使用低精度模型
3. **批量渲染**：使用InstancedMesh渲染大量金币
4. **纹理图集**：所有金币共享一张纹理图
5. **视锥剔除**：只渲染可见范围内的金币

### 移动端适配
```javascript
// 检测设备性能
const isMobile = /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
const isLowEnd = navigator.hardwareConcurrency <= 2;

if (isMobile || isLowEnd) {
    // 降低渲染质量
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = false;
    
    // 减少金币数量
    maxCoinsInView = 10;
    
    // 简化特效
    particleCount = 10;
}
```

---

## 🎯 预期效果

### 改造后游戏特点
- 🌤️ **明亮蓝天背景**：取代原有的雾蒙蒙效果
- 💰 **金币收集机制**：取代躲避树木的玩法
- 📈 **渐进难度系统**：速度和金币密度逐渐增加
- 🏆 **连击奖励系统**：连续收集获得额外分数
- ✨ **丰富视觉效果**：金币闪光、收集特效、分数弹出

### 与现有系统的集成
- 完全兼容现有的GameComponent.vue架构
- 复用现有的记分显示系统
- 支持血氧数据影响游戏难度
- 保留退出游戏等控制功能

---

## 📝 备注

1. **技术栈兼容性**：Three.js与Vue3完全兼容，可直接集成
2. **代码许可**：原游戏MIT协议，可自由修改
3. **开发时间**：预计5-6个工作日完成全部改造
4. **后续扩展**：可添加道具系统、多种金币类型、成就系统等

---

**文档创建时间**: 2025-01-13  
**文档作者**: Claude AI Assistant  
**改造状态**: 待实施