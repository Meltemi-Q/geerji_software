/**
 * 热力图坐标协调器
 * 负责坐标转换和自适应缩放控制
 * 基于heatmap_adaptive_demo.html的位置算法
 */

export class HeatmapCoordinator {
  constructor() {
    this.config = {
      // 专业大脑模式标准配置
      position: { x: 0.5, y: 0.42 },     // 用户提供的精确位置
      scale: { width: 0.9, height: 0.55 },  // 用户提供的精确缩放
      opacity: 0.7,                      // 用户提供的透明度
      rotation: 0,
      anchor: "center",                  // 锚点设置
      version: "1.1",                    // 版本更新支持6dock
      deviceProfile: "triangle"
    }
    
    // 默认完整Triangle尺寸(mm) - 兼容性保持
    this.layoutBounds = { x: 188.72, y: 110.29 }
    
    // 6dock三角形边界配置 (基于triangle/layout.json真实数据分析 - 2025-09-04)
    this.sixDockBounds = {
      // 实际6dock覆盖的三角形区域 (基于真实dock中心点计算)
      x: 77.00,  // 70.00 * 1.1 (扩大10%确保包含所有点)
      y: 66.66,  // 60.60 * 1.1
      // 6dock三角形在完整Triangle坐标系中的中心偏移
      centerOffset: { x: 94.36, y: 46.01 },
      // 三角形顶点坐标 (基于真实dock中心点的凸包计算)
      vertices: [
        { x: 59.36, y: 25.81 },  // 左下 (dock_10中心)
        { x: 129.36, y: 25.81 }, // 右下 (dock_12中心)
        { x: 94.36, y: 86.41 }   // 顶部 (dock_3中心)
      ],
      // 相对于完整Triangle的缩放比例
      scaleRatio: { x: 0.371, y: 0.549 }
    }
    
    this.currentPixelBounds = null
    this.listeners = []
    this.useSixDockMode = false  // 6dock模式开关
  }

  /**
   * 设置布局边界尺寸
   */
  setLayoutBounds(bounds) {
    this.layoutBounds = bounds
    console.log('[HeatmapCoordinator] 布局边界已更新:', bounds)
  }

  /**
   * 启用6dock模式
   */
  enableSixDockMode() {
    this.useSixDockMode = true
    console.log('[HeatmapCoordinator] 6dock模式已启用')
    console.log('[HeatmapCoordinator] 6dock边界:', this.sixDockBounds)
    this.notifyListeners()
  }

  /**
   * 禁用6dock模式 (回到完整Triangle)
   */
  disableSixDockMode() {
    this.useSixDockMode = false
    console.log('[HeatmapCoordinator] 6dock模式已禁用，回到完整Triangle模式')
    this.notifyListeners()
  }

  /**
   * 获取当前使用的布局边界
   */
  getCurrentLayoutBounds() {
    return this.useSixDockMode ? this.sixDockBounds : this.layoutBounds
  }

  /**
   * 设置配置参数
   */
  setConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }
    console.log('[HeatmapCoordinator] 配置已更新:', this.config)
    this.notifyListeners()
  }

  /**
   * 计算热力图的像素位置和尺寸
   * 完全复制demo.html的位置算法确保精确对齐
   */
  calculateHeatmapBounds(brainImageElement, containerElement = null) {
    if (!brainImageElement) {
      console.warn('[HeatmapCoordinator] Brain图片元素不存在')
      return null
    }

    // 获取DOM边界信息
    const brainRect = brainImageElement.getBoundingClientRect()
    const containerRect = containerElement 
      ? containerElement.getBoundingClientRect() 
      : brainImageElement.parentElement.getBoundingClientRect()

    console.log('[HeatmapCoordinator] DOM Rects - Brain:', {
      left: brainRect.left, top: brainRect.top, 
      width: brainRect.width, height: brainRect.height
    })
    console.log('[HeatmapCoordinator] Container:', {
      left: containerRect.left, top: containerRect.top,
      width: containerRect.width, height: containerRect.height  
    })
    console.log('[HeatmapCoordinator] 当前配置:', this.config)

    // 获取当前使用的布局边界
    const currentBounds = this.getCurrentLayoutBounds()
    
    // 计算热力图实际尺寸（保持与当前布局一致的宽高比）
    let desiredWidth = brainRect.width * this.config.scale.width
    let desiredHeight = brainRect.height * this.config.scale.height
    let targetRatio = currentBounds.x / currentBounds.y // 宽高比（mm）
    
    // 6dock模式需要调整缩放比例
    if (this.useSixDockMode) {
      desiredWidth *= currentBounds.scaleRatio.x  // 应用6dock缩放
      desiredHeight *= currentBounds.scaleRatio.y
      console.log('[HeatmapCoordinator] 6dock模式缩放应用:', {
        originalScale: this.config.scale,
        sixDockScale: currentBounds.scaleRatio,
        finalDesired: { width: desiredWidth, height: desiredHeight }
      })
    }

    // 先按宽度计算高度，若超出期望高度则按高度回算宽度
    let heatmapWidth = desiredWidth
    let heatmapHeight = heatmapWidth / targetRatio
    if (heatmapHeight > desiredHeight) {
      heatmapHeight = desiredHeight
      heatmapWidth = heatmapHeight * targetRatio
    }

    // 完全复制demo的位置计算算法（以中心点为锚）
    const left = (brainRect.left - containerRect.left) +
                 (brainRect.width * this.config.position.x) -
                 (heatmapWidth / 2)
    const top = (brainRect.top - containerRect.top) +
                (brainRect.height * this.config.position.y) -
                (heatmapHeight / 2)

    this.currentPixelBounds = {
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(heatmapWidth),
      height: Math.round(heatmapHeight)
    }

    console.log('[HeatmapCoordinator] 像素边界计算结果:', this.currentPixelBounds)
    return this.currentPixelBounds
  }

  /**
   * Triangle坐标系 → SVG坐标系转换
   */
  triangleToSVG(trianglePoint, svgWidth, svgHeight) {
    if (!trianglePoint || trianglePoint.length < 2) {
      return [0, 0]
    }

    // 计算缩放比例
    const scaleX = svgWidth / this.layoutBounds.x
    const scaleY = svgHeight / this.layoutBounds.y

    // 转换坐标（Y轴翻转）
    const svgX = trianglePoint[0] * scaleX
    const svgY = (this.layoutBounds.y - trianglePoint[1]) * scaleY

    return [svgX, svgY]
  }

  /**
   * 批量坐标转换
   */
  triangleToSVGBatch(trianglePoints, svgWidth, svgHeight) {
    return trianglePoints.map(point => 
      this.triangleToSVG(point, svgWidth, svgHeight)
    )
  }

  /**
   * 创建SVG viewBox字符串
   */
  createSVGViewBox(width, height) {
    return `0 0 ${width} ${height}`
  }

  /**
   * 获取当前的SVG样式属性
   */
  getSVGStyle(brainImageElement, containerElement = null) {
    const bounds = this.calculateHeatmapBounds(brainImageElement, containerElement)
    if (!bounds) return {}

    return {
      position: 'absolute',
      left: `${bounds.left}px`,
      top: `${bounds.top}px`,
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
      opacity: this.config.opacity,
      transform: `rotate(${this.config.rotation}deg)`,
      pointerEvents: 'none', // 不影响鼠标交互
      zIndex: 10
    }
  }

  /**
   * 添加配置变更监听器
   */
  addListener(callback) {
    this.listeners.push(callback)
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index > -1) this.listeners.splice(index, 1)
    }
  }

  /**
   * 通知监听器配置已变更
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.config, this.currentPixelBounds)
      } catch (error) {
        console.error('[HeatmapCoordinator] 监听器回调错误:', error)
      }
    })
  }

  /**
   * 自适应大小检测和更新
   */
  setupResponsiveUpdates(brainImageElement, updateCallback, debounceMs = 300) {
    let timeoutId = null
    
    const updateHeatmap = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        const bounds = this.calculateHeatmapBounds(brainImageElement)
        if (bounds && updateCallback) {
          updateCallback(bounds)
        }
      }, debounceMs)
    }

    // 监听窗口大小变化
    window.addEventListener('resize', updateHeatmap)
    
    // 监听图片加载完成
    if (brainImageElement.complete) {
      updateHeatmap()
    } else {
      brainImageElement.addEventListener('load', updateHeatmap)
    }

    // 返回清理函数
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', updateHeatmap)
      brainImageElement.removeEventListener('load', updateHeatmap)
    }
  }

  /**
   * 预设配置
   */
  static getPresets() {
    return {
      forehead: {
        position: { x: 0.5, y: 0.2 },
        scale: { width: 0.7, height: 0.5 },
        opacity: 0.7
      },
      center: {
        position: { x: 0.5, y: 0.5 },
        scale: { width: 0.8, height: 0.8 },
        opacity: 0.7
      },
      full: {
        position: { x: 0.5, y: 0.5 },
        scale: { width: 1.0, height: 1.0 },
        opacity: 0.6
      },
      brain: {
        position: { x: 0.5, y: 0.38 },
        scale: { width: 0.65, height: 0.55 },
        opacity: 0.55
      }
    }
  }

  /**
   * 应用预设配置
   */
  applyPreset(presetName) {
    const presets = HeatmapCoordinator.getPresets()
    if (presets[presetName]) {
      this.setConfig(presets[presetName])
      return true
    }
    console.warn(`[HeatmapCoordinator] 未知预设: ${presetName}`)
    return false
  }

  /**
   * 获取调试信息
   */
  getDebugInfo() {
    return {
      config: this.config,
      layoutBounds: this.layoutBounds,
      currentPixelBounds: this.currentPixelBounds,
      listenerCount: this.listeners.length
    }
  }
}