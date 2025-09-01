/**
 * 热力图自适应定位系统 - 核心工具类
 * 基于比例的通用定位，支持任意尺寸自适应
 */

export class HeatmapAdaptivePositioning {
  constructor() {
    this.defaultConfig = {
      position: { x: 0.5, y: 0.5 },        // 修正为大脑中心区域
      scale: { width: 0.8, height: 0.7 },  // 稍微加大覆盖范围
      opacity: 0.7,
      rotation: 0,
      anchor: 'center',
      version: '1.1',  // 更新版本号
      deviceProfile: 'triangle'
    }
    
    this.storageKey = 'heatmap_alignment_config'
  }

  /**
   * 保存配置到本地存储
   * @param {Object} config 配置对象
   */
  saveConfiguration(config) {
    try {
      const configWithMeta = {
        ...config,
        timestamp: new Date().toISOString(),
        version: '1.0'
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(configWithMeta))
      console.log('[配置保存] 热力图对齐配置已保存:', configWithMeta)
      return true
    } catch (error) {
      console.error('[配置保存] 保存失败:', error)
      return false
    }
  }

  /**
   * 从本地存储加载配置
   * @returns {Object} 配置对象或默认配置
   */
  loadConfiguration() {
    try {
      const saved = localStorage.getItem(this.storageKey)
      if (saved) {
        const config = JSON.parse(saved)
        console.log('[配置加载] 已加载保存的配置:', config)
        return this.validateConfig(config)
      }
    } catch (error) {
      console.error('[配置加载] 加载失败:', error)
    }
    
    console.log('[配置加载] 使用默认配置')
    return { ...this.defaultConfig }
  }

  /**
   * 验证配置的完整性
   * @param {Object} config 待验证的配置
   * @returns {Object} 验证后的配置
   */
  validateConfig(config) {
    const validated = { ...this.defaultConfig }
    
    // 位置验证
    if (config.position) {
      validated.position.x = Math.max(0, Math.min(1, config.position.x || 0.5))
      validated.position.y = Math.max(0, Math.min(1, config.position.y || 0.5))  // 修正为中心
    }
    
    // 尺寸验证
    if (config.scale) {
      validated.scale.width = Math.max(0.1, Math.min(2, config.scale.width || 0.8))
      validated.scale.height = Math.max(0.1, Math.min(2, config.scale.height || 0.7))
    }
    
    // 其他属性验证
    validated.opacity = Math.max(0.1, Math.min(1, config.opacity || 0.7))
    validated.rotation = Math.max(-180, Math.min(180, config.rotation || 0))
    validated.anchor = config.anchor || 'center'
    validated.deviceProfile = config.deviceProfile || 'triangle'
    
    return validated
  }

  /**
   * 根据比例配置计算实际像素位置和尺寸
   * @param {Object} config 比例配置
   * @param {DOMRect} brainRect 大脑图片的边界矩形
   * @param {DOMRect} containerRect 容器的边界矩形  
   * @returns {Object} 像素级定位信息
   */
  calculatePixelPosition(config, brainRect, containerRect = null) {
    const baseRect = containerRect || brainRect
    
    // 计算热力图实际尺寸
    const heatmapWidth = brainRect.width * config.scale.width
    const heatmapHeight = brainRect.height * config.scale.height
    
    // 根据锚点模式计算位置
    let anchorOffsetX = 0, anchorOffsetY = 0
    
    switch (config.anchor) {
      case 'top-left':
        anchorOffsetX = 0
        anchorOffsetY = 0
        break
      case 'top-right':
        anchorOffsetX = -heatmapWidth
        anchorOffsetY = 0
        break
      case 'bottom-center':
        anchorOffsetX = -heatmapWidth / 2
        anchorOffsetY = -heatmapHeight
        break
      case 'center':
      default:
        anchorOffsetX = -heatmapWidth / 2
        anchorOffsetY = -heatmapHeight / 2
        break
    }
    
    // 计算基于比例的绝对位置
    const left = (brainRect.left - baseRect.left) + 
                 (brainRect.width * config.position.x) + 
                 anchorOffsetX
    const top = (brainRect.top - baseRect.top) + 
                (brainRect.height * config.position.y) + 
                anchorOffsetY
    
    return {
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(heatmapWidth),
      height: Math.round(heatmapHeight),
      centerX: Math.round(left + heatmapWidth / 2),
      centerY: Math.round(top + heatmapHeight / 2),
      opacity: config.opacity,
      rotation: config.rotation,
      transform: this.calculateTransform(config, Math.round(left), Math.round(top), 
                                       Math.round(heatmapWidth), Math.round(heatmapHeight))
    }
  }

  /**
   * 计算CSS变换字符串
   * @param {Object} config 配置对象
   * @param {number} left 左边距
   * @param {number} top 上边距  
   * @param {number} width 宽度
   * @param {number} height 高度
   * @returns {string} CSS transform字符串
   */
  calculateTransform(config, left, top, width, height) {
    const transforms = []
    
    if (config.rotation !== 0) {
      transforms.push(`rotate(${config.rotation}deg)`)
    }
    
    return transforms.join(' ')
  }

  /**
   * 生成完整的CSS样式对象
   * @param {Object} config 比例配置
   * @param {DOMRect} brainRect 大脑图片边界
   * @param {DOMRect} containerRect 容器边界
   * @returns {Object} CSS样式对象
   */
  generateStyles(config, brainRect, containerRect = null) {
    const position = this.calculatePixelPosition(config, brainRect, containerRect)
    
    return {
      position: 'absolute',
      left: `${position.left}px`,
      top: `${position.top}px`,
      width: `${position.width}px`,
      height: `${position.height}px`,
      opacity: position.opacity,
      transform: position.transform,
      transformOrigin: 'center center',
      zIndex: 10,
      pointerEvents: 'none', // 避免阻挡用户交互
      transition: 'all 0.3s ease' // 平滑动画
    }
  }

  /**
   * 测试自适应效果
   * @param {Object} config 配置对象
   * @param {Array} testSizes 测试尺寸列表
   * @returns {Array} 测试结果
   */
  testAdaptivePositioning(config, testSizes = [
    { width: 300, height: 300 },
    { width: 500, height: 500 },
    { width: 800, height: 600 },
    { width: 1200, height: 800 }
  ]) {
    const results = []
    
    testSizes.forEach(size => {
      const mockBrainRect = {
        left: 0,
        top: 0,
        width: size.width,
        height: size.height
      }
      
      const position = this.calculatePixelPosition(config, mockBrainRect)
      
      results.push({
        testSize: size,
        calculatedPosition: position,
        relativePosition: {
          x: position.left / size.width,
          y: position.top / size.height,
          widthRatio: position.width / size.width,
          heightRatio: position.height / size.height
        }
      })
    })
    
    console.log('[自适应测试] 测试结果:', results)
    return results
  }

  /**
   * 预设配置
   */
  getPresets() {
    return {
      forehead: {
        position: { x: 0.5, y: 0.2 },
        scale: { width: 0.7, height: 0.5 },
        opacity: 0.7,
        rotation: 0,
        anchor: 'center'
      },
      
      center: {
        position: { x: 0.5, y: 0.5 },
        scale: { width: 0.8, height: 0.8 },
        opacity: 0.7,
        rotation: 0,
        anchor: 'center'
      },
      
      fullCoverage: {
        position: { x: 0.5, y: 0.5 },
        scale: { width: 1.0, height: 1.0 },
        opacity: 0.6,
        rotation: 0,
        anchor: 'center'
      },
      
      leftHemisphere: {
        position: { x: 0.3, y: 0.4 },
        scale: { width: 0.6, height: 0.7 },
        opacity: 0.7,
        rotation: -5,
        anchor: 'center'
      },
      
      rightHemisphere: {
        position: { x: 0.7, y: 0.4 },
        scale: { width: 0.6, height: 0.7 },
        opacity: 0.7,
        rotation: 5,
        anchor: 'center'
      }
    }
  }

  /**
   * 应用预设配置
   * @param {string} presetName 预设名称
   * @returns {Object} 预设配置对象
   */
  applyPreset(presetName) {
    const presets = this.getPresets()
    const preset = presets[presetName]
    
    if (!preset) {
      console.warn(`[预设应用] 未找到预设 "${presetName}"，使用默认配置`)
      return { ...this.defaultConfig }
    }
    
    return {
      ...this.defaultConfig,
      ...preset,
      version: '1.0',
      deviceProfile: 'triangle',
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 智能预对齐算法
   * 基于triangle设备配置自动计算最佳初始位置
   * @param {Object} triangleLayout triangle设备布局数据
   * @returns {Object} 智能计算的配置
   */
  calculateSmartAlignment(triangleLayout = null) {
    console.log('[智能对齐] 开始计算最佳初始位置...')
    
    // 基础智能配置
    let smartConfig = {
      position: { x: 0.5, y: 0.25 }, // 额头区域
      scale: { width: 0.75, height: 0.6 },
      opacity: 0.7,
      rotation: 0,
      anchor: 'center'
    }
    
    // 如果提供了triangle布局数据，进行更精确的计算
    if (triangleLayout && triangleLayout.docks) {
      try {
        // 计算所有optodes的几何中心
        const allOptodes = []
        triangleLayout.docks.forEach(dock => {
          if (dock.optodes) {
            dock.optodes.forEach(optode => {
              if (optode.coordinates_2d) {
                allOptodes.push({
                  x: optode.coordinates_2d.x,
                  y: optode.coordinates_2d.y
                })
              }
            })
          }
        })
        
        if (allOptodes.length > 0) {
          // 计算边界框
          const minX = Math.min(...allOptodes.map(p => p.x))
          const maxX = Math.max(...allOptodes.map(p => p.x))
          const minY = Math.min(...allOptodes.map(p => p.y))
          const maxY = Math.max(...allOptodes.map(p => p.y))
          
          // 计算几何中心
          const centerX = (minX + maxX) / 2
          const centerY = (minY + maxY) / 2
          
          // 根据triangle的空间分布调整位置
          // 假设triangle布局的Y坐标越小越靠近额头
          const normalizedY = Math.max(0.15, Math.min(0.4, (centerY - minY) / (maxY - minY)))
          
          smartConfig = {
            position: { x: 0.5, y: normalizedY },
            scale: { 
              width: 0.8, 
              height: Math.min(0.7, (maxY - minY) / 100) // 基于实际跨度调整
            },
            opacity: 0.7,
            rotation: 0,
            anchor: 'center'
          }
          
          console.log('[智能对齐] 基于triangle布局计算完成:', smartConfig)
        }
      } catch (error) {
        console.warn('[智能对齐] triangle数据解析失败，使用默认配置:', error)
      }
    }
    
    return {
      ...this.defaultConfig,
      ...smartConfig,
      version: '1.0',
      deviceProfile: 'triangle',
      isSmartAlignment: true,
      timestamp: new Date().toISOString()
    }
  }
}

// 创建全局实例
export const heatmapPositioning = new HeatmapAdaptivePositioning()

// 便捷的工具函数
export function saveHeatmapAlignment(config) {
  return heatmapPositioning.saveConfiguration(config)
}

export function loadHeatmapAlignment() {
  return heatmapPositioning.loadConfiguration()
}

export function calculateHeatmapStyles(config, brainRect, containerRect = null) {
  return heatmapPositioning.generateStyles(config, brainRect, containerRect)
}

export function getHeatmapPresets() {
  return heatmapPositioning.getPresets()
}

export function applyHeatmapPreset(presetName) {
  return heatmapPositioning.applyPreset(presetName)
}

export function smartAlignHeatmap(triangleLayout = null) {
  return heatmapPositioning.calculateSmartAlignment(triangleLayout)
}