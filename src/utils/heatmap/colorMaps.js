/**
 * 热力图颜色映射模块
 * 支持固定色域、多种色谱、离散色阶等报告风格要求
 */

/**
 * 颜色映射管理器
 */
export class ColorMapManager {
  constructor(options = {}) {
    this.valueDomain = options.valueDomain || { min: -0.05, max: 0.05 }
    this.colorMap = options.colorMap || 'Spectral'
    this.discreteLevels = options.discreteLevels || 9
    this.centerValue = options.centerValue || 0
    
    // 预定义色谱
    this.colorMaps = {
      'Spectral': this._createSpectralColorMap(),
      'RdYlGn': this._createRdYlGnColorMap(),
      'Rainbow': this._createRainbowColorMap(),
      'Jet': this._createJetColorMap()
    }
  }

  /**
   * 获取数值对应的RGB颜色
   * @param {number} value - 数值
   * @param {boolean} discrete - 是否使用离散色阶
   * @returns {Array} [r, g, b] 颜色数组
   */
  getColor(value, discrete = true) {
    // 处理NaN和无效值
    if (isNaN(value) || value === null || value === undefined) {
      return [0, 0, 0, 0] // 透明
    }
    
    // 标准化到[0,1]范围
    let normalizedValue = (value - this.valueDomain.min) / 
                         (this.valueDomain.max - this.valueDomain.min)
    normalizedValue = Math.max(0, Math.min(1, normalizedValue))
    
    // 离散化处理
    if (discrete && this.discreteLevels > 1) {
      const levelSize = 1 / (this.discreteLevels - 1)
      normalizedValue = Math.round(normalizedValue / levelSize) * levelSize
    }
    
    // 获取颜色映射
    const colorMapData = this.colorMaps[this.colorMap]
    return this._interpolateColor(colorMapData, normalizedValue)
  }

  /**
   * 获取颜色条数据
   * @returns {Object} 颜色条配置
   */
  getColorBarData() {
    const steps = this.discreteLevels
    const colorBarData = []
    
    for (let i = 0; i < steps; i++) {
      const normalizedValue = i / (steps - 1)
      const actualValue = this.valueDomain.min + 
                         normalizedValue * (this.valueDomain.max - this.valueDomain.min)
      const color = this.getColor(actualValue, false) // 连续色彩用于颜色条
      
      colorBarData.push({
        value: actualValue,
        color: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
        position: normalizedValue
      })
    }
    
    return {
      data: colorBarData,
      domain: this.valueDomain,
      levels: this.discreteLevels,
      colorMap: this.colorMap
    }
  }

  /**
   * 获取中心色（用于12-node覆盖层）
   * @returns {Array} [r, g, b, a] 中心颜色
   */
  getCenterColor() {
    const centerColor = this.getColor(this.centerValue, false)
    return [centerColor[0], centerColor[1], centerColor[2], 0.6] // 默认透明度0.6
  }

  /**
   * 创建Spectral色谱（蓝-青-绿-黄-橙-红）
   * @private
   */
  _createSpectralColorMap() {
    return [
      [0.0, [158, 1, 66]],     // 深红
      [0.1, [213, 62, 79]],    // 红
      [0.2, [244, 109, 67]],   // 橙红
      [0.3, [253, 174, 97]],   // 橙
      [0.4, [254, 224, 139]],  // 黄橙
      [0.5, [255, 255, 191]],  // 淡黄（中心）
      [0.6, [230, 245, 152]],  // 黄绿
      [0.7, [171, 221, 164]],  // 浅绿
      [0.8, [102, 194, 165]],  // 绿
      [0.9, [50, 136, 189]],   // 蓝绿
      [1.0, [94, 79, 162]]     // 蓝紫
    ]
  }

  /**
   * 创建RdYlGn色谱（红-黄-绿）
   * @private
   */
  _createRdYlGnColorMap() {
    return [
      [0.0, [165, 0, 38]],     // 深红
      [0.125, [215, 48, 39]],  // 红
      [0.25, [244, 109, 67]],  // 橙红
      [0.375, [253, 174, 97]], // 橙
      [0.5, [255, 255, 191]],  // 淡黄（中心）
      [0.625, [217, 239, 139]], // 黄绿
      [0.75, [166, 217, 106]], // 浅绿
      [0.875, [102, 189, 99]], // 绿
      [1.0, [26, 152, 80]]     // 深绿
    ]
  }

  /**
   * 创建Rainbow色谱
   * @private
   */
  _createRainbowColorMap() {
    return [
      [0.0, [128, 0, 128]],    // 紫
      [0.2, [0, 0, 255]],      // 蓝
      [0.4, [0, 255, 255]],    // 青
      [0.6, [0, 255, 0]],      // 绿
      [0.8, [255, 255, 0]],    // 黄
      [1.0, [255, 0, 0]]       // 红
    ]
  }

  /**
   * 创建Jet色谱
   * @private
   */
  _createJetColorMap() {
    return [
      [0.0, [0, 0, 128]],      // 深蓝
      [0.125, [0, 0, 255]],    // 蓝
      [0.25, [0, 128, 255]],   // 浅蓝
      [0.375, [0, 255, 255]],  // 青
      [0.5, [128, 255, 128]],  // 浅绿
      [0.625, [255, 255, 0]],  // 黄
      [0.75, [255, 128, 0]],   // 橙
      [0.875, [255, 0, 0]],    // 红
      [1.0, [128, 0, 0]]       // 深红
    ]
  }

  /**
   * 在色谱中插值获取颜色
   * @private
   */
  _interpolateColor(colorMapData, normalizedValue) {
    // 边界情况
    if (normalizedValue <= 0) return colorMapData[0][1]
    if (normalizedValue >= 1) return colorMapData[colorMapData.length - 1][1]
    
    // 找到插值区间
    for (let i = 0; i < colorMapData.length - 1; i++) {
      const [pos1, color1] = colorMapData[i]
      const [pos2, color2] = colorMapData[i + 1]
      
      if (normalizedValue >= pos1 && normalizedValue <= pos2) {
        const ratio = (normalizedValue - pos1) / (pos2 - pos1)
        return [
          Math.round(color1[0] + (color2[0] - color1[0]) * ratio),
          Math.round(color1[1] + (color2[1] - color1[1]) * ratio),
          Math.round(color1[2] + (color2[2] - color1[2]) * ratio)
        ]
      }
    }
    
    return colorMapData[0][1] // 后备颜色
  }

  /**
   * 更新色域范围
   */
  updateValueDomain(newDomain) {
    this.valueDomain = { ...newDomain }
  }

  /**
   * 更新色谱类型
   */
  updateColorMap(colorMapName) {
    if (this.colorMaps[colorMapName]) {
      this.colorMap = colorMapName
    } else {
      console.warn(`颜色映射 ${colorMapName} 不存在，使用默认的 Spectral`)
    }
  }

  /**
   * 更新离散级数
   */
  updateDiscreteLevels(levels) {
    this.discreteLevels = Math.max(3, Math.min(21, levels)) // 限制在3-21之间
  }
}

/**
 * 掩膜工具类
 */
export class MaskUtils {
  /**
   * 创建头部/前额区域掩膜
   * @param {number} gridSize - 网格大小
   * @param {Object} bounds - 边界信息
   * @param {Object} options - 掩膜选项
   * @returns {Float32Array} 掩膜数据（0-1浮点值）
   */
  static createHeadMask(gridSize, bounds, options = {}) {
    const { 
      maskType = 'forehead',  // 'head' | 'forehead'
      smoothing = true,
      smoothingSigma = 2.0
    } = options
    
    const mask = new Float32Array(gridSize * gridSize)
    
    // 计算网格中心和尺寸
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2
    const width = bounds.maxX - bounds.minX
    const height = bounds.maxY - bounds.minY
    
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const gridX = bounds.minX + (x / (gridSize - 1)) * width
        const gridY = bounds.minY + (y / (gridSize - 1)) * height
        
        let maskValue = 0
        
        if (maskType === 'head') {
          maskValue = this._calculateHeadMaskValue(gridX, gridY, centerX, centerY, width, height)
        } else if (maskType === 'forehead') {
          maskValue = this._calculateForeheadMaskValue(gridX, gridY, centerX, centerY, width, height)
        }
        
        mask[y * gridSize + x] = maskValue
      }
    }
    
    // 应用平滑处理
    if (smoothing) {
      return this._smoothMask(mask, gridSize, smoothingSigma)
    }
    
    return mask
  }

  /**
   * 计算头部掩膜值
   * @private
   */
  static _calculateHeadMaskValue(x, y, centerX, centerY, width, height) {
    // 椭圆掩膜
    const normalizedX = (x - centerX) / (width * 0.5)
    const normalizedY = (y - centerY) / (height * 0.5)
    const distance = normalizedX * normalizedX + normalizedY * normalizedY
    
    if (distance <= 1.0) {
      // 内部区域，使用平滑过渡
      return Math.max(0, 1 - Math.pow(distance, 0.5))
    }
    
    return 0
  }

  /**
   * 计算前额掩膜值
   * @private
   */
  static _calculateForeheadMaskValue(x, y, centerX, centerY, width, height) {
    // 前额区域（头部上半部分的椭圆）
    const normalizedX = (x - centerX) / (width * 0.4)
    const normalizedY = (y - centerY) / (height * 0.3)
    
    // 只保留上半部分
    if (y > centerY + height * 0.1) return 0
    
    const distance = normalizedX * normalizedX + normalizedY * normalizedY
    
    if (distance <= 1.0) {
      return Math.max(0, 1 - Math.pow(distance, 0.3))
    }
    
    return 0
  }

  /**
   * 平滑掩膜边缘
   * @private
   */
  static _smoothMask(mask, gridSize, sigma) {
    if (sigma <= 0) return mask
    
    const result = new Float32Array(mask.length)
    const kernelRadius = Math.ceil(sigma * 2)
    const twoSigmaSquared = 2 * sigma * sigma
    
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        let sum = 0
        let weightSum = 0
        
        for (let dy = -kernelRadius; dy <= kernelRadius; dy++) {
          for (let dx = -kernelRadius; dx <= kernelRadius; dx++) {
            const nx = x + dx
            const ny = y + dy
            
            if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
              const distance = dx * dx + dy * dy
              const weight = Math.exp(-distance / twoSigmaSquared)
              sum += mask[ny * gridSize + nx] * weight
              weightSum += weight
            }
          }
        }
        
        result[y * gridSize + x] = weightSum > 0 ? sum / weightSum : 0
      }
    }
    
    return result
  }

  /**
   * 应用掩膜到网格数据
   */
  static applyMask(gridData, maskData) {
    const result = new Float32Array(gridData.length)
    
    for (let i = 0; i < gridData.length; i++) {
      const maskValue = maskData[i]
      if (maskValue > 0.01) { // 掩膜阈值
        result[i] = gridData[i]
      } else {
        result[i] = NaN // 掩膜外区域
      }
    }
    
    return result
  }
}