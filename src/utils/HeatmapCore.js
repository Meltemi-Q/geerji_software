/**
 * 核心热力图生成模块
 * 负责热力图数据的生成和插值计算
 */
import { GeometryUtils } from './GeometryUtils.js'
import { ImageFilters } from './ImageFilters.js'

export class HeatmapCore {
  
  /**
   * 生成基于通道的连续热力图数据
   */
  static generateContinuousHeatmap(info, channelValues, config) {
    if (!info || !channelValues || !channelValues.length) {
      console.warn('缺少必要的数据，无法生成热力图')
      return { gridData: [], extent: [-1, 1, -1, 1] }
    }
    
    // Phase 2.2: 基于真实通道位置创建约束逻辑
    let channelPositions = []
    let selectedValues = []
    let validChannelCount = 0
    
    if (info.channelMidpoints && info.channelMidpoints.length > 0) {
      console.log('[约束逻辑] 使用真实通道中点位置数据')
      
      // 使用真实通道中点位置
      for (let i = 0; i < Math.min(info.channelMidpoints.length, channelValues.length); i++) {
        const midpoint = info.channelMidpoints[i]
        const value = channelValues[i]
        
        // 检查数据有效性
        if (!isNaN(value) && midpoint && midpoint.position) {
          // 使用3D坐标的x,y分量，忽略z轴
          channelPositions.push([midpoint.position[0], midpoint.position[1]])
          selectedValues.push(value)
          validChannelCount++
        }
      }
      
      console.log(`[约束逻辑] 真实通道数据: ${validChannelCount}/${info.channelMidpoints.length} 有效`)
    } else {
      console.log('[约束逻辑] 回退到传统通道选择方法')
      
      // 回退到原来的通道选择逻辑
      const selectedChannels = GeometryUtils.selectChannelsForTopograph(info)
      if (!selectedChannels || selectedChannels.length === 0) {
        console.warn('没有选择到合适的通道')
        return { gridData: [], extent: [-1, 1, -1, 1] }
      }
      
      // 获取传统的通道位置
      const sources = info.optodes.spos2
      const detectors = info.optodes.dpos2
      
      for (const chIdx of selectedChannels) {
        const sourceIdx = info.pairs.Src[chIdx] - 1
        const detectorIdx = info.pairs.Det[chIdx] - 1
        const x = (sources[sourceIdx][0] + detectors[detectorIdx][0]) / 2
        const y = (sources[sourceIdx][1] + detectors[detectorIdx][1]) / 2
        
        // 检查数据有效性
        if (isNaN(channelValues[chIdx])) continue
        
        channelPositions.push([x, y])
        selectedValues.push(channelValues[chIdx])
        validChannelCount++
      }
      
      console.log(`[约束逻辑] 传统通道数据: ${validChannelCount} 有效`)
    }
    
    // 确保有足够的数据点
    if (channelPositions.length < 3) {
      console.warn('数据点太少，无法创建热力图')
      return { gridData: [], extent: [-1, 1, -1, 1] }
    }
    
    // Phase 2.2: 创建基于真实通道位置的约束范围
    const constraintRadius = GeometryUtils.calculateConstraintRadius(channelPositions, config.radius)
    console.log(`[约束逻辑] 计算约束半径: ${constraintRadius.toFixed(3)}`)
    
    // ULTRATHINK 10.3 根本修复: 中心对称变换，消除对角线偏向
    const xValues = channelPositions.map(pos => pos[0])
    const yValues = channelPositions.map(pos => pos[1])
    const xMin = Math.min(...xValues)
    const xMax = Math.max(...xValues)
    const yMin = Math.min(...yValues)
    const yMax = Math.max(...yValues)
    
    // ULTRATHINK第七次修复: 策略C - X/Y独立缩放 - 消除坐标空间扭曲根源
    const maxAbsX = Math.max(Math.abs(xMin), Math.abs(xMax))
    const maxAbsY = Math.max(Math.abs(yMin), Math.abs(yMax))
    
    // 关键修复: 使用原点(0,0)作为变换中心，避免偏向
    const xCenter = 0  // 强制使用原点，消除偏向根源
    const yCenter = 0  // 强制使用原点，消除偏向根源
    
    console.log(`[独立缩放] 原始边界: X(${xMin.toFixed(1)}, ${xMax.toFixed(1)}), Y(${yMin.toFixed(1)}, ${yMax.toFixed(1)})`)
    console.log(`[独立缩放] X范围: ±${maxAbsX.toFixed(1)}, Y范围: ±${maxAbsY.toFixed(1)}`)
    
    // 防止除零错误
    if (maxAbsX < 1e-10 || maxAbsY < 1e-10) {
      console.warn('数据点范围太小，使用默认缩放')
      return { gridData: [], extent: [-1, 1, -1, 1] }
    }
    
    // 缩放因子详细日志和保底策略
    const safetyMargin = 1.2
    const originalScaleX = safetyMargin * constraintRadius / maxAbsX  // X维度独立缩放
    const originalScaleY = safetyMargin * constraintRadius / maxAbsY  // Y维度独立缩放
    
    // 保底缩放策略实施
    let minScale, maxScale
    if (config.minScaleGuard) {
      // 启用保底模式：更宽松的缩放范围
      minScale = 0.05   // 保底最小缩放因子
      maxScale = 0.75   // 保底最大缩放因子
      if (config.scaleDebugMode) {
        console.log(`[SCALE-DEBUG] 保底模式启用: 缩放范围 [${minScale}, ${maxScale}]`)
      }
    } else {
      // 默认模式：严格的缩放范围
      minScale = 0.15   // 默认最小缩放因子
      maxScale = 0.50   // 默认最大缩放因子
    }
    
    // 详细缩放调试信息
    if (config.scaleDebugMode) {
      console.log(`[SCALE-DEBUG] 缩放因子计算:`)
      console.log(`[SCALE-DEBUG]   原始X缩放: ${originalScaleX.toFixed(6)} (约束半径=${constraintRadius.toFixed(3)}, maxAbsX=${maxAbsX.toFixed(3)})`)
      console.log(`[SCALE-DEBUG]   原始Y缩放: ${originalScaleY.toFixed(6)} (约束半径=${constraintRadius.toFixed(3)}, maxAbsY=${maxAbsY.toFixed(3)})`)
      console.log(`[SCALE-DEBUG]   允许范围: [${minScale}, ${maxScale}]`)
    }
    
    // 实施缩放因子约束和调试
    const constrainedScaleX = Math.max(minScale, Math.min(maxScale, originalScaleX))
    const constrainedScaleY = Math.max(minScale, Math.min(maxScale, originalScaleY))
    
    // 缩放结果详细日志
    if (config.scaleDebugMode) {
      console.log(`[SCALE-DEBUG] 缩放结果:`)
      console.log(`[SCALE-DEBUG]   X: ${originalScaleX.toFixed(6)} → ${constrainedScaleX.toFixed(6)} (被约束: ${originalScaleX !== constrainedScaleX})`)
      console.log(`[SCALE-DEBUG]   Y: ${originalScaleY.toFixed(6)} → ${constrainedScaleY.toFixed(6)} (被约束: ${originalScaleY !== constrainedScaleY})`)
      console.log(`[SCALE-DEBUG]   缩放比例差异: ${Math.abs(constrainedScaleX - constrainedScaleY).toFixed(6)}`)
      
      // 缩放策略诊断
      const isXClamped = originalScaleX !== constrainedScaleX
      const isYClamped = originalScaleY !== constrainedScaleY
      const scaleDifference = Math.abs(constrainedScaleX - constrainedScaleY)
      
      if (isXClamped || isYClamped) {
        console.log(`[SCALE-DEBUG] 警告: 缩放因子被约束! X被约束=${isXClamped}, Y被约束=${isYClamped}`)
      }
      
      if (scaleDifference > 0.05) {
        console.log(`[SCALE-DEBUG] 警告: X/Y缩放差异较大 (${scaleDifference.toFixed(6)}), 可能影响对角线对称性`)
      }
    }
    
    // 独立位置变换: X和Y维度使用各自的缩放因子
    const adjustedPositions = channelPositions.map(pos => {
      // ULTRATHINK关键修复: 使用独立缩放因子，消除坐标空间扭曲
      const scaledX = pos[0] * constrainedScaleX  // X维度独立缩放
      const scaledY = pos[1] * constrainedScaleY  // Y维度独立缩放
      
      return [
        scaledX,   // X坐标使用独立缩放
        -scaledY   // Y坐标使用独立缩放且翻转
      ]
    })
    
    console.log(`[独立缩放] 变换完成: 中心(${xCenter}, ${yCenter})`)
    console.log(`[独立缩放] X缩放=${constrainedScaleX.toFixed(6)}, Y缩放=${constrainedScaleY.toFixed(6)}`)
    console.log(`[独立缩放] 前3个独立位置:`, adjustedPositions.slice(0, 3).map(pos => `(${pos[0].toFixed(3)},${pos[1].toFixed(3)})`).join(' '))
    
    // 确保所有点都在圆内
    const distances = adjustedPositions.map(pos => 
      Math.sqrt(pos[0] * pos[0] + pos[1] * pos[1])
    )
    
    // 缩放因子保底策略检查
    const maxDistance = Math.max(...distances)
    const scalingThreshold = config.radius * 0.95
    
    if (config.scaleDebugMode) {
      console.log(`[SCALE-DEBUG] 第二次变换检查:`)
      console.log(`[SCALE-DEBUG]   最大距离: ${maxDistance.toFixed(4)}, 阈值: ${scalingThreshold.toFixed(4)}`)
      console.log(`[SCALE-DEBUG]   需要第二次变换: ${maxDistance > scalingThreshold}`)
    }
    
    if (maxDistance > scalingThreshold) {
      // 保底策略实施 - 第二次缩放
      let scaleFactor = (scalingThreshold / maxDistance)
      
      if (config.scaleDebugMode) {
        console.log(`[SCALE-DEBUG] 执行第二次变换! 缩放因子=${scaleFactor.toFixed(6)}`)
      }
      
      // 检查缩放因子是否过小(可能导致可视性问题)
      if (config.minScaleGuard && scaleFactor < 0.3) {
        if (config.scaleDebugMode) {
          console.log(`[SCALE-DEBUG] 警告: 第二次缩放因子过小 (${scaleFactor.toFixed(6)}), 使用保底值 0.3`)
        }
        scaleFactor = 0.3  // 保底策略
      }
      
      // 直接对第一次变换的结果进行等比例缩放
      for (let i = 0; i < adjustedPositions.length; i++) {
        adjustedPositions[i][0] *= scaleFactor
        adjustedPositions[i][1] *= scaleFactor
      }
      
      if (config.scaleDebugMode) {
        console.log(`[SCALE-DEBUG] 第二次变换完成，保持分布对称性`)
      }
    } else {
      if (config.scaleDebugMode) {
        console.log(`[SCALE-DEBUG] 跳过第二次变换，使用第一次变换结果`)
      }
    }
    
    // 创建凸包
    let hull = GeometryUtils.createConvexHull(adjustedPositions)
    
    // 如果凸包创建失败，使用所有点
    if (!hull || hull.length < 3) {
      hull = adjustedPositions
    }
    
    // 扩展凸包 - 更积极的扩展以铺满区域
    const expandedHull = GeometryUtils.expandConvexHull(hull, 1.15)  // 收敛扩展到1.15，减少越界
    
    console.log(`[饱满度优化] 凸包扩展: 1.4倍, 原始顶点: ${hull.length}, 约束半径: ${constraintRadius.toFixed(3)}`)
    
    // 创建网格
    let gridData = []
    const xStep = 2 / config.gridSize
    const yStep = 2 / config.gridSize
    
    // 创建网格点 - ULTRATHINK第四次修复: 修正网格坐标映射消除对角线偏向
    // 修改为传统二维数组约定: i控制y(行), j控制x(列)
    console.log('🔬 ULTRATHINK调试: HeatmapCore网格生成开始，验证坐标修复是否生效')
    let debugPointCount = 0
    for (let i = 0; i < config.gridSize; i++) {
      for (let j = 0; j < config.gridSize; j++) {
        const x = -1 + j * xStep + xStep / 2  // j控制x坐标（列）
        const y = -1 + i * yStep + yStep / 2  // i控制y坐标（行）
        
        // 添加前5个点的调试信息
        if (debugPointCount < 5) {
          console.log(`🔬 ULTRATHINK调试: 网格点${debugPointCount} - i=${i}(控制y), j=${j}(控制x) → x=${x.toFixed(4)}, y=${y.toFixed(4)}`)
          debugPointCount++
        }
        
        // 🔬 ULTRATHINK测试: 临时移除所有约束条件验证假设
        // 约束1: 大脑轮廓检查 - 临时禁用
        // if (!GeometryUtils.isPointInBrainContour(x, y)) continue
        
        // 约束2: 约束半径检查 - 临时禁用  
        // const distanceFromCenter = Math.sqrt(x * x + y * y)
        // if (distanceFromCenter > constraintRadius) continue
        
        // 约束3: 凸包检查 - 临时禁用
        // if (!GeometryUtils.isPointInPolygon([x, y], expandedHull)) continue
        
        // 限制调试输出，只显示前5个通过的点
        if (gridData.length < 5) {
          console.log(`🔬 测试点${gridData.length}通过: x=${x.toFixed(3)}, y=${y.toFixed(3)}`)
        }
        
        // Phase 2.2: 优化距离约束 - 更宽松的插值范围以铺满区域
        const minDistanceToChannel = Math.min(...adjustedPositions.map(pos => 
          Math.sqrt(Math.pow(x - pos[0], 2) + Math.pow(y - pos[1], 2))
        ))
        
        // 用户反馈重构: 移除所有距离限制，让热力图真正铺满用户标记的红框区域
        // 不再检查minDistanceToChannel，允许所有在大脑轮廓内的点参与插值
        
        // 使用反距离加权插值计算该点的值
        let weightedSum = 0
        let weightSum = 0
        
        for (let k = 0; k < adjustedPositions.length; k++) {
          const dx = x - adjustedPositions[k][0]
          const dy = y - adjustedPositions[k][1]
          const distance = Math.sqrt(dx * dx + dy * dy)
          
          // 避免除以零
          if (distance < 1e-10) {
            weightedSum = selectedValues[k]
            weightSum = 1
            break
          }
          
          // 参数化IDW权重计算 - 治理对角线偏向
          const weight = 1 / Math.pow(distance, config.idwPower)
          weightedSum += selectedValues[k] * weight
          weightSum += weight
        }
        
        // 计算该点的插值值
        const value = weightSum > 0 ? weightedSum / weightSum : 0
        
        // 添加到网格数据（使用网格索引，TrainingView期望这种格式）
        gridData.push([i, j, value])
        
        // 调试前几个有效的gridData点
        if (gridData.length <= 3) {
          console.log(`🔬 ULTRATHINK调试: gridData[${gridData.length-1}] = [${i}, ${j}, ${value.toExponential(3)}] (i=y_index, j=x_index)`)
        }
      }
    }
    
    // 生成二维网格后做高斯滤波处理
    if (gridData.length > 0) {
      const originalCount = gridData.length
      
      // 转换gridData为二维网格格式
      const grid = Array(config.gridSize).fill().map(() => Array(config.gridSize).fill(NaN))
      
      // 填充二维网格
      for (const [i, j, value] of gridData) {
        if (i >= 0 && i < config.gridSize && j >= 0 && j < config.gridSize) {
          grid[i][j] = value
        }
      }
      
      // 参数化高斯滤波 - 治理对角线偏向
      const filteredGrid = ImageFilters.gaussianFilter(grid, config.gaussianSigma)
      
      // 转换回gridData格式，保持NaN处理与掩码一致
      gridData = []
      for (let i = 0; i < config.gridSize; i++) {
        for (let j = 0; j < config.gridSize; j++) {
          if (!isNaN(filteredGrid[i][j])) {
            gridData.push([i, j, filteredGrid[i][j]])
          }
        }
      }
      
      console.log(`[高斯滤波] 滤波前: ${originalCount} 点，滤波后: ${gridData.length} 点`)
    }
    
    return {
      gridData: gridData,
      extent: [-1, 1, -1, 1]
    }
  }
}