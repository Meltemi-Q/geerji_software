/**
 * 几何计算工具模块
 * 负责大脑轮廓判定、约束计算、凸包算法等几何相关计算
 */
export class GeometryUtils {
  
  /**
   * 基于真实364个光源-检测器配对，但范围要大，不要太严格
   * 确保热力图能铺满整个大脑图片上的有效区域
   */
  static isPointInBrainContour(x, y) {
    // 基于真实optodes分析的宽松约束范围
    // 真实光源-检测器中点分布: X(-0.718,0.634), Y(-0.445,0.568)
    // 用户要求范围大一点，所以再放宽20%
    
    const xMin = -0.85  // 真实-0.8，再放宽到-0.85
    const xMax = 0.85   // 真实0.734，放宽到0.85对称
    const yMin = -0.65  // 真实-0.545，放宽到-0.65
    const yMax = 0.75   // 真实0.668，放宽到0.75
    
    // 基础矩形检查 - 覆盖整个大脑功能区域
    const inBounds = x >= xMin && x <= xMax && y >= yMin && y <= yMax
    
    if (!inBounds) return false
    
    // 用户要求不要太强约束: 只保留最基本的大脑外形，去掉复杂限制
    // 简单的椭圆外形，但参数很宽松
    const centerX = 0
    const centerY = 0  // 不偏移，居中
    const radiusX = 0.8  // X方向很宽松
    const radiusY = 0.7  // Y方向也很宽松
    
    const ellipseCheck = Math.pow((x - centerX) / radiusX, 2) + Math.pow((y - centerY) / radiusY, 2) <= 1.2  // 1.2倍放宽
    
    // 只要在椭圆内就通过，不再有其他复杂约束
    return ellipseCheck
  }

  /**
   * Phase 2.2: 计算基于通道位置的约束半径 - 优化铺满度
   */
  static calculateConstraintRadius(channelPositions, defaultRadius = 0.35) {
    if (!channelPositions || channelPositions.length === 0) {
      return defaultRadius // 回退到默认半径
    }
    
    // 计算所有通道位置的边界盒
    const xCoords = channelPositions.map(pos => pos[0])
    const yCoords = channelPositions.map(pos => pos[1])
    const xRange = Math.max(...xCoords) - Math.min(...xCoords)
    const yRange = Math.max(...yCoords) - Math.min(...yCoords)
    const maxRange = Math.max(xRange, yRange)
    
    // 计算质心（不是简单平均，考虑数据密度）
    const centerX = (Math.max(...xCoords) + Math.min(...xCoords)) / 2
    const centerY = (Math.max(...yCoords) + Math.min(...yCoords)) / 2
    
    // 计算到质心的距离分布
    const distances = channelPositions.map(pos => 
      Math.sqrt(Math.pow(pos[0] - centerX, 2) + Math.pow(pos[1] - centerY, 2))
    )
    
    // 使用95%分位数而不是最大值，避免离群点过度影响
    distances.sort((a, b) => a - b)
    const percentile95 = distances[Math.floor(distances.length * 0.95)]
    
    // 收敛约束半径上限，减少过度扩展
    const aggressiveRadius = Math.min(
      defaultRadius * 2.0,  // 收敛到200%，减少越界
      percentile95 * 4.0  // 收敛到400%，控制范围
    )
    
    console.log(`[约束半径] 质心: (${centerX.toFixed(2)}, ${centerY.toFixed(2)})`)
    console.log(`[约束半径] 数据范围: ${maxRange.toFixed(3)}, 95%距离: ${percentile95.toFixed(3)}`)
    console.log(`[约束半径] 积极半径: ${aggressiveRadius.toFixed(3)} (vs 默认: ${defaultRadius.toFixed(3)})`)
    
    return aggressiveRadius
  }

  /**
   * 选择合适的通道用于热力图绘制 - 优化全覆盖策略
   */
  static selectChannelsForTopograph(info, targetDistance = 30) {
    if (!info || !info.optodes || !info.pairs) return []
    
    const sources = info.optodes.spos2
    const detectors = info.optodes.dpos2

    // 计算所有通道的距离和位置
    const channelsInfo = []
    for (let chIdx = 0; chIdx < info.pairs.Src.length; chIdx++) {
      const sourceIdx = info.pairs.Src[chIdx] - 1
      const detectorIdx = info.pairs.Det[chIdx] - 1

      // 计算source和detector之间的距离
      const dx = sources[sourceIdx][0] - detectors[detectorIdx][0]
      const dy = sources[sourceIdx][1] - detectors[detectorIdx][1]
      const dz = sources[sourceIdx][2] - detectors[detectorIdx][2]
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

      // 计算通道中点位置
      const x = (sources[sourceIdx][0] + detectors[detectorIdx][0]) / 2
      const y = (sources[sourceIdx][1] + detectors[detectorIdx][1]) / 2

      channelsInfo.push({
        index: chIdx,
        distance: distance,
        position: [x, y],
        source: sourceIdx,
        detector: detectorIdx
      })
    }

    console.log(`[通道选择] 总通道数: ${channelsInfo.length}, 目标距离: ${targetDistance}mm`)

    // 优化策略：选择更多通道以实现全覆盖
    // 1) 优先选择接近 targetDistance 的通道（默认 30）
    const primaryChannels = channelsInfo.filter(ch => Math.abs(ch.distance - targetDistance) <= 10)
    
    // 2) 回退策略：若过少，则不限定距离，使用所有通道参与后续空间均匀子采样
    const fallbackChannels = channelsInfo
    
    // 3) 选择候选集
    const candidateChannels = primaryChannels.length >= 5 ? primaryChannels : fallbackChannels
    
    console.log(`[通道选择] 候选通道: ${candidateChannels.length} (主要: ${primaryChannels.length}, 备用: ${fallbackChannels.length})`)

    // 3. 按空间分布选择，确保覆盖所有区域
    const selectedChannels = []
    const usedPositions = []
    const positionThreshold = 8 // 减少重叠阈值，允许更密集分布

    // 按距离目标值的接近程度排序
    candidateChannels.sort((a, b) => Math.abs(a.distance - targetDistance) - Math.abs(b.distance - targetDistance))

    for (const channel of candidateChannels) {
      // 检查空间重叠
      let isOverlapping = false
      for (const usedPos of usedPositions) {
        const dx = channel.position[0] - usedPos[0]
        const dy = channel.position[1] - usedPos[1]
        if (Math.sqrt(dx * dx + dy * dy) < positionThreshold) {
          isOverlapping = true
          break
        }
      }

      if (!isOverlapping) {
        selectedChannels.push(channel.index)
        usedPositions.push(channel.position)
      }
      
      // 选择数量上限：保证渲染性能，同时确保一定密度
      if (selectedChannels.length >= 96) break
    }
    
    console.log(`[通道选择] 最终选择: ${selectedChannels.length} 个通道，覆盖面积优化`)

    return selectedChannels
  }

  /**
   * 判断点是否在多边形内
   */
  static isPointInPolygon(point, polygon) {
    if (!polygon || polygon.length < 3) return false
    
    let inside = false
    const x = point[0]
    const y = point[1]
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0]
      const yi = polygon[i][1]
      const xj = polygon[j][0]
      const yj = polygon[j][1]
      
      const intersect = ((yi > y) !== (yj > y)) &&
          (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
      if (intersect) inside = !inside
    }
    
    return inside
  }

  /**
   * 计算凸包（Graham扫描算法）
   */
  static createConvexHull(points) {
    if (!points || points.length < 3) return points || []
    
    // 找到y坐标最小的点（如果有多个，取x最小的）
    let minYIdx = 0
    for (let i = 1; i < points.length; i++) {
      if (points[i][1] < points[minYIdx][1] || 
          (points[i][1] === points[minYIdx][1] && points[i][0] < points[minYIdx][0])) {
        minYIdx = i
      }
    }
    
    // 将最低点放到第一位
    const temp = [...points[minYIdx]]
    points[minYIdx] = [...points[0]]
    points[0] = temp
    
    // 按照相对于最低点的极角排序
    const pivot = points[0]
    const sortedPoints = points.slice(1).sort((a, b) => {
      const angleA = Math.atan2(a[1] - pivot[1], a[0] - pivot[0])
      const angleB = Math.atan2(b[1] - pivot[1], b[0] - pivot[0])
      if (angleA === angleB) {
        // 如果角度相同，按距离排序
        const distA = Math.sqrt(Math.pow(a[0] - pivot[0], 2) + Math.pow(a[1] - pivot[1], 2))
        const distB = Math.sqrt(Math.pow(b[0] - pivot[0], 2) + Math.pow(b[1] - pivot[1], 2))
        return distA - distB
      }
      return angleA - angleB
    })
    
    // 重新组合点集
    const orderedPoints = [pivot, ...sortedPoints]
    
    // Graham扫描
    const hull = [orderedPoints[0], orderedPoints[1]]
    
    for (let i = 2; i < orderedPoints.length; i++) {
      while (hull.length > 1) {
        const n = hull.length
        const o1 = hull[n - 2]
        const o2 = hull[n - 1]
        const o3 = orderedPoints[i]
        
        // 计算叉积，判断是否是左转
        const cross = (o2[0] - o1[0]) * (o3[1] - o1[1]) - (o2[1] - o1[1]) * (o3[0] - o1[0])
        
        if (cross <= 0) {
          hull.pop() // 不是左转，弹出最后一个点
        } else {
          break
        }
      }
      hull.push(orderedPoints[i])
    }
    
    return hull
  }

  /**
   * 扩展凸包
   */
  static expandConvexHull(hull, expansionFactor = 1.1) {
    if (!hull || hull.length < 3) return hull || []
    
    // 计算凸包的中心点
    const centerX = hull.reduce((sum, point) => sum + point[0], 0) / hull.length
    const centerY = hull.reduce((sum, point) => sum + point[1], 0) / hull.length
    
    // 从中心点向外扩展每个顶点
    return hull.map(point => {
      const dx = point[0] - centerX
      const dy = point[1] - centerY
      return [
        centerX + dx * expansionFactor,
        centerY + dy * expansionFactor
      ]
    })
  }
}