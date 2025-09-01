/**
 * D3热力图渲染器
 * 基于D3.js和d3-contour实现IDW插值热力图
 * 使用自然扩散边界，无强制形状约束
 */

import * as d3 from 'd3'

export class D3HeatmapRenderer {
  constructor(container, config = {}) {
    this.container = container
    this.config = {
      // 通道级清晰显示设置（用户优化方案）
      gridSize: 60,        // 保留兼容性
      canvasScale: 0.6,    // Canvas分辨率缩放比例
      influenceRadius: 10, // mm，紧密扩散半径（通道级清晰显示）
      idwPower: 1.2,       // 保留兼容性
      
      // 等高线设置（保留兼容）
      contourLevels: 80,
      
      // 颜色设置 - 动态域将在渲染时更新
      colorScale: d3.scaleSequential(d3.interpolateRdBu).domain([-0.1, 0.1]),
      
      // 调试设置
      showDebugPoints: false,
      enableTransition: true,
      
      ...config
    }

    this.svg = null
    this.channelData = null
    this.layoutBounds = null
    this.currentHboData = null
    
    console.log('[D3HeatmapRenderer] 初始化完成，配置:', this.config)
  }

  /**
   * 初始化渲染容器（Canvas像素级渲染）
   */
  initializeSVG(width, height) {
    // 清理现有元素
    if (this.canvas) {
      this.canvas.remove()
    }
    if (this.svg) {
      this.svg.remove()
    }

    // 创建Canvas元素实现像素级全覆盖
    this.canvas = d3.select(this.container)
      .append('canvas')
      .attr('width', width)
      .attr('height', height)
      .style('position', 'absolute')
      .style('top', 0)
      .style('left', 0)
      .style('border', 'none')
      .style('outline', 'none')
      .style('background', 'transparent')
    
    this.canvasContext = this.canvas.node().getContext('2d')
    this.canvasWidth = width
    this.canvasHeight = height

    console.log('[D3HeatmapRenderer] Canvas容器初始化完成:', { width, height })
  }

  /**
   * 创建渐变定义用于颜色映射
   */
  createGradientDefs() {
    const defs = this.svg.append('defs')

    // 创建用于插值的渐变
    const gradient = defs.append('linearGradient')
      .attr('id', 'heatmap-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '100%').attr('y2', '0%')

    // RdBu颜色映射的关键点
    const colorStops = [
      { offset: '0%', color: '#053061' },   // 深蓝（最负值）
      { offset: '25%', color: '#4393c3' },  // 浅蓝
      { offset: '50%', color: '#f7f7f7' },  // 白色（零值）
      { offset: '75%', color: '#d6604d' },  // 浅红  
      { offset: '100%', color: '#67001f' }  // 深红（最正值）
    ]

    colorStops.forEach(stop => {
      gradient.append('stop')
        .attr('offset', stop.offset)
        .attr('stop-color', stop.color)
    })
  }

  /**
   * 设置通道数据
   */
  setChannelData(channelData) {
    this.channelData = channelData
    this.layoutBounds = channelData.layoutDimensions
    console.log('[D3HeatmapRenderer] 通道数据已设置:', {
      channels: channelData.totalChannels,
      bounds: this.layoutBounds
    })
  }

  /**
   * 计算IDW插值值
   */
  calculateIDWValue(targetPoint, channelPositions, hboValues, influenceRadius) {
    let weightedSum = 0
    let weightSum = 0

    for (let i = 0; i < channelPositions.length; i++) {
      const channelPos = channelPositions[i].position
      const value = hboValues[i]

      if (value === null || value === undefined || isNaN(value)) continue

      // 计算距离
      const dx = targetPoint[0] - channelPos[0]
      const dy = targetPoint[1] - channelPos[1]  
      const distance = Math.sqrt(dx * dx + dy * dy)

      // 影响半径控制
      if (distance > influenceRadius) continue

      // 避免除零
      if (distance < 0.1) {
        return value
      }

      // IDW权重计算
      const weight = 1 / Math.pow(distance, this.config.idwPower)
      weightedSum += value * weight
      weightSum += weight
    }

    // 如果没有有效的影响点，返回null（透明）
    return weightSum > 0 ? weightedSum / weightSum : null
  }

  /**
   * 生成插值网格数据
   */
  generateGridData(hboValues) {
    if (!this.channelData || !hboValues) {
      console.warn('[D3HeatmapRenderer] 缺少必要数据')
      return null
    }

    const { channelPositions } = this.channelData
    const { gridSize, influenceRadius } = this.config
    const { x: maxX, y: maxY } = this.layoutBounds

    const gridData = []
    const stepX = maxX / gridSize
    const stepY = maxY / gridSize

    console.log('[D3HeatmapRenderer] 开始生成网格数据...', {
      gridSize,
      influenceRadius,
      channels: channelPositions.length,
      hboCount: hboValues.length
    })

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        // Triangle坐标系中的网格点位置
        const triangleX = j * stepX + stepX / 2
        const triangleY = i * stepY + stepY / 2

        // 计算IDW插值值
        const value = this.calculateIDWValue(
          [triangleX, triangleY],
          channelPositions,
          hboValues,
          influenceRadius
        )

        // 只添加有有效值的网格点
        if (value !== null) {
          gridData.push({
            x: triangleX,
            y: triangleY, 
            value: value,
            i: i,
            j: j
          })
        }
      }
    }

    console.log('[D3HeatmapRenderer] 网格数据生成完成:', `${gridData.length}个有效点`)
    return gridData
  }

  /**
   * 使用d3.contours生成等高线
   */
  generateContours(gridData) {
    if (!gridData || gridData.length === 0) {
      return []
    }

    const { gridSize } = this.config
    
    // 创建密集网格用于等高线生成
    const denseGrid = new Array(gridSize * gridSize).fill(0)
    
    // 填充网格数据
    gridData.forEach(point => {
      const index = point.i * gridSize + point.j
      if (index >= 0 && index < denseGrid.length) {
        denseGrid[index] = point.value
      }
    })

    // 计算数据范围用于等高线层级和自适应颜色映射
    const validValues = gridData.map(d => d.value).filter(v => !isNaN(v))
    const minValue = Math.min(...validValues)
    const maxValue = Math.max(...validValues)
    const valueRange = Math.max(Math.abs(minValue), Math.abs(maxValue))
    
    // 更新颜色映射域以适应实际数据范围
    this.config.colorScale.domain([-valueRange, valueRange])

    console.log('[D3HeatmapRenderer] 数据范围:', { minValue, maxValue, valueRange })
    console.log('[D3HeatmapRenderer] 颜色映射域已更新:', this.config.colorScale.domain())

    // 生成等高线层级
    const contourLevels = d3.range(
      -valueRange, 
      valueRange + valueRange / this.config.contourLevels, 
      (2 * valueRange) / this.config.contourLevels
    )

    // 使用d3.contours生成等高线
    const contours = d3.contours()
      .size([gridSize, gridSize])
      .thresholds(contourLevels)

    const contourData = contours(denseGrid)

    console.log('[D3HeatmapRenderer] 等高线生成完成:', `${contourData.length}条等高线`)
    return contourData
  }

  /**
   * 渲染热力图（优化的通道级渐变扩散方法）
   */
  render(hboValues) {
    if (!this.canvas || !this.channelData) {
      console.warn('[D3HeatmapRenderer] Canvas或通道数据未准备就绪')
      return
    }

    this.currentHboData = hboValues
    
    // 清空画布
    this.canvasContext.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
    
    // 计算数据范围
    const validValues = hboValues.filter(v => v !== null && v !== undefined && !isNaN(v))
    if (validValues.length === 0) return
    
    const minValue = Math.min(...validValues)
    const maxValue = Math.max(...validValues)
    const valueRange = Math.max(Math.abs(minValue), Math.abs(maxValue))
    
    console.log('[D3HeatmapRenderer] 开始通道级渐变渲染，数据范围:', { minValue, maxValue, valueRange })
    
    // 使用通道级渐变扩散渲染
    this.renderChannelGradients(hboValues, valueRange)
    
    console.log('[D3HeatmapRenderer] 通道级渲染完成')
  }

  /**
   * 通道级渐变扩散渲染（计算量优化方案）
   */
  renderChannelGradients(hboValues, valueRange) {
    const { channelPositions } = this.channelData
    const { influenceRadius } = this.config
    
    // 设置全局不透明度（通道级清晰显示）
    this.canvasContext.globalAlpha = 1.0
    
    // 设置混合模式以实现渐变叠加
    this.canvasContext.globalCompositeOperation = 'source-over'
    
    // 遍历每个通道，绘制渐变扩散
    for (let i = 0; i < channelPositions.length; i++) {
      const value = hboValues[i]
      if (value === null || value === undefined || isNaN(value)) continue
      
      const channelPos = channelPositions[i].position
      
      // 转换为Canvas坐标
      const canvasX = (channelPos[0] / this.layoutBounds.x) * this.canvasWidth
      const canvasY = this.canvasHeight - ((channelPos[1] / this.layoutBounds.y) * this.canvasHeight)
      
      // 计算渐变半径（基于影响半径）
      const gradientRadius = (influenceRadius / this.layoutBounds.x) * this.canvasWidth
      
      // 归一化值
      const normalizedValue = valueRange > 0 ? value / valueRange : 0
      const color = this.valueToColor(normalizedValue)
      
      // 创建径向渐变
      const gradient = this.canvasContext.createRadialGradient(
        canvasX, canvasY, 0,           // 内圆（中心点）
        canvasX, canvasY, gradientRadius // 外圆（扩散边界）
      )
      
      // 通道级清晰显示渐变配置（用户优化方案）
      const centerAlpha = 1.0   // 中心完全不透明（用户要求）
      const midAlpha = 0.8      // 中间层高不透明度
      const edgeAlpha = 0.15    // 边缘轻微透明（用于通道间混合）
      
      gradient.addColorStop(0,   `rgba(${color.r}, ${color.g}, ${color.b}, ${centerAlpha})`)  // 核心完全不透明
      gradient.addColorStop(0.4, `rgba(${color.r}, ${color.g}, ${color.b}, ${midAlpha})`)     // 40%处仍很不透明  
      gradient.addColorStop(0.7, `rgba(${color.r}, ${color.g}, ${color.b}, ${midAlpha * 0.6})`)  // 70%处半透明
      gradient.addColorStop(1.0, `rgba(${color.r}, ${color.g}, ${color.b}, ${edgeAlpha})`)
      
      // 绘制渐变圆
      this.canvasContext.fillStyle = gradient
      this.canvasContext.beginPath()
      this.canvasContext.arc(canvasX, canvasY, gradientRadius, 0, 2 * Math.PI)
      this.canvasContext.fill()
    }
    
    // 重置混合模式
    this.canvasContext.globalCompositeOperation = 'source-over'
  }

  /**
   * 渲染等高线路径
   */
  renderContours(contourData) {
    const { gridSize } = this.config
    const { x: maxX, y: maxY } = this.layoutBounds

    // 坐标转换：网格索引 → Triangle坐标系 → SVG坐标系
    const svgWidth = parseFloat(this.svg.attr('width'))
    const svgHeight = parseFloat(this.svg.attr('height'))

    const scaleX = svgWidth / maxX
    const scaleY = svgHeight / maxY

    // 更新等高线路径
    const paths = this.heatmapGroup
      .selectAll('path.contour')
      .data(contourData, d => d.value)

    // 移除旧路径
    paths.exit().remove()

    // 添加新路径
    const pathsEnter = paths.enter()
      .append('path')
      .attr('class', 'contour')

    // 更新所有路径
    paths.merge(pathsEnter)
      .attr('d', (d) => {
        // 生成SVG路径，包含坐标转换
        const pathGenerator = d3.geoPath().projection({
          stream: function(s) {
            return {
              point: function(x, y) {
                // 网格坐标 → Triangle坐标 → SVG坐标
                const triangleX = (x / gridSize) * maxX
                const triangleY = ((gridSize - 1 - y) / gridSize) * maxY // Y轴翻转
                const svgX = triangleX * scaleX
                const svgY = triangleY * scaleY
                s.point(svgX, svgY)
              },
              lineStart: s.lineStart,
              lineEnd: s.lineEnd,
              polygonStart: s.polygonStart,
              polygonEnd: s.polygonEnd,
              sphere: s.sphere
            }
          }
        })
        return pathGenerator(d)
      })
      .attr('fill', d => this.config.colorScale(d.value))
      .attr('fill-opacity', 0.8)
      .attr('stroke', 'none')
      .attr('stroke-width', 0)
  }

  /**
   * 渲染调试点
   */
  renderDebugPoints(gridData) {
    const svgWidth = parseFloat(this.svg.attr('width'))
    const svgHeight = parseFloat(this.svg.attr('height'))
    const scaleX = svgWidth / this.layoutBounds.x
    const scaleY = svgHeight / this.layoutBounds.y

    const dots = this.debugGroup
      .selectAll('circle.debug-point')
      .data(gridData, d => `${d.x}-${d.y}`)

    dots.exit().remove()

    dots.enter()
      .append('circle')
      .attr('class', 'debug-point')
      .merge(dots)
      .attr('cx', d => d.x * scaleX)
      .attr('cy', d => (this.layoutBounds.y - d.y) * scaleY) // Y轴翻转
      .attr('r', 1)
      .attr('fill', d => this.config.colorScale(d.value))
      .attr('opacity', 0.8)
  }

  /**
   * 将数值转换为颜色（RdBu色彩映射）
   */
  valueToColor(normalizedValue) {
    // 红蓝色彩映射: -1(蓝色) 到 +1(红色)
    const clampedValue = Math.max(-1, Math.min(1, normalizedValue))
    
    if (clampedValue <= -0.5) {
      // 深蓝到浅蓝
      const t = (clampedValue + 1) / 0.5
      return { r: Math.round(5 + t * 62), g: Math.round(48 + t * 99), b: Math.round(97 + t * 100) }
    } else if (clampedValue <= 0) {
      // 浅蓝到白色
      const t = (clampedValue + 0.5) / 0.5
      return { r: Math.round(67 + t * 180), g: Math.round(147 + t * 100), b: Math.round(197 + t * 50) }
    } else if (clampedValue <= 0.5) {
      // 白色到浅红
      const t = clampedValue / 0.5
      return { r: Math.round(247 - t * 33), g: Math.round(247 - t * 151), b: Math.round(247 - t * 170) }
    } else {
      // 浅红到深红
      const t = (clampedValue - 0.5) / 0.5
      return { r: Math.round(214 - t * 111), g: Math.round(96 - t * 96), b: Math.round(77 - t * 46) }
    }
  }

  /**
   * 清理渲柕器
   */
  destroy() {
    if (this.canvas) {
      this.canvas.remove()
      this.canvas = null
    }
    if (this.svg) {
      this.svg.remove()
      this.svg = null
    }
    console.log('[D3HeatmapRenderer] 渲柕器已清理')
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }
    
    // 如果有当前数据，重新渲染
    if (this.currentHboData) {
      this.render(this.currentHboData)
    }
  }

  /**
   * 获取调试信息
   */
  getDebugInfo() {
    return {
      config: this.config,
      hasChannelData: !!this.channelData,
      hasCurrentData: !!this.currentHboData,
      layoutBounds: this.layoutBounds,
      svgSize: this.svg ? {
        width: this.svg.attr('width'),
        height: this.svg.attr('height')
      } : null
    }
  }
}