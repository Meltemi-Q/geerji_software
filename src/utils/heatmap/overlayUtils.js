/**
 * 12-node覆盖背景层工具模块
 * 处理从Triangle布局数据创建覆盖多边形，与热力图颜色映射集成
 */

/**
 * 覆盖层管理器
 */
export class OverlayManager {
  constructor(options = {}) {
    this.overlayOpacity = options.overlayOpacity || 0.6
    this.overlayStrokeWidth = options.overlayStrokeWidth || 1.5
    this.overlayEdgeBufferMm = options.overlayEdgeBufferMm || 3
    this.overlayHullType = options.overlayHullType || 'convex' // 'convex' | 'concave'
    this.overlayFollowColorMap = options.overlayFollowColorMap !== false
    
    // 缓存数据
    this.fullLayoutData = null
    this.optodePoints2D = null
    this.cachedPolygon = null
  }

  /**
   * 加载完整的Triangle布局数据
   * @param {string} layoutPath - 布局文件路径
   * @returns {Promise<Object>} 布局数据
   */
  async loadFullLayout(layoutPath = null) {
    if (this.fullLayoutData) return this.fullLayoutData
    
    try {
      // 默认路径指向renumbered_full_layout.json
      const defaultPath = new URL(
        '../../../fnirs_sdk/config/device_profiles/triangle/renumbered_full_layout.json',
        import.meta.url
      ).href
      
      const response = await fetch(layoutPath || defaultPath)
      if (!response.ok) {
        throw new Error(`加载布局文件失败: ${response.status}`)
      }
      
      this.fullLayoutData = await response.json()
      this.optodePoints2D = this._extractOptodePoints2D(this.fullLayoutData)
      
      console.log('[覆盖层] Triangle完整布局加载成功:', {
        docks: this.fullLayoutData.docks?.length || 0,
        optodes: this.optodePoints2D.length,
        dimensions: this.fullLayoutData.dimensions?.dimensions_2d
      })
      
      return this.fullLayoutData
    } catch (error) {
      console.error('[覆盖层] 布局加载失败:', error)
      throw error
    }
  }

  /**
   * 创建覆盖多边形
   * @param {Object} containerBounds - 容器边界信息
   * @param {Object} colorMapManager - 颜色映射管理器（用于获取中心色）
   * @returns {Object} 覆盖多边形数据
   */
  createOverlayPolygon(containerBounds, colorMapManager = null) {
    if (!this.optodePoints2D || this.optodePoints2D.length < 3) {
      console.warn('[覆盖层] optode点数不足，无法创建多边形')
      return null
    }
    
    try {
      // 计算外轮廓
      let hull
      if (this.overlayHullType === 'concave') {
        hull = this._computeConcaveHull(this.optodePoints2D)
      } else {
        hull = this._computeConvexHull(this.optodePoints2D)
      }
      
      // 边缘扩展
      if (this.overlayEdgeBufferMm > 0) {
        hull = this._expandPolygon(hull, this.overlayEdgeBufferMm)
      }
      
      // 坐标转换：Triangle 2D (mm) → 容器像素
      const pixelPolygon = this._transformToPixelCoordinates(hull, containerBounds)
      
      // 获取填充和描边颜色
      const { fillColor, strokeColor } = this._getPolygonColors(colorMapManager)
      
      const overlayData = {
        points: pixelPolygon,
        svgPoints: this._formatSVGPoints(pixelPolygon),
        svgPath: this._formatSVGPath(pixelPolygon),
        style: {
          fill: fillColor,
          stroke: strokeColor,
          strokeWidth: this.overlayStrokeWidth,
          opacity: this.overlayOpacity,
          strokeLinejoin: 'round',
          strokeLinecap: 'round'
        },
        metadata: {
          originalPoints: this.optodePoints2D.length,
          hullPoints: hull.length,
          hullType: this.overlayHullType,
          edgeBuffer: this.overlayEdgeBufferMm
        }
      }
      
      this.cachedPolygon = overlayData
      return overlayData
      
    } catch (error) {
      console.error('[覆盖层] 多边形创建失败:', error)
      return null
    }
  }

  /**
   * 更新多边形颜色（当颜色映射改变时）
   * @param {Object} colorMapManager - 颜色映射管理器
   */
  updatePolygonColors(colorMapManager) {
    if (!this.cachedPolygon) return
    
    const { fillColor, strokeColor } = this._getPolygonColors(colorMapManager)
    this.cachedPolygon.style.fill = fillColor
    this.cachedPolygon.style.stroke = strokeColor
  }

  /**
   * 获取覆盖层统计信息
   * @returns {Object} 统计信息
   */
  getOverlayInfo() {
    if (!this.fullLayoutData || !this.optodePoints2D) return null
    
    return {
      nodeCount: this.fullLayoutData.docks?.length || 0,
      optodeCount: this.optodePoints2D.length,
      dimensions: this.fullLayoutData.dimensions?.dimensions_2d,
      overlayType: this.overlayHullType,
      edgeBuffer: this.overlayEdgeBufferMm
    }
  }

  /**
   * 提取所有optode的2D坐标
   * @private
   */
  _extractOptodePoints2D(layoutData) {
    const points = []
    
    if (!layoutData.docks || !Array.isArray(layoutData.docks)) {
      console.warn('[覆盖层] 无效的docks数据')
      return points
    }
    
    layoutData.docks.forEach((dock, dockIndex) => {
      if (dock.optodes && Array.isArray(dock.optodes)) {
        dock.optodes.forEach((optode, optodeIndex) => {
          if (optode.coordinates_2d) {
            points.push({
              x: optode.coordinates_2d.x,
              y: optode.coordinates_2d.y,
              optodeId: optode.optode_id || `${dockIndex}_${optodeIndex}`,
              dockId: dock.dock_id || `dock_${dockIndex}`
            })
          }
        })
      }
    })
    
    console.log(`[覆盖层] 提取到${points.length}个optode 2D坐标`)
    return points
  }

  /**
   * 计算凸包（Graham扫描算法）
   * @private
   */
  _computeConvexHull(points) {
    if (points.length < 3) return points
    
    const pointArray = points.map(p => [p.x, p.y])
    
    // 找到最下方的点
    let pivot = pointArray[0]
    for (const point of pointArray) {
      if (point[1] < pivot[1] || (point[1] === pivot[1] && point[0] < pivot[0])) {
        pivot = point
      }
    }
    
    // 按极角排序
    const sortedPoints = pointArray
      .filter(p => p !== pivot)
      .sort((a, b) => {
        const angleA = Math.atan2(a[1] - pivot[1], a[0] - pivot[0])
        const angleB = Math.atan2(b[1] - pivot[1], b[0] - pivot[0])
        return angleA - angleB
      })
    
    const hull = [pivot]
    
    for (const point of sortedPoints) {
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
   * 计算凹包（简化版Alpha Shape）
   * @private
   */
  _computeConcaveHull(points, alpha = 1.0) {
    // 简化实现：如果点数较少，直接使用凸包
    if (points.length < 8) {
      return this._computeConvexHull(points)
    }
    
    // TODO: 实现完整的Alpha Shape算法
    // 目前使用改进的凸包作为近似
    const convexHull = this._computeConvexHull(points)
    
    // 简单的凹化处理：在边上添加内部点
    const concaveHull = []
    const pointArray = points.map(p => [p.x, p.y])
    
    for (let i = 0; i < convexHull.length; i++) {
      concaveHull.push(convexHull[i])
      
      const current = convexHull[i]
      const next = convexHull[(i + 1) % convexHull.length]
      
      // 查找边附近的内部点
      const midPoint = [
        (current[0] + next[0]) / 2,
        (current[1] + next[1]) / 2
      ]
      
      let closestInternalPoint = null
      let minDistance = Infinity
      
      for (const point of pointArray) {
        if (point === current || point === next) continue
        
        const distanceToMid = this._calculateDistance(point, midPoint)
        const distanceToEdge = this._pointToLineDistance(point, current, next)
        
        if (distanceToEdge < 10 && distanceToMid < minDistance) {
          minDistance = distanceToMid
          closestInternalPoint = point
        }
      }
      
      if (closestInternalPoint && minDistance < 15) {
        concaveHull.push(closestInternalPoint)
      }
    }
    
    return concaveHull
  }

  /**
   * 扩展多边形
   * @private
   */
  _expandPolygon(polygon, distance) {
    if (distance <= 0) return polygon
    
    const expanded = []
    const n = polygon.length
    
    for (let i = 0; i < n; i++) {
      const prev = polygon[(i - 1 + n) % n]
      const curr = polygon[i]
      const next = polygon[(i + 1) % n]
      
      // 计算两个相邻边的法向量
      const normal1 = this._getNormal(prev, curr)
      const normal2 = this._getNormal(curr, next)
      
      // 平均法向量
      let avgNormal = [
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
   * 坐标转换：Triangle 2D (mm) → 容器像素
   * @private
   */
  _transformToPixelCoordinates(trianglePoints, containerBounds) {
    if (!this.fullLayoutData?.dimensions?.dimensions_2d) {
      console.warn('[覆盖层] 缺少Triangle维度信息')
      return trianglePoints
    }
    
    const triangleDimensions = this.fullLayoutData.dimensions.dimensions_2d
    const scaleX = containerBounds.width / triangleDimensions.x
    const scaleY = containerBounds.height / triangleDimensions.y
    
    // Y轴翻转（Triangle坐标系Y向上，像素坐标系Y向下）
    return trianglePoints.map(point => [
      point[0] * scaleX + containerBounds.left,
      containerBounds.height - (point[1] * scaleY) + containerBounds.top
    ])
  }

  /**
   * 获取多边形颜色
   * @private
   */
  _getPolygonColors(colorMapManager) {
    let fillColor = 'rgba(128, 128, 128, 0.6)' // 默认灰色
    let strokeColor = 'rgba(128, 128, 128, 0.2)'
    
    if (colorMapManager && this.overlayFollowColorMap) {
      try {
        const centerColor = colorMapManager.getCenterColor()
        fillColor = `rgba(${centerColor[0]}, ${centerColor[1]}, ${centerColor[2]}, ${this.overlayOpacity})`
        
        // 描边色：中心色的浅亮变体
        const strokeAlpha = 0.2
        const strokeR = Math.min(255, centerColor[0] + 40)
        const strokeG = Math.min(255, centerColor[1] + 40)
        const strokeB = Math.min(255, centerColor[2] + 40)
        strokeColor = `rgba(${strokeR}, ${strokeG}, ${strokeB}, ${strokeAlpha})`
      } catch (error) {
        console.warn('[覆盖层] 颜色获取失败，使用默认颜色:', error)
      }
    }
    
    return { fillColor, strokeColor }
  }

  /**
   * 格式化为SVG points属性
   * @private
   */
  _formatSVGPoints(pixelPoints) {
    return pixelPoints.map(p => `${p[0]},${p[1]}`).join(' ')
  }

  /**
   * 格式化为SVG path属性
   * @private
   */
  _formatSVGPath(pixelPoints) {
    if (pixelPoints.length === 0) return ''
    
    let path = `M ${pixelPoints[0][0]} ${pixelPoints[0][1]}`
    for (let i = 1; i < pixelPoints.length; i++) {
      path += ` L ${pixelPoints[i][0]} ${pixelPoints[i][1]}`
    }
    path += ' Z'
    return path
  }

  /**
   * 计算两点距离
   * @private
   */
  _calculateDistance(point1, point2) {
    const dx = point1[0] - point2[0]
    const dy = point1[1] - point2[1]
    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * 点到直线距离
   * @private
   */
  _pointToLineDistance(point, lineStart, lineEnd) {
    const A = lineEnd[1] - lineStart[1]
    const B = lineStart[0] - lineEnd[0]
    const C = lineEnd[0] * lineStart[1] - lineStart[0] * lineEnd[1]
    
    const distance = Math.abs(A * point[0] + B * point[1] + C) / 
                    Math.sqrt(A * A + B * B)
    
    return distance
  }

  /**
   * 计算法向量
   * @private
   */
  _getNormal(p1, p2) {
    const dx = p2[0] - p1[0]
    const dy = p2[1] - p1[1]
    const length = Math.sqrt(dx * dx + dy * dy)
    
    if (length === 0) return [0, 0]
    
    return [-dy / length, dx / length] // 左法向量
  }

  /**
   * 计算叉积
   * @private
   */
  _crossProduct(o, a, b) {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  }
}

/**
 * ECharts覆盖层集成工具
 */
export class EChartsOverlayIntegrator {
  /**
   * 将覆盖多边形添加到ECharts配置中
   * @param {Object} echartsOption - ECharts配置对象
   * @param {Object} overlayData - 覆盖层数据
   * @param {Object} options - 集成选项
   * @returns {Object} 更新后的ECharts配置
   */
  static addOverlayToECharts(echartsOption, overlayData, options = {}) {
    if (!overlayData || !overlayData.points) return echartsOption
    
    const { zLevel = 1, seriesIndex = 0 } = options
    
    // 创建多边形系列
    const polygonSeries = {
      type: 'custom',
      name: '12-node覆盖层',
      data: [overlayData],
      renderItem: (params, api) => {
        const points = params.value.points
        const style = params.value.style
        
        return {
          type: 'polygon',
          shape: {
            points: points.map(p => api.coord(p))
          },
          style: {
            fill: style.fill,
            stroke: style.stroke,
            lineWidth: style.strokeWidth,
            opacity: style.opacity,
            lineJoin: style.strokeLinejoin,
            lineCap: style.strokeLinecap
          }
        }
      },
      z: zLevel,
      silent: true // 不响应交互
    }
    
    // 插入到指定位置
    const series = [...(echartsOption.series || [])]
    series.splice(seriesIndex, 0, polygonSeries)
    
    return {
      ...echartsOption,
      series
    }
  }

  /**
   * 为SVG/Canvas直接渲染格式化覆盖层
   * @param {Object} overlayData - 覆盖层数据
   * @param {Object} options - 格式化选项
   * @returns {Object} 格式化后的渲染数据
   */
  static formatForDirectRender(overlayData, options = {}) {
    if (!overlayData) return null
    
    const { format = 'svg' } = options
    
    if (format === 'svg') {
      return {
        tagName: 'polygon',
        attributes: {
          points: overlayData.svgPoints,
          fill: overlayData.style.fill,
          stroke: overlayData.style.stroke,
          'stroke-width': overlayData.style.strokeWidth,
          opacity: overlayData.style.opacity,
          'stroke-linejoin': overlayData.style.strokeLinejoin,
          'stroke-linecap': overlayData.style.strokeLinecap
        }
      }
    } else if (format === 'canvas') {
      return {
        type: 'polygon',
        points: overlayData.points,
        style: overlayData.style
      }
    }
    
    return overlayData
  }
}