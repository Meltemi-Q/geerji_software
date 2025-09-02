/**
 * 热力图计算Web Worker
 * 处理IDW插值、高斯平滑、掩膜处理等计算密集型任务
 * 避免阻塞主UI线程
 */

// 导入算法模块（注意：Worker中需要使用importScripts或ES modules）
let IDWInterpolator = null
let MaskUtils = null

// 模拟IDW算法（简化版，用于Worker环境）
class WorkerIDW {
  constructor(options = {}) {
    this.power = options.power || 2
    this.kNeighbors = options.kNeighbors || 16
    this.radiusMm = options.radiusMm || 15
    this.useRadius = options.useRadius || false
  }

  interpolate(channelPositions, gridInfo) {
    const { gridSize, bounds } = gridInfo
    const resultGrid = new Float32Array(gridSize * gridSize)
    
    const width = bounds.maxX - bounds.minX
    const height = bounds.maxY - bounds.minY
    
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const gridX = bounds.minX + (x / (gridSize - 1)) * width
        const gridY = bounds.minY + (y / (gridSize - 1)) * height
        
        // 计算到所有通道的距离
        const distances = channelPositions.map((channel, index) => ({
          index,
          distance: this._calculateDistance([gridX, gridY], channel.position),
          value: channel.value
        }))
        
        // 选择近邻
        let neighbors
        if (this.useRadius) {
          neighbors = distances
            .filter(d => d.distance <= this.radiusMm)
            .sort((a, b) => a.distance - b.distance)
        } else {
          neighbors = distances
            .sort((a, b) => a.distance - b.distance)
            .slice(0, this.kNeighbors)
        }
        
        if (neighbors.length === 0) {
          resultGrid[y * gridSize + x] = NaN
          continue
        }
        
        // 检查是否有精确匹配
        const exactMatch = neighbors.find(n => n.distance < 1e-10)
        if (exactMatch) {
          resultGrid[y * gridSize + x] = exactMatch.value
          continue
        }
        
        // IDW插值
        let numerator = 0
        let denominator = 0
        
        for (const neighbor of neighbors) {
          const weight = Math.pow(1 / neighbor.distance, this.power)
          numerator += neighbor.value * weight
          denominator += weight
        }
        
        resultGrid[y * gridSize + x] = denominator > 0 ? numerator / denominator : NaN
      }
    }
    
    return resultGrid
  }

  _calculateDistance(point1, point2) {
    const dx = point1[0] - point2[0]
    const dy = point1[1] - point2[1]
    return Math.sqrt(dx * dx + dy * dy)
  }

  applyGaussianSmoothing(grid, gridSize, sigma = 2.0) {
    if (sigma <= 0) return grid
    
    const temp = new Float32Array(grid.length)
    const result = new Float32Array(grid.length)
    
    const kernelRadius = Math.ceil(sigma * 3)
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

  _createGaussianKernel(radius, sigma) {
    const kernel = new Float32Array(2 * radius + 1)
    const twoSigmaSquared = 2 * sigma * sigma
    
    for (let i = 0; i <= 2 * radius; i++) {
      const x = i - radius
      kernel[i] = Math.exp(-x * x / twoSigmaSquared)
    }
    
    return kernel
  }
}

// 掩膜处理（简化版）
class WorkerMask {
  static createForeheadMask(gridSize, bounds) {
    const mask = new Float32Array(gridSize * gridSize)
    
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2
    const width = bounds.maxX - bounds.minX
    const height = bounds.maxY - bounds.minY
    
    // 前额区域参数
    const foreheadCenterY = centerY - height * 0.1
    const foreheadWidth = width * 0.8 * 0.5
    const foreheadHeight = height * 0.6 * 0.5
    
    const gridWidth = bounds.maxX - bounds.minX
    const gridHeight = bounds.maxY - bounds.minY
    
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const gridX = bounds.minX + (x / (gridSize - 1)) * gridWidth
        const gridY = bounds.minY + (y / (gridSize - 1)) * gridHeight
        
        const normalizedX = (gridX - centerX) / foreheadWidth
        const normalizedY = (gridY - foreheadCenterY) / foreheadHeight
        
        const distance = normalizedX * normalizedX + normalizedY * normalizedY
        
        if (distance <= 1.0) {
          mask[y * gridSize + x] = Math.max(0, 1 - Math.pow(distance, 0.3))
        } else {
          mask[y * gridSize + x] = 0
        }
      }
    }
    
    return mask
  }

  static applyMask(gridData, maskData, threshold = 0.01) {
    const result = new Float32Array(gridData.length)
    
    for (let i = 0; i < gridData.length; i++) {
      const maskValue = maskData[i]
      if (maskValue > threshold) {
        result[i] = gridData[i]
      } else {
        result[i] = NaN
      }
    }
    
    return result
  }
}

// Worker全局状态
let interpolator = null
let isProcessing = false

// 消息处理器
self.onmessage = function(e) {
  const { type, data, id } = e.data
  
  try {
    switch (type) {
      case 'init':
        handleInit(data, id)
        break
        
      case 'interpolate':
        handleInterpolate(data, id)
        break
        
      case 'smoothing':
        handleSmoothing(data, id)
        break
        
      case 'mask':
        handleMask(data, id)
        break
        
      case 'full-processing':
        handleFullProcessing(data, id)
        break
        
      case 'status':
        handleStatus(id)
        break
        
      default:
        postMessage({
          type: 'error',
          error: `未知的消息类型: ${type}`,
          id
        })
    }
  } catch (error) {
    postMessage({
      type: 'error',
      error: error.message,
      stack: error.stack,
      id
    })
  }
}

// 初始化处理器
function handleInit(config, id) {
  interpolator = new WorkerIDW({
    power: config.power || 2,
    kNeighbors: config.kNeighbors || 16,
    radiusMm: config.radiusMm || 15,
    useRadius: config.useRadius || false
  })
  
  postMessage({
    type: 'init-complete',
    success: true,
    id
  })
}

// IDW插值处理
function handleInterpolate(data, id) {
  const startTime = performance.now()
  
  if (!interpolator) {
    interpolator = new WorkerIDW(data.config || {})
  }
  
  const result = interpolator.interpolate(data.channelPositions, data.gridInfo)
  
  const endTime = performance.now()
  const processingTime = endTime - startTime
  
  postMessage({
    type: 'interpolate-complete',
    result: result,
    processingTime: processingTime,
    gridSize: data.gridInfo.gridSize,
    id
  })
}

// 高斯平滑处理
function handleSmoothing(data, id) {
  const startTime = performance.now()
  
  if (!interpolator) {
    interpolator = new WorkerIDW()
  }
  
  const result = interpolator.applyGaussianSmoothing(
    data.gridData,
    data.gridSize,
    data.sigma
  )
  
  const endTime = performance.now()
  
  postMessage({
    type: 'smoothing-complete',
    result: result,
    processingTime: endTime - startTime,
    id
  })
}

// 掩膜处理
function handleMask(data, id) {
  const startTime = performance.now()
  
  let maskData
  if (data.maskData) {
    // 应用现有掩膜
    maskData = WorkerMask.applyMask(data.gridData, data.maskData, data.threshold)
  } else {
    // 创建新掩膜
    const mask = WorkerMask.createForeheadMask(data.gridSize, data.bounds)
    maskData = WorkerMask.applyMask(data.gridData, mask, data.threshold || 0.01)
  }
  
  const endTime = performance.now()
  
  postMessage({
    type: 'mask-complete',
    result: maskData,
    processingTime: endTime - startTime,
    id
  })
}

// 完整处理流程
function handleFullProcessing(data, id) {
  if (isProcessing) {
    postMessage({
      type: 'error',
      error: 'Worker正忙，请稍后重试',
      id
    })
    return
  }
  
  isProcessing = true
  const startTime = performance.now()
  
  try {
    // 报告开始
    postMessage({
      type: 'processing-started',
      id
    })
    
    // 步骤1: IDW插值
    if (!interpolator) {
      interpolator = new WorkerIDW(data.config || {})
    }
    
    const interpolatedData = interpolator.interpolate(
      data.channelPositions, 
      data.gridInfo
    )
    
    postMessage({
      type: 'processing-progress',
      step: 1,
      total: 3,
      stepName: 'IDW插值完成',
      id
    })
    
    // 步骤2: 高斯平滑
    const smoothedData = interpolator.applyGaussianSmoothing(
      interpolatedData,
      data.gridInfo.gridSize,
      data.config?.gaussianSigma || 2.0
    )
    
    postMessage({
      type: 'processing-progress',
      step: 2,
      total: 3,
      stepName: '高斯平滑完成',
      id
    })
    
    // 步骤3: 掩膜处理
    const mask = WorkerMask.createForeheadMask(
      data.gridInfo.gridSize, 
      data.gridInfo.bounds
    )
    
    const finalData = WorkerMask.applyMask(smoothedData, mask)
    
    const endTime = performance.now()
    const totalTime = endTime - startTime
    
    postMessage({
      type: 'processing-complete',
      result: finalData,
      mask: mask,
      processingTime: totalTime,
      gridSize: data.gridInfo.gridSize,
      stats: {
        interpolationPoints: data.channelPositions.length,
        gridPoints: data.gridInfo.gridSize * data.gridInfo.gridSize,
        validPoints: Array.from(finalData).filter(v => !isNaN(v)).length
      },
      id
    })
    
  } catch (error) {
    postMessage({
      type: 'processing-error',
      error: error.message,
      stack: error.stack,
      id
    })
  } finally {
    isProcessing = false
  }
}

// 状态查询
function handleStatus(id) {
  postMessage({
    type: 'status-response',
    isProcessing: isProcessing,
    hasInterpolator: !!interpolator,
    timestamp: Date.now(),
    id
  })
}

// 错误处理
self.onerror = function(error) {
  postMessage({
    type: 'worker-error',
    error: error.message,
    filename: error.filename,
    lineno: error.lineno
  })
}

// Worker就绪通知
postMessage({
  type: 'worker-ready',
  timestamp: Date.now()
})