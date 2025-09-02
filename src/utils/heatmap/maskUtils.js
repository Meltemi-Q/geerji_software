/**
 * 热力图掩膜工具模块
 * 提供头部/前额区域掩膜、边缘平滑等功能
 */

/**
 * 掩膜形状定义
 */
const MASK_SHAPES = {
  HEAD: 'head',
  FOREHEAD: 'forehead', 
  TRIANGLE: 'triangle',
  CUSTOM: 'custom'
}

/**
 * 掩膜工具类
 */
export class MaskUtils {
  /**
   * 创建基于形状的掩膜
   * @param {number} gridSize - 网格大小
   * @param {Object} bounds - 边界信息 {minX, maxX, minY, maxY}
   * @param {Object} options - 掩膜选项
   * @returns {Float32Array} 掩膜数据（0-1浮点值）
   */
  static createShapeMask(gridSize, bounds, options = {}) {
    const { 
      maskType = MASK_SHAPES.FOREHEAD,
      edgeSmoothing = true,
      smoothingSigma = 2.0,
      threshold = 0.01
    } = options
    
    const mask = new Float32Array(gridSize * gridSize)
    
    // 选择对应的掩膜生成函数
    switch (maskType) {
      case MASK_SHAPES.HEAD:
        this._generateHeadMask(mask, gridSize, bounds, options)
        break
      case MASK_SHAPES.FOREHEAD:
        this._generateForeheadMask(mask, gridSize, bounds, options)
        break
      case MASK_SHAPES.TRIANGLE:
        this._generateTriangleMask(mask, gridSize, bounds, options)
        break
      case MASK_SHAPES.CUSTOM:
        this._generateCustomMask(mask, gridSize, bounds, options)
        break
      default:
        this._generateForeheadMask(mask, gridSize, bounds, options)
    }
    
    // 边缘平滑处理
    if (edgeSmoothing && smoothingSigma > 0) {
      return this._applyEdgeSmoothing(mask, gridSize, smoothingSigma)
    }
    
    return mask
  }

  /**
   * 从通道位置创建凸包掩膜
   * @param {Array} channelPositions - 通道位置数组
   * @param {number} gridSize - 网格大小
   * @param {Object} bounds - 网格边界
   * @param {Object} options - 选项
   * @returns {Float32Array} 掩膜数据
   */
  static createConvexHullMask(channelPositions, gridSize, bounds, options = {}) {
    const { 
      expansionMm = 5,        // 向外扩展距离(mm)
      smoothingSigma = 1.5,
      edgeSmoothing = true
    } = options
    
    const mask = new Float32Array(gridSize * gridSize)
    
    // 提取通道位置点
    const points = channelPositions.map(ch => ch.position || [ch.x, ch.y])
    
    // 计算凸包
    const convexHull = this._computeConvexHull(points)
    
    // 扩展凸包
    const expandedHull = this._expandPolygon(convexHull, expansionMm)
    
    // 为每个网格点计算是否在凸包内
    const width = bounds.maxX - bounds.minX
    const height = bounds.maxY - bounds.minY
    
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const gridX = bounds.minX + (x / (gridSize - 1)) * width
        const gridY = bounds.minY + (y / (gridSize - 1)) * height
        
        if (this._isPointInPolygon([gridX, gridY], expandedHull)) {
          mask[y * gridSize + x] = 1.0
        } else {
          mask[y * gridSize + x] = 0.0
        }
      }
    }
    
    // 边缘平滑
    if (edgeSmoothing) {
      return this._applyEdgeSmoothing(mask, gridSize, smoothingSigma)
    }
    
    return mask
  }

  /**
   * 应用掩膜到网格数据
   * @param {Float32Array} gridData - 原始网格数据
   * @param {Float32Array} maskData - 掩膜数据
   * @param {Object} options - 应用选项
   * @returns {Float32Array} 掩膜后的数据
   */
  static applyMask(gridData, maskData, options = {}) {
    const { 
      threshold = 0.01,        // 掩膜阈值
      outsideValue = NaN,      // 掩膜外的值
      preserveOriginal = false // 是否保持原始强度
    } = options
    
    const result = new Float32Array(gridData.length)
    
    for (let i = 0; i < gridData.length; i++) {
      const maskValue = maskData[i]
      
      if (maskValue > threshold) {
        if (preserveOriginal) {
          result[i] = gridData[i]
        } else {
          // 根据掩膜强度调节
          result[i] = gridData[i] * maskValue
        }
      } else {
        result[i] = outsideValue
      }
    }
    
    return result
  }

  /**
   * 创建渐变掩膜（距离场）
   * @param {number} gridSize - 网格大小
   * @param {Object} bounds - 边界信息
   * @param {Array} centerPoints - 中心点数组
   * @param {Object} options - 渐变选项
   * @returns {Float32Array} 掩膜数据
   */
  static createGradientMask(gridSize, bounds, centerPoints, options = {}) {
    const {
      maxDistance = 50,     // 最大影响距离(mm)
      falloffPower = 2,     // 衰减指数
      combineMethod = 'max' // 组合方式：'max', 'sum', 'average'
    } = options
    
    const mask = new Float32Array(gridSize * gridSize)
    const width = bounds.maxX - bounds.minX
    const height = bounds.maxY - bounds.minY
    
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const gridX = bounds.minX + (x / (gridSize - 1)) * width
        const gridY = bounds.minY + (y / (gridSize - 1)) * height
        
        let maskValue = 0
        
        for (const center of centerPoints) {
          const dx = gridX - center[0]
          const dy = gridY - center[1]
          const distance = Math.sqrt(dx * dx + dy * dy)
          
          if (distance <= maxDistance) {
            const normalizedDistance = distance / maxDistance
            const influence = 1 - Math.pow(normalizedDistance, falloffPower)
            
            switch (combineMethod) {
              case 'max':
                maskValue = Math.max(maskValue, influence)
                break
              case 'sum':
                maskValue += influence
                break
              case 'average':
                maskValue = (maskValue + influence) / 2
                break
            }
          }
        }
        
        mask[y * gridSize + x] = Math.min(1.0, maskValue)
      }
    }
    
    return mask
  }

  /**
   * 生成头部椭圆掩膜
   * @private
   */
  static _generateHeadMask(mask, gridSize, bounds, options) {
    const { scaleX = 1.0, scaleY = 1.0, offsetX = 0, offsetY = 0 } = options
    
    const centerX = (bounds.minX + bounds.maxX) / 2 + offsetX
    const centerY = (bounds.minY + bounds.maxY) / 2 + offsetY
    const radiusX = (bounds.maxX - bounds.minX) * 0.5 * scaleX
    const radiusY = (bounds.maxY - bounds.minY) * 0.5 * scaleY
    
    const width = bounds.maxX - bounds.minX
    const height = bounds.maxY - bounds.minY
    
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const gridX = bounds.minX + (x / (gridSize - 1)) * width
        const gridY = bounds.minY + (y / (gridSize - 1)) * height
        
        const normalizedX = (gridX - centerX) / radiusX
        const normalizedY = (gridY - centerY) / radiusY
        const distance = normalizedX * normalizedX + normalizedY * normalizedY
        
        if (distance <= 1.0) {
          // 平滑过渡
          mask[y * gridSize + x] = Math.max(0, 1 - Math.pow(distance, 0.5))
        } else {
          mask[y * gridSize + x] = 0
        }
      }
    }
  }

  /**
   * 生成前额区域掩膜
   * @private
   */
  static _generateForeheadMask(mask, gridSize, bounds, options) {
    const { 
      widthRatio = 0.8,     // 宽度比例
      heightRatio = 0.6,    // 高度比例
      verticalOffset = 0.1  // 垂直偏移（向上）
    } = options
    
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2
    const width = bounds.maxX - bounds.minX
    const height = bounds.maxY - bounds.minY
    
    // 前额区域参数
    const foreheadCenterY = centerY - height * verticalOffset
    const foreheadWidth = width * widthRatio * 0.5
    const foreheadHeight = height * heightRatio * 0.5
    
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const gridX = bounds.minX + (x / (gridSize - 1)) * width
        const gridY = bounds.minY + (y / (gridSize - 1)) * height
        
        const normalizedX = (gridX - centerX) / foreheadWidth
        const normalizedY = (gridY - foreheadCenterY) / foreheadHeight
        
        // 椭圆形前额区域
        const distance = normalizedX * normalizedX + normalizedY * normalizedY
        
        if (distance <= 1.0) {
          // 平滑衰减
          mask[y * gridSize + x] = Math.max(0, 1 - Math.pow(distance, 0.3))
        } else {
          mask[y * gridSize + x] = 0
        }
      }
    }
  }

  /**
   * 生成三角形布局掩膜
   * @private
   */
  static _generateTriangleMask(mask, gridSize, bounds, options) {
    const { vertices } = options
    
    if (!vertices || vertices.length < 3) {
      // 使用默认三角形
      const centerX = (bounds.minX + bounds.maxX) / 2
      const centerY = (bounds.minY + bounds.maxY) / 2
      const size = Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.4
      
      const defaultVertices = [
        [centerX, centerY - size],           // 上顶点
        [centerX - size * 0.866, centerY + size * 0.5],  // 左下
        [centerX + size * 0.866, centerY + size * 0.5]   // 右下
      ]
      
      this._fillPolygonMask(mask, gridSize, bounds, defaultVertices)
    } else {
      this._fillPolygonMask(mask, gridSize, bounds, vertices)
    }
  }

  /**
   * 生成自定义多边形掩膜
   * @private
   */
  static _generateCustomMask(mask, gridSize, bounds, options) {
    const { vertices, maskFunction } = options
    
    if (maskFunction && typeof maskFunction === 'function') {
      // 使用自定义函数
      const width = bounds.maxX - bounds.minX
      const height = bounds.maxY - bounds.minY
      
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const gridX = bounds.minX + (x / (gridSize - 1)) * width
          const gridY = bounds.minY + (y / (gridSize - 1)) * height
          
          mask[y * gridSize + x] = maskFunction(gridX, gridY, bounds)
        }
      }
    } else if (vertices) {
      this._fillPolygonMask(mask, gridSize, bounds, vertices)
    }
  }

  /**
   * 填充多边形掩膜
   * @private
   */
  static _fillPolygonMask(mask, gridSize, bounds, vertices) {
    const width = bounds.maxX - bounds.minX
    const height = bounds.maxY - bounds.minY
    
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const gridX = bounds.minX + (x / (gridSize - 1)) * width
        const gridY = bounds.minY + (y / (gridSize - 1)) * height
        
        if (this._isPointInPolygon([gridX, gridY], vertices)) {
          mask[y * gridSize + x] = 1.0
        } else {
          mask[y * gridSize + x] = 0.0
        }
      }
    }
  }

  /**
   * 边缘平滑处理
   * @private
   */
  static _applyEdgeSmoothing(mask, gridSize, sigma) {
    const result = new Float32Array(mask.length)
    const kernelRadius = Math.ceil(sigma * 3)
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
   * 计算凸包（Graham扫描算法）
   * @private
   */
  static _computeConvexHull(points) {
    if (points.length < 3) return points
    
    // 找到最下方（y最小）的点
    let bottom = points[0]
    for (const point of points) {
      if (point[1] < bottom[1] || (point[1] === bottom[1] && point[0] < bottom[0])) {
        bottom = point
      }
    }
    
    // 按极角排序
    const sortedPoints = points
      .filter(p => p !== bottom)
      .sort((a, b) => {
        const angleA = Math.atan2(a[1] - bottom[1], a[0] - bottom[0])
        const angleB = Math.atan2(b[1] - bottom[1], b[0] - bottom[0])
        return angleA - angleB
      })
    
    const hull = [bottom]
    
    for (const point of sortedPoints) {
      // 移除非左转的点
      while (hull.length >= 2 && this._crossProduct(
        hull[hull.length - 2], hull[hull.length - 1], point
      ) <= 0) {
        hull.pop()
      }
      hull.push(point)
    }
    
    return hull
  }

  /**
   * 扩展多边形
   * @private
   */
  static _expandPolygon(polygon, distance) {
    if (distance <= 0) return polygon
    
    const expanded = []
    const n = polygon.length
    
    for (let i = 0; i < n; i++) {
      const prev = polygon[(i - 1 + n) % n]
      const curr = polygon[i]
      const next = polygon[(i + 1) % n]
      
      // 计算法向量
      const normal1 = this._getNormal(prev, curr)
      const normal2 = this._getNormal(curr, next)
      
      // 平均法向量
      const avgNormal = [
        (normal1[0] + normal2[0]) / 2,
        (normal1[1] + normal2[1]) / 2
      ]
      
      // 标准化
      const length = Math.sqrt(avgNormal[0] * avgNormal[0] + avgNormal[1] * avgNormal[1])
      if (length > 0) {
        avgNormal[0] /= length
        avgNormal[1] /= length
      }
      
      // 扩展点
      expanded.push([
        curr[0] + avgNormal[0] * distance,
        curr[1] + avgNormal[1] * distance
      ])
    }
    
    return expanded
  }

  /**
   * 计算两点的法向量
   * @private
   */
  static _getNormal(p1, p2) {
    const dx = p2[0] - p1[0]
    const dy = p2[1] - p1[1]
    const length = Math.sqrt(dx * dx + dy * dy)
    
    if (length === 0) return [0, 0]
    
    return [-dy / length, dx / length] // 左法向量
  }

  /**
   * 点在多边形内判断（射线法）
   * @private
   */
  static _isPointInPolygon(point, polygon) {
    const x = point[0], y = point[1]
    let inside = false
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1]
      const xj = polygon[j][0], yj = polygon[j][1]
      
      if (((yi > y) !== (yj > y)) && 
          (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside
      }
    }
    
    return inside
  }

  /**
   * 计算叉积
   * @private
   */
  static _crossProduct(o, a, b) {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  }
}

// 导出常量
export { MASK_SHAPES }