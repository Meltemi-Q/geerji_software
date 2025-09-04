/**
 * 简化版 IDW 插值与网格工具
 * 提供：
 * - GridBuilder.createGridInfo(channelData, { gridSize, padding })
 * - IDWInterpolator.precomputeNeighbors(...)
 * - IDWInterpolator.interpolate(channelData, gridInfo, neighbors)
 * - IDWInterpolator.applyGaussianSmoothing(gridValues, gridSize, sigma)
 */

// 删除重复定义，保留下方完整实现

/**
 * IDW（反距离权重）插值算法模块
 * 支持K近邻选择、质量权重、半径限制等报告风格要求
 */

export class IDWInterpolator {
  constructor(options = {}) {
    this.power = options.power || 2          // IDW幂次，默认2
    this.kNeighbors = options.kNeighbors || 16  // K近邻数量
    this.radiusMm = options.radiusMm || 15   // 半径限制(mm)
    this.useRadius = options.useRadius || false  // 是否使用半径而非K近邻
    this.qualityWeightEnabled = options.qualityWeightEnabled || false
  }

  /**
   * 预计算网格点的近邻关系
   * @param {Array} channelPositions - 通道位置数组 [{position: [x, y], value: number, quality?: number}]
   * @param {Object} gridInfo - 网格信息 {width, height, gridSize, bounds}
   * @returns {Object} 预计算的近邻信息
   */
  precomputeNeighbors(channelPositions, gridInfo) {
    const { gridSize, bounds } = gridInfo
    const neighbors = new Array(gridSize * gridSize)
    
    // 为每个网格点计算近邻
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const gridIndex = y * gridSize + x
        const gridX = bounds.minX + (x / (gridSize - 1)) * (bounds.maxX - bounds.minX)
        const gridY = bounds.minY + (y / (gridSize - 1)) * (bounds.maxY - bounds.minY)
        
        // 计算所有通道到该网格点的距离
        const distances = channelPositions.map((channel, index) => ({
          index,
          distance: this._calculateDistance([gridX, gridY], channel.position),
          channel
        }))
        
        // 根据配置选择近邻
        let selectedNeighbors
        if (this.useRadius) {
          selectedNeighbors = distances
            .filter(d => d.distance <= this.radiusMm)
            .sort((a, b) => a.distance - b.distance)
        } else {
          selectedNeighbors = distances
            .sort((a, b) => a.distance - b.distance)
            .slice(0, this.kNeighbors)
        }
        
        neighbors[gridIndex] = selectedNeighbors
      }
    }
    
    return neighbors
  }

  /**
   * 执行IDW插值计算
   * @param {Array} channelPositions - 通道位置和数值
   * @param {Object} gridInfo - 网格配置
   * @param {Array} precomputedNeighbors - 预计算的近邻关系（可选）
   * @returns {Float32Array} 插值结果网格
   */
  interpolate(channelPositions, gridInfo, precomputedNeighbors = null) {
    const { gridSize } = gridInfo
    const resultGrid = new Float32Array(gridSize * gridSize)
    
    // 如果没有预计算近邻，则动态计算
    const neighbors = precomputedNeighbors || 
                     this.precomputeNeighbors(channelPositions, gridInfo)
    
    // 对每个网格点执行IDW插值
    for (let i = 0; i < gridSize * gridSize; i++) {
      const neighborList = neighbors[i]
      
      // 检查三角形mask约束 (6dock模式)
      if (gridInfo.triangleMask && !gridInfo.triangleMask[i]) {
        resultGrid[i] = NaN // 三角形外的点设为NaN
        continue
      }
      
      if (!neighborList || neighborList.length === 0) {
        resultGrid[i] = NaN
        continue
      }
      
      // 处理精确匹配（距离为0）
      const exactMatch = neighborList.find(n => n.distance < 1e-10)
      if (exactMatch) {
        resultGrid[i] = exactMatch.channel.value
        continue
      }
      
      // IDW插值计算
      let numerator = 0
      let denominator = 0
      
      for (const neighbor of neighborList) {
        const { distance, channel } = neighbor
        
        // 计算距离权重
        const distanceWeight = Math.pow(1 / distance, this.power)
        
        // 计算质量权重（可选）
        const qualityWeight = this.qualityWeightEnabled && channel.quality !== undefined
          ? this._calculateQualityWeight(channel.quality)
          : 1.0
        
        // 组合权重
        const combinedWeight = distanceWeight * qualityWeight
        
        numerator += channel.value * combinedWeight
        denominator += combinedWeight
      }
      
      resultGrid[i] = denominator > 0 ? numerator / denominator : NaN
    }
    
    return resultGrid
  }

  /**
   * 应用高斯平滑
   * @param {Float32Array} grid - 输入网格
   * @param {number} gridSize - 网格大小
   * @param {number} sigma - 高斯核标准差
   * @returns {Float32Array} 平滑后的网格
   */
  applyGaussianSmoothing(grid, gridSize, sigma = 2.0) {
    if (sigma <= 0) return grid
    
    // 分离式高斯滤波：先X方向，再Y方向
    const temp = new Float32Array(grid.length)
    const result = new Float32Array(grid.length)
    
    const kernelRadius = Math.ceil(sigma * 3) // 3σ截断
    const kernel = this._createGaussianKernel(kernelRadius, sigma)
    
    // X方向卷积
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        let sum = 0
        let weightSum = 0
        
        for (let kx = -kernelRadius; kx <= kernelRadius; kx++) {
          const nx = x + kx
          if (nx >= 0 && nx < gridSize) {
            const value = grid[y * gridSize + nx]
            if (!isNaN(value)) {
              const weight = kernel[kx + kernelRadius]
              sum += value * weight
              weightSum += weight
            }
          }
        }
        
        temp[y * gridSize + x] = weightSum > 0 ? sum / weightSum : NaN
      }
    }
    
    // Y方向卷积
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        let sum = 0
        let weightSum = 0
        
        for (let ky = -kernelRadius; ky <= kernelRadius; ky++) {
          const ny = y + ky
          if (ny >= 0 && ny < gridSize) {
            const value = temp[ny * gridSize + x]
            if (!isNaN(value)) {
              const weight = kernel[ky + kernelRadius]
              sum += value * weight
              weightSum += weight
            }
          }
        }
        
        result[y * gridSize + x] = weightSum > 0 ? sum / weightSum : NaN
      }
    }
    
    return result
  }

  /**
   * 计算两点间欧几里得距离
   * @private
   */
  _calculateDistance(point1, point2) {
    const dx = point1[0] - point2[0]
    const dy = point1[1] - point2[1]
    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * 计算质量权重
   * @private
   */
  _calculateQualityWeight(quality) {
    // 质量值范围假定为[0, 1]，转换为权重[0.1, 1.0]
    return 0.1 + 0.9 * Math.max(0, Math.min(1, quality))
  }

  /**
   * 创建高斯核
   * @private
   */
  _createGaussianKernel(radius, sigma) {
    const kernel = new Float32Array(2 * radius + 1)
    const twoSigmaSquared = 2 * sigma * sigma
    
    for (let i = 0; i <= 2 * radius; i++) {
      const x = i - radius
      kernel[i] = Math.exp(-x * x / twoSigmaSquared)
    }
    
    return kernel
  }

  /**
   * 通道距离过滤（按PRD要求：25-35mm默认范围）
   * @param {Array} channelPositions - 通道位置数组
   * @param {Object} options - 过滤选项
   * @returns {Array} 过滤后的通道
   */
  static filterChannelsByDistance(channelPositions, options = {}) {
    const { minDistance = 25, maxDistance = 35 } = options
    
    return channelPositions.filter(channel => {
      // 假设通道包含source和detector位置
      if (channel.source && channel.detector) {
        const distance = this.prototype._calculateDistance(
          [channel.source.x, channel.source.y],
          [channel.detector.x, channel.detector.y]
        )
        return distance >= minDistance && distance <= maxDistance
      }
      return true // 如果没有距离信息，保留通道
    })
  }
}

/**
 * 网格构建工具
 */
export class GridBuilder {
  /**
   * 从通道位置创建网格配置
   * @param {Array} channelPositions - 通道位置数组
   * @param {Object} options - 网格选项
   * @returns {Object} 网格配置信息
   */
  static createGridInfo(channelPositions, options = {}) {
    const { 
      gridSize = 120, 
      padding = 5, 
      fixedBounds = null, 
      layoutDimensions = null,
      useSixDockMode = false,
      sixDockTriangleVertices = []
    } = options

    // 计算边界
    const positions = channelPositions.map(ch => ch.position)
    const xCoords = positions.map(p => p[0])
    const yCoords = positions.map(p => p[1])

    let bounds
    if (fixedBounds && typeof fixedBounds.minX === 'number') {
      // 使用固定边界（例如完整Triangle布局: [0, W] x [0, H]）
      bounds = { ...fixedBounds }
    } else if (layoutDimensions && typeof layoutDimensions.x === 'number' && typeof layoutDimensions.y === 'number') {
      // 使用布局尺寸作为边界
      bounds = { minX: 0, maxX: layoutDimensions.x, minY: 0, maxY: layoutDimensions.y }
    } else {
      // 默认：根据通道点范围 + padding 计算
      bounds = {
        minX: Math.min(...xCoords) - padding,
        maxX: Math.max(...xCoords) + padding,
        minY: Math.min(...yCoords) - padding,
        maxY: Math.max(...yCoords) + padding
      }
    }

    const width = bounds.maxX - bounds.minX
    const height = bounds.maxY - bounds.minY

    // 6dock三角形mask支持
    let triangleMask = null
    if (useSixDockMode && sixDockTriangleVertices && sixDockTriangleVertices.length === 3) {
      console.log('[GridBuilder] 启用6dock三角形mask模式')
      console.log('[GridBuilder] 三角形顶点:', sixDockTriangleVertices)
      
      // 创建三角形mask (网格中每个点是否在三角形内)
      triangleMask = this._createTriangleMask(gridSize, bounds, sixDockTriangleVertices)
      
      console.log('[GridBuilder] 三角形mask生成完成，有效点数:', triangleMask.filter(Boolean).length)
    }

    return {
      gridSize,
      bounds,
      width,
      height,
      pixelSize: Math.max(width, height) / gridSize,
      // 6dock三角形支持
      useSixDockMode,
      triangleMask, // 如果启用6dock模式，这里包含每个网格点是否在三角形内的boolean数组
      triangleVertices: sixDockTriangleVertices
    }
  }

  /**
   * 创建三角形mask - 判断网格中哪些点在三角形内
   * @param {number} gridSize - 网格大小
   * @param {Object} bounds - 边界信息
   * @param {Array} triangleVertices - 三角形顶点 [{x, y}, {x, y}, {x, y}]
   * @returns {Array} Boolean数组，true表示在三角形内
   * @private
   */
  static _createTriangleMask(gridSize, bounds, triangleVertices) {
    const mask = new Array(gridSize * gridSize)
    
    // 提取三角形顶点
    const [v1, v2, v3] = triangleVertices
    
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const gridIndex = y * gridSize + x
        
        // 将网格坐标转换为实际坐标 (Triangle坐标系)
        const realX = bounds.minX + (x / (gridSize - 1)) * (bounds.maxX - bounds.minX)
        const realY = bounds.minY + (y / (gridSize - 1)) * (bounds.maxY - bounds.minY)
        
        // 判断点是否在三角形内
        mask[gridIndex] = this._isPointInTriangle(realX, realY, v1, v2, v3)
      }
    }
    
    return mask
  }

  /**
   * 判断点是否在三角形内 (重心坐标法)
   * @param {number} px - 点的x坐标
   * @param {number} py - 点的y坐标
   * @param {Object} v1 - 三角形顶点1 {x, y}
   * @param {Object} v2 - 三角形顶点2 {x, y}
   * @param {Object} v3 - 三角形顶点3 {x, y}
   * @returns {boolean}
   * @private
   */
  static _isPointInTriangle(px, py, v1, v2, v3) {
    // 使用重心坐标法判断点是否在三角形内
    const denom = (v2.y - v3.y) * (v1.x - v3.x) + (v3.x - v2.x) * (v1.y - v3.y)
    
    // 防止分母为0 (三角形退化)
    if (Math.abs(denom) < 1e-10) {
      return false
    }
    
    const a = ((v2.y - v3.y) * (px - v3.x) + (v3.x - v2.x) * (py - v3.y)) / denom
    const b = ((v3.y - v1.y) * (px - v3.x) + (v1.x - v3.x) * (py - v3.y)) / denom
    const c = 1 - a - b
    
    // 点在三角形内当且仅当所有重心坐标都非负
    return a >= 0 && b >= 0 && c >= 0
  }
}