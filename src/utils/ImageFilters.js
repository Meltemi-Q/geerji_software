/**
 * 图像滤波模块
 * 负责高斯滤波、平滑遮罩等图像处理功能
 */
export class ImageFilters {
  
  /**
   * 高斯滤波函数
   */
  static gaussianFilter(grid, sigma = 0.5) {
    const result = Array(grid.length).fill().map(() => Array(grid[0].length).fill(NaN))
    const kernelSize = Math.ceil(3 * sigma)
    
    // 创建高斯核
    const kernel = []
    let kernelSum = 0
    for (let i = -kernelSize; i <= kernelSize; i++) {
      for (let j = -kernelSize; j <= kernelSize; j++) {
        const value = Math.exp(-(i*i + j*j) / (2 * sigma * sigma))
        kernel.push({ i, j, value })
        kernelSum += value
      }
    }
    
    // 归一化核
    kernel.forEach(k => k.value /= kernelSum)
    
    // 应用滤波
    for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j < grid[0].length; j++) {
        if (isNaN(grid[i][j])) continue
        
        let sum = 0
        let weightSum = 0
        
        for (const k of kernel) {
          const ni = i + k.i
          const nj = j + k.j
          
          if (ni >= 0 && ni < grid.length && nj >= 0 && nj < grid[0].length) {
            if (!isNaN(grid[ni][nj])) {
              sum += grid[ni][nj] * k.value
              weightSum += k.value
            }
          }
        }
        
        if (weightSum > 0) {
          result[i][j] = sum / weightSum
        }
      }
    }
    
    return result
  }

  /**
   * 创建可配置透明度的平滑遮罩边缘
   * 支持maskAlpha参数控制遮罩透明度和域一致性
   */
  static createSmoothMask(mask, config, sigma = 4.0) {
    const result = Array(mask.length).fill().map(() => Array(mask[0].length).fill(0))
    const kernelSize = Math.ceil(3 * sigma)
    
    // 遮罩域一致性检查
    if (config.scaleDebugMode) {
      console.log(`[MASK-DEBUG] 创建平滑遮罩: sigma=${sigma}, 透明度=${config.maskAlpha}`)
      console.log(`[MASK-DEBUG] 域一致性启用: ${config.maskDomainConsistency}`)
    }
    
    // 应用高斯滤波到掩码
    for (let i = 0; i < mask.length; i++) {
      for (let j = 0; j < mask[0].length; j++) {
        let sum = 0
        let count = 0
        
        for (let ki = -kernelSize; ki <= kernelSize; ki++) {
          for (let kj = -kernelSize; kj <= kernelSize; kj++) {
            const ni = i + ki
            const nj = j + kj
            
            if (ni >= 0 && ni < mask.length && nj >= 0 && nj < mask[0].length) {
              const weight = Math.exp(-(ki*ki + kj*kj) / (2 * sigma * sigma))
              // 使用与热力图相同的域判定逻辑
              let maskValue
              if (config.maskDomainConsistency) {
                // 将网格坐标转换为实际坐标范围 [-1, 1]
                const x = (nj / mask[0].length) * 2 - 1
                const y = (ni / mask.length) * 2 - 1
                // 这里需要传入isPointInBrainContour函数
                // 为了模块化，我们将这个作为参数传入
                maskValue = config.isPointInBrainContourFn ? config.isPointInBrainContourFn(x, y) ? 1 : 0 : (mask[ni][nj] ? 1 : 0)
              } else {
                maskValue = mask[ni][nj] ? 1 : 0
              }
              
              sum += maskValue * weight
              count += weight
            }
          }
        }
        
        result[i][j] = count > 0 ? sum / count : 0
      }
    }

    // 应用透明度参数进行归一化
    const max = Math.max(...result.flat())
    if (max > 0) {
      for (let i = 0; i < result.length; i++) {
        for (let j = 0; j < result[0].length; j++) {
          // 先归一化到[0,1]，然后应用maskAlpha
          result[i][j] = (result[i][j] / max) * config.maskAlpha
        }
      }
    }
    
    if (config.scaleDebugMode) {
      const nonZeroMask = result.flat().filter(val => val > 0).length
      const avgAlpha = result.flat().reduce((sum, val) => sum + val, 0) / result.flat().length
      console.log(`[MASK-DEBUG] 遮罩生成完成: 非零像素=${nonZeroMask}, 平均透明度=${avgAlpha.toFixed(3)}`)
    }
    
    return result
  }
}