/**
 * 高级热力图配置管理器
 * 集成extra_tool中的专业配置和现有HeatmapConfig.js的功能
 * 支持多设备配置、渲染模式切换、性能优化
 */

import { HeatmapConfig } from '../HeatmapConfig.js'

export class AdvancedHeatmapConfig extends HeatmapConfig {
  constructor(config = {}) {
    // 调用父类构造函数
    super(config)
    
    // 扩展配置项
    this.config = {
      ...this.config,
      
      // fNIRS专用配置
      fnirs: {
        deviceProfile: 'triangle',        // triangle, 6node, 12node
        dataMode: 'realtime',            // realtime, playback, simulation  
        channelCount: 432,               // 实际通道数
        maxChannels: 864,                // 最大支持通道数(HbO+HbR)
        sampleRate: 10,                  // Hz
        dataTypes: ['HbO', 'HbR'],       // 支持的数据类型
        
        // 数据处理
        preprocessing: {
          smoothing: true,
          smoothingWindow: 5,
          baselineCorrection: true,
          outlierDetection: true,
          outlierThreshold: 3.0          // 标准差倍数
        }
      },
      
      // 渲染模式配置
      renderModes: {
        current: '2d',                   // 当前模式
        available: ['2d', 'adaptive'],
        
        // 2D模式配置
        '2d': {
          interpolation: 'linear',       // linear, cubic, nearest
          gridResolution: 50,
          colorScheme: 'RdBu_r',        // 双向色彩
          showGrid: false,
          showContours: true,
          contourLevels: 20
        },
        
        // 自适应模式配置  
        adaptive: {
          autoAlign: true,
          alignmentTarget: 'brain',     // brain, forehead, custom
          responsiveResize: true,
          minScale: 0.1,
          maxScale: 2.0
        }
      },
      
      // 设备配置映射
      deviceProfiles: {
        triangle: {
          name: 'Triangle fNIRS',
          sources: 18,
          detectors: 24,
          channels: 432,
          layout: 'triangular',
          optimalModes: ['2d', 'adaptive'],
          colorSchemes: ['RdBu_r', 'viridis', 'plasma']
        },
        
        '6node': {
          name: '6-Node fNIRS',
          sources: 6,
          detectors: 6,
          channels: 36,
          layout: 'hexagonal',
          optimalModes: ['2d', 'adaptive'],
          colorSchemes: ['RdBu_r', 'coolwarm']
        },
        
        '12node': {
          name: '12-Node fNIRS',
          sources: 12,
          detectors: 12,
          channels: 144,
          layout: 'grid',
          optimalModes: ['2d', 'adaptive'],
          colorSchemes: ['RdBu_r', 'RdYlBu_r', 'spectral']
        }
      },
      
      // 性能配置
      performance: {
        enableWebGL: false,             // WebGL加速
        maxFPS: 30,                     // 最大帧率
        updateThrottle: 100,            // ms，更新节流
        memoryLimit: 100,               // MB，内存限制
        enableCaching: true,            // 启用缓存
        cacheSize: 50,                  // 缓存条目数
        
        // LOD (Level of Detail) 配置
        lod: {
          enabled: true,
          thresholds: {
            high: 1000,                 // 高质量渲染阈值
            medium: 500,               // 中等质量阈值
            low: 100                   // 低质量阈值
          }
        }
      },
      
      // 交互配置
      interaction: {
        enablePan: false,              // 平移
        enableZoom: false,             // 缩放
        enableRotate: false,           // 旋转（3D模式）
        enableSelection: true,         // 通道选择
        hoverEffects: true,           // 悬停效果
        tooltips: true,               // 工具提示
        
        // 手势支持
        gestures: {
          pinchZoom: false,
          twoFingerPan: false,
          threeFingerRotate: false
        }
      },
      
      // 导出配置
      export: {
        formats: ['png', 'svg', 'json', 'csv'],
        defaultFormat: 'png',
        quality: 1.0,                 // 图片质量
        dpi: 300,                     // 分辨率
        includeMetadata: true,        // 包含元数据
        
        // 数据导出选项
        dataOptions: {
          includeRawData: true,
          includeProcessedData: true,
          includeConfig: true,
          compression: true
        }
      },
      
      // 验证规则
      validation: {
        required: ['fnirs.deviceProfile', 'renderModes.current'],
        ranges: {
          'performance.maxFPS': [1, 60],
          'performance.updateThrottle': [16, 1000],
          'performance.cacheSize': [10, 200]
        }
      },
      
      // 扩展用户配置
      ...config
    }
    
    // 验证配置
    this.validateConfig()
    
    console.log('[高级热力图配置] 初始化完成，设备配置:', this.getDeviceProfile())
  }
  
  /**
   * 获取当前设备配置信息
   */
  getDeviceProfile() {
    const profileName = this.config.fnirs.deviceProfile
    const profile = this.config.deviceProfiles[profileName]
    
    if (!profile) {
      console.warn(`[高级热力图配置] 未知设备配置: ${profileName}`)
      return this.config.deviceProfiles.triangle // 默认返回triangle
    }
    
    return {
      ...profile,
      profileName,
      isOptimalMode: profile.optimalModes.includes(this.config.renderModes.current)
    }
  }
  
  /**
   * 切换渲染模式
   */
  setRenderMode(mode) {
    if (!this.config.renderModes.available.includes(mode)) {
      console.warn(`[高级热力图配置] 不支持的渲染模式: ${mode}`)
      return false
    }
    
    const oldMode = this.config.renderModes.current
    this.config.renderModes.current = mode
    
    // 触发模式切换事件
    this.notifyChange('renderMode', { from: oldMode, to: mode })
    
    console.log(`[高级热力图配置] 渲染模式已切换: ${oldMode} → ${mode}`)
    return true
  }
  
  /**
   * 获取当前渲染模式配置
   */
  getRenderModeConfig() {
    const currentMode = this.config.renderModes.current
    return {
      mode: currentMode,
      config: this.config.renderModes[currentMode] || {},
      isAvailable: this.config.renderModes.available.includes(currentMode)
    }
  }
  
  /**
   * 设置设备配置
   */
  setDeviceProfile(profileName) {
    if (!(profileName in this.config.deviceProfiles)) {
      console.warn(`[高级热力图配置] 未知设备配置: ${profileName}`)
      return false
    }
    
    const oldProfile = this.config.fnirs.deviceProfile
    this.config.fnirs.deviceProfile = profileName
    
    // 更新相关配置
    const profile = this.config.deviceProfiles[profileName]
    this.config.fnirs.channelCount = profile.channels
    
    // 如果当前渲染模式不是最优模式，建议切换
    if (!profile.optimalModes.includes(this.config.renderModes.current)) {
      console.log(`[高级热力图配置] 建议切换到最优渲染模式: ${profile.optimalModes[0]}`)
    }
    
    this.notifyChange('deviceProfile', { from: oldProfile, to: profileName })
    
    console.log(`[高级热力图配置] 设备配置已切换: ${oldProfile} → ${profileName}`)
    return true
  }
  
  /**
   * 获取性能配置
   */
  getPerformanceConfig() {
    const deviceProfile = this.getDeviceProfile()
    const channelCount = deviceProfile.channels
    
    // 根据通道数动态调整性能配置
    let lodLevel = 'high'
    if (channelCount > this.config.performance.lod.thresholds.high) {
      lodLevel = 'low'
    } else if (channelCount > this.config.performance.lod.thresholds.medium) {
      lodLevel = 'medium'
    }
    
    return {
      ...this.config.performance,
      currentLOD: lodLevel,
      recommendedFPS: lodLevel === 'high' ? 30 : (lodLevel === 'medium' ? 20 : 15),
      channelCount
    }
  }
  
  /**
   * 获取优化建议
   */
  getOptimizationRecommendations() {
    const recommendations = []
    const deviceProfile = this.getDeviceProfile()
    const performanceConfig = this.getPerformanceConfig()
    
    // 渲染模式建议
    if (!deviceProfile.isOptimalMode) {
      recommendations.push({
        type: 'renderMode',
        level: 'warning',
        message: `当前渲染模式(${this.config.renderModes.current})不是${deviceProfile.name}的最优模式`,
        suggestion: `建议使用: ${deviceProfile.optimalModes.join(', ')}`
      })
    }
    
    // 性能建议
    if (deviceProfile.channels > 300 && !this.config.performance.enableWebGL) {
      recommendations.push({
        type: 'performance',
        level: 'info',
        message: '通道数较多，建议启用WebGL加速',
        suggestion: '设置 performance.enableWebGL = true'
      })
    }
    
    if (performanceConfig.currentLOD === 'low') {
      recommendations.push({
        type: 'performance',
        level: 'warning',
        message: '通道数过多，自动降低渲染质量',
        suggestion: '考虑减少通道数或启用硬件加速'
      })
    }
    
    // 内存建议
    const estimatedMemory = deviceProfile.channels * 0.1 // MB per channel
    if (estimatedMemory > this.config.performance.memoryLimit) {
      recommendations.push({
        type: 'memory',
        level: 'error',
        message: `预估内存使用(${estimatedMemory.toFixed(1)}MB)超过限制(${this.config.performance.memoryLimit}MB)`,
        suggestion: '增加内存限制或减少通道数'
      })
    }
    
    return recommendations
  }
  
  /**
   * 自动优化配置
   */
  autoOptimize() {
    const recommendations = this.getOptimizationRecommendations()
    let optimized = 0
    
    recommendations.forEach(rec => {
      switch (rec.type) {
        case 'renderMode':
          const deviceProfile = this.getDeviceProfile()
          if (this.setRenderMode(deviceProfile.optimalModes[0])) {
            optimized++
          }
          break
          
        case 'performance':
          if (rec.message.includes('WebGL')) {
            this.config.performance.enableWebGL = true
            optimized++
          }
          break
      }
    })
    
    if (optimized > 0) {
      console.log(`[高级热力图配置] 自动优化完成，应用了 ${optimized} 项建议`)
    }
    
    return optimized
  }
  
  /**
   * 验证配置
   */
  validateConfig() {
    const errors = []
    
    // 检查必需字段
    this.config.validation.required.forEach(path => {
      const value = this.getNestedValue(path)
      if (value === undefined || value === null) {
        errors.push(`必需字段缺失: ${path}`)
      }
    })
    
    // 检查数值范围
    Object.entries(this.config.validation.ranges).forEach(([path, [min, max]]) => {
      const value = this.getNestedValue(path)
      if (typeof value === 'number' && (value < min || value > max)) {
        errors.push(`字段 ${path} 的值 ${value} 超出范围 [${min}, ${max}]`)
      }
    })
    
    // 检查设备配置有效性
    const profileName = this.config.fnirs.deviceProfile
    if (!(profileName in this.config.deviceProfiles)) {
      errors.push(`无效的设备配置: ${profileName}`)
    }
    
    // 检查渲染模式有效性
    const renderMode = this.config.renderModes.current
    if (!this.config.renderModes.available.includes(renderMode)) {
      errors.push(`无效的渲染模式: ${renderMode}`)
    }
    
    if (errors.length > 0) {
      console.error('[高级热力图配置] 配置验证失败:', errors)
      throw new Error(`配置验证失败: ${errors.join('; ')}`)
    }
    
    console.log('[高级热力图配置] 配置验证通过')
  }
  
  /**
   * 获取嵌套对象的值
   */
  getNestedValue(path) {
    const keys = path.split('.')
    let value = this.config
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key]
      } else {
        return undefined
      }
    }
    
    return value
  }
  
  /**
   * 导出配置
   */
  exportConfig(format = 'json') {
    const exportData = {
      config: this.config,
      metadata: {
        version: '2.0',
        exportTime: new Date().toISOString(),
        deviceProfile: this.getDeviceProfile(),
        recommendations: this.getOptimizationRecommendations()
      }
    }
    
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(exportData, null, 2)
      case 'compact':
        return JSON.stringify(exportData)
      default:
        console.warn(`[高级热力图配置] 不支持的导出格式: ${format}`)
        return JSON.stringify(exportData, null, 2)
    }
  }
  
  /**
   * 从导出数据导入配置
   */
  importConfig(configData) {
    try {
      const data = typeof configData === 'string' ? JSON.parse(configData) : configData
      
      if (data.config) {
        this.config = { ...this.config, ...data.config }
        this.validateConfig()
        this.notifyChange('import', data.metadata)
        
        console.log('[高级热力图配置] 配置导入成功')
        return true
      } else {
        console.warn('[高级热力图配置] 无效的配置数据格式')
        return false
      }
    } catch (error) {
      console.error('[高级热力图配置] 配置导入失败:', error)
      return false
    }
  }
  
  /**
   * 获取配置摘要
   */
  getSummary() {
    const deviceProfile = this.getDeviceProfile()
    const renderModeConfig = this.getRenderModeConfig()
    const performanceConfig = this.getPerformanceConfig()
    
    return {
      device: {
        name: deviceProfile.name,
        channels: deviceProfile.channels,
        layout: deviceProfile.layout
      },
      rendering: {
        mode: renderModeConfig.mode,
        isOptimal: deviceProfile.isOptimalMode,
        interpolation: renderModeConfig.config.interpolation
      },
      performance: {
        lod: performanceConfig.currentLOD,
        webGL: this.config.performance.enableWebGL,
        fps: performanceConfig.recommendedFPS
      },
      recommendations: this.getOptimizationRecommendations().length
    }
  }
}

export default AdvancedHeatmapConfig