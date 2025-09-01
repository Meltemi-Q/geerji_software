/**
 * 热力图自适应定位控制器
 * 基于extra_tool/heatmap_adaptive_demo.html的自适应功能
 * 提供配置管理、位置计算、持久化存储
 */

export class HeatmapAdaptiveController {
  constructor(config = {}) {
    // 默认自适应配置
    this.defaultConfig = {
      position: { x: 0.5, y: 0.25 },     // 相对位置比例
      scale: { width: 0.75, height: 0.6 }, // 缩放比例
      opacity: 0.7,                        // 透明度
      rotation: 0,                         // 旋转角度
      anchor: 'center',                    // 锚点
      version: '2.0',                      // 配置版本
      deviceProfile: 'triangle'            // 设备配置
    }
    
    // 当前配置
    this.currentConfig = { ...this.defaultConfig, ...config }
    
    // 预设配置
    this.presets = {
      forehead: {
        position: { x: 0.5, y: 0.2 },
        scale: { width: 0.7, height: 0.5 },
        opacity: 0.7,
        rotation: 0
      },
      center: {
        position: { x: 0.5, y: 0.5 },
        scale: { width: 0.8, height: 0.8 },
        opacity: 0.7,
        rotation: 0
      },
      full: {
        position: { x: 0.5, y: 0.5 },
        scale: { width: 1.0, height: 1.0 },
        opacity: 0.6,
        rotation: 0
      },
      temporal: {
        position: { x: 0.3, y: 0.4 },
        scale: { width: 0.6, height: 0.8 },
        opacity: 0.8,
        rotation: -15
      }
    }
    
    // 存储键名
    this.storageKey = 'fnirs_heatmap_adaptive_config'
    
    // 事件监听器
    this.listeners = new Set()
    
    console.log('[自适应控制器] 初始化完成')
  }
  
  /**
   * 设置配置项
   */
  setConfig(path, value) {
    const keys = path.split('.')
    let obj = this.currentConfig
    
    // 导航到目标对象
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in obj)) {
        obj[keys[i]] = {}
      }
      obj = obj[keys[i]]
    }
    
    // 设置值
    obj[keys[keys.length - 1]] = value
    
    // 触发更新事件
    this.notifyChange()
    
    console.log(`[自适应控制器] 配置已更新 ${path} = ${value}`)
  }
  
  /**
   * 获取完整配置
   */
  getConfig() {
    return { ...this.currentConfig }
  }
  
  /**
   * 应用预设配置
   */
  applyPreset(presetName) {
    if (!(presetName in this.presets)) {
      console.warn(`[自适应控制器] 未知预设: ${presetName}`)
      return false
    }
    
    const preset = this.presets[presetName]
    Object.assign(this.currentConfig, preset)
    
    this.notifyChange()
    console.log(`[自适应控制器] 应用预设: ${presetName}`)
    return true
  }
  
  /**
   * 重置为默认配置
   */
  resetToDefault() {
    this.currentConfig = { ...this.defaultConfig }
    this.notifyChange()
    console.log('[自适应控制器] 已重置为默认配置')
  }
  
  /**
   * 计算热力图的绝对位置和尺寸
   * 基于父容器的尺寸和当前自适应配置
   */
  calculatePosition(containerElement) {
    if (!containerElement) {
      console.warn('[自适应控制器] 容器元素不存在')
      return null
    }
    
    const containerRect = containerElement.getBoundingClientRect()
    const config = this.currentConfig
    
    // 计算热力图尺寸
    const heatmapWidth = containerRect.width * config.scale.width
    const heatmapHeight = containerRect.height * config.scale.height
    
    // 计算位置（基于锚点）
    let left, top
    
    switch (config.anchor) {
      case 'center':
        left = (containerRect.width * config.position.x) - (heatmapWidth / 2)
        top = (containerRect.height * config.position.y) - (heatmapHeight / 2)
        break
      case 'top-left':
        left = containerRect.width * config.position.x
        top = containerRect.height * config.position.y
        break
      case 'top-right':
        left = (containerRect.width * config.position.x) - heatmapWidth
        top = containerRect.height * config.position.y
        break
      case 'bottom-left':
        left = containerRect.width * config.position.x
        top = (containerRect.height * config.position.y) - heatmapHeight
        break
      case 'bottom-right':
        left = (containerRect.width * config.position.x) - heatmapWidth
        top = (containerRect.height * config.position.y) - heatmapHeight
        break
      default:
        // 默认center
        left = (containerRect.width * config.position.x) - (heatmapWidth / 2)
        top = (containerRect.height * config.position.y) - (heatmapHeight / 2)
    }
    
    const result = {
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(heatmapWidth),
      height: Math.round(heatmapHeight),
      opacity: config.opacity,
      rotation: config.rotation,
      // 辅助信息
      containerWidth: containerRect.width,
      containerHeight: containerRect.height,
      positionPercent: { x: config.position.x * 100, y: config.position.y * 100 },
      scalePercent: { width: config.scale.width * 100, height: config.scale.height * 100 }
    }
    
    console.log(`[自适应控制器] 位置计算完成:`, result)
    return result
  }
  
  /**
   * 应用样式到DOM元素
   */
  applyStyles(element, position) {
    if (!element || !position) return
    
    const styles = {
      position: 'absolute',
      left: position.left + 'px',
      top: position.top + 'px',
      width: position.width + 'px',
      height: position.height + 'px',
      opacity: position.opacity,
      transform: `rotate(${position.rotation}deg)`,
      pointerEvents: 'none',
      transition: 'all 0.3s ease',
      zIndex: '10'
    }
    
    Object.assign(element.style, styles)
    console.log(`[自适应控制器] 样式已应用到DOM元素`)
  }
  
  /**
   * 创建自适应热力图容器
   */
  createAdaptiveContainer(parentElement) {
    if (!parentElement) {
      console.warn('[自适应控制器] 父元素不存在')
      return null
    }
    
    // 创建容器
    const container = document.createElement('div')
    container.className = 'fnirs-heatmap-adaptive-container'
    
    // 计算位置并应用样式
    const position = this.calculatePosition(parentElement)
    if (position) {
      this.applyStyles(container, position)
    }
    
    // 添加到父元素
    parentElement.appendChild(container)
    
    console.log('[自适应控制器] 自适应容器已创建')
    return container
  }
  
  /**
   * 自适应测试
   * 模拟不同尺寸下的显示效果
   */
  async testAdaptive(testCallback) {
    console.log('[自适应控制器] 开始自适应测试...')
    
    const testSizes = [
      { width: 300, height: 300, label: '小尺寸' },
      { width: 500, height: 400, label: '中等尺寸' },
      { width: 800, height: 600, label: '大尺寸' },
      { width: 350, height: 350, label: '原始尺寸' }
    ]
    
    for (let i = 0; i < testSizes.length; i++) {
      const testSize = testSizes[i]
      console.log(`[自适应测试] 测试 ${i + 1}/${testSizes.length}: ${testSize.label} (${testSize.width}×${testSize.height})`)
      
      // 回调测试函数
      if (testCallback) {
        await testCallback(testSize, i)
      }
      
      // 等待观察
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    console.log('[自适应控制器] 自适应测试完成')
  }
  
  /**
   * 保存配置到本地存储
   */
  saveConfig() {
    try {
      const configWithMeta = {
        ...this.currentConfig,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(configWithMeta))
      console.log('[自适应控制器] 配置已保存到本地存储')
      return true
    } catch (error) {
      console.error('[自适应控制器] 保存配置失败:', error)
      return false
    }
  }
  
  /**
   * 从本地存储加载配置
   */
  loadConfig() {
    try {
      const saved = localStorage.getItem(this.storageKey)
      if (saved) {
        const config = JSON.parse(saved)
        
        // 验证配置完整性
        if (config.position && config.scale && 
            typeof config.opacity !== 'undefined' && 
            typeof config.rotation !== 'undefined') {
          
          // 移除元数据
          const { timestamp, userAgent, ...configData } = config
          
          // 应用配置
          this.currentConfig = { ...this.defaultConfig, ...configData }
          
          this.notifyChange()
          console.log('[自适应控制器] 配置已从本地存储加载:', configData)
          return true
        } else {
          console.warn('[自适应控制器] 配置数据不完整，使用默认配置')
        }
      } else {
        console.log('[自适应控制器] 本地存储中没有找到配置')
      }
    } catch (error) {
      console.error('[自适应控制器] 加载配置失败:', error)
    }
    
    return false
  }
  
  /**
   * 清除本地存储的配置
   */
  clearConfig() {
    try {
      localStorage.removeItem(this.storageKey)
      this.resetToDefault()
      console.log('[自适应控制器] 本地配置已清除')
      return true
    } catch (error) {
      console.error('[自适应控制器] 清除配置失败:', error)
      return false
    }
  }
  
  /**
   * 添加配置变更监听器
   */
  addListener(callback) {
    this.listeners.add(callback)
  }
  
  /**
   * 移除配置变更监听器
   */
  removeListener(callback) {
    this.listeners.delete(callback)
  }
  
  /**
   * 通知配置变更
   */
  notifyChange() {
    this.listeners.forEach(callback => {
      try {
        callback(this.getConfig())
      } catch (error) {
        console.error('[自适应控制器] 监听器执行失败:', error)
      }
    })
  }
  
  /**
   * 获取状态信息
   */
  getStatus() {
    const hasLocalConfig = !!localStorage.getItem(this.storageKey)
    
    return {
      hasLocalConfig,
      currentPreset: this.getCurrentPreset(),
      configVersion: this.currentConfig.version,
      lastUpdate: new Date().toISOString()
    }
  }
  
  /**
   * 检测当前配置是否匹配某个预设
   */
  getCurrentPreset() {
    for (const [name, preset] of Object.entries(this.presets)) {
      const matches = Object.keys(preset).every(key => {
        if (typeof preset[key] === 'object') {
          return Object.keys(preset[key]).every(subKey => 
            Math.abs(this.currentConfig[key][subKey] - preset[key][subKey]) < 0.01
          )
        } else {
          return Math.abs(this.currentConfig[key] - preset[key]) < 0.01
        }
      })
      
      if (matches) return name
    }
    
    return 'custom'
  }
  
  /**
   * 销毁控制器
   */
  destroy() {
    this.listeners.clear()
    console.log('[自适应控制器] 控制器已销毁')
  }
}

export default HeatmapAdaptiveController