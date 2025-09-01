/**
 * 医疗级fNIRS热力图渲染器
 * 基于extra_tool中的Python专业热力图功能，移植到JavaScript
 * 支持多种可视化模式：2D、3D、极坐标、自适应定位
 */

import * as d3 from 'd3'
import { HeatmapConfig } from '../HeatmapConfig.js'

export class FNIRSHeatmapRenderer {
  constructor(config = {}) {
    // 合并配置
    this.config = {
      // 基础配置
      interpolationMethod: 'linear', // linear, cubic, rbf
      colorScheme: 'RdBu_r', // 双向：红(正值)→蓝(负值)
      showChannels: true,
      showOptodes: true,
      
      // fNIRS专用配置
      deviceProfile: 'triangle', // triangle, 6node, 12node
      dataType: 'HbO', // HbO, HbR, HbO-HbR
      channelCount: 432, // Triangle: 18源×24检测器=432通道
      
      // 渲染模式
      renderMode: '2d', // 2d, adaptive
      
      // 自适应定位
      adaptivePosition: {
        x: 0.5, // 50%
        y: 0.25, // 25%
        scaleW: 0.75, // 75%
        scaleH: 0.6, // 60%
        opacity: 0.7,
        rotation: 0
      },
      
      // 性能优化
      enableWebGL: false,
      maxChannels: 864, // 432×2(HbO+HbR)
      updateThrottle: 100, // ms
      
      ...config
    }
    
    // 状态管理
    this.triangleLayout = null
    this.channelPositions = null
    this.lastRenderTime = 0
    this.renderCache = new Map()
    
    // 初始化
    this.initializeLayout()
  }
  
  /**
   * 初始化Triangle布局数据
   * 基于extra_tool/heatmap_adaptive_demo.html的解析逻辑
   */
  async initializeLayout() {
    try {
      console.log('[fNIRS热力图] 初始化Triangle布局...')
      
      // 加载Triangle配置（从fnirs_sdk或layout.json）
      const layoutResponse = await fetch('/src/assets/optodes_mapping_data.json')
      const layoutData = await layoutResponse.json()
      
      // 解析Triangle布局
      this.triangleLayout = this.parseTriangleLayout(layoutData)
      
      console.log(`[fNIRS热力图] Triangle布局解析完成:`, {
        sources: this.triangleLayout.sources.length,
        detectors: this.triangleLayout.detectors.length, 
        channels: this.triangleLayout.channels.length
      })
      
    } catch (error) {
      console.warn('[fNIRS热力图] Triangle布局加载失败，使用备用配置:', error)
      this.triangleLayout = this.createFallbackLayout()
    }
  }
  
  /**
   * 解析Triangle布局数据
   * 移植自extra_tool/correct_864_channel_heatmap.py的逻辑
   */
  parseTriangleLayout(layoutData) {
    const sources = []
    const detectors = []
    const channels = []
    
    let sourceId = 0
    let detectorId = 0
    
    // 从rawData.docks中提取光源和检测器
    if (layoutData.rawData && layoutData.rawData.docks) {
      layoutData.rawData.docks.forEach(dock => {
        if (dock.optodes && Array.isArray(dock.optodes)) {
          dock.optodes.forEach(optode => {
            const coords2d = optode.coordinates_2d
            const coords3d = optode.coordinates_3d
            
            // 判断是光源还是检测器（基于type或命名规则）
            const isSource = optode.type === 'source' || 
                           ['optode_a', 'optode_b', 'optode_c'].includes(optode.optode_id)
            
            if (isSource) {
              sources.push({
                id: sourceId++,
                x: coords2d?.x || 0,
                y: coords2d?.y || 0,
                z: coords3d?.z || 0,
                dock: dock.dock_id,
                optode: optode.optode_id || optode.type
              })
            } else {
              detectors.push({
                id: detectorId++,
                x: coords2d?.x || 0,
                y: coords2d?.y || 0,
                z: coords3d?.z || 0,
                dock: dock.dock_id,
                optode: optode.optode_id || optode.type
              })
            }
          })
        }
      })
    }
    
    // 计算所有光源-检测器对的通道位置（无距离限制）
    sources.forEach(source => {
      detectors.forEach(detector => {
        const channelX = (source.x + detector.x) / 2
        const channelY = (source.y + detector.y) / 2
        const channelZ = (source.z + detector.z) / 2
        const distance = Math.sqrt(
          Math.pow(source.x - detector.x, 2) + 
          Math.pow(source.y - detector.y, 2) + 
          Math.pow(source.z - detector.z, 2)
        )
        
        channels.push({
          sourceId: source.id,
          detectorId: detector.id,
          x: channelX,
          y: channelY,
          z: channelZ,
          distance: distance
        })
      })
    })
    
    return { sources, detectors, channels }
  }
  
  /**
   * 创建备用布局（当Triangle数据加载失败时）
   */
  createFallbackLayout() {
    console.log('[fNIRS热力图] 创建备用Triangle布局...')
    
    const sources = []
    const detectors = []
    const channels = []
    
    // 生成简化的三角形布局
    const centerX = 100
    const centerY = 60
    const radius = 40
    
    // 18个光源（三角形边界）
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * 2 * Math.PI
      sources.push({
        id: i,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        z: 0
      })
    }
    
    // 24个检测器（内部网格）
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * 2 * Math.PI
      const r = radius * 0.6
      detectors.push({
        id: i,
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
        z: 0
      })
    }
    
    // 生成所有通道
    sources.forEach(source => {
      detectors.forEach(detector => {
        channels.push({
          sourceId: source.id,
          detectorId: detector.id,
          x: (source.x + detector.x) / 2,
          y: (source.y + detector.y) / 2,
          z: (source.z + detector.z) / 2,
          distance: Math.sqrt(
            Math.pow(source.x - detector.x, 2) + 
            Math.pow(source.y - detector.y, 2)
          )
        })
      })
    })
    
    console.log(`[fNIRS热力图] 备用布局创建完成: ${sources.length}光源, ${detectors.length}检测器, ${channels.length}通道`)
    return { sources, detectors, channels }
  }
  
  /**
   * 渲染fNIRS热力图
   * 主要渲染入口，支持多种模式
   */
  async renderHeatmap(container, channelData, options = {}) {
    if (!this.triangleLayout) {
      console.warn('[fNIRS热力图] Triangle布局未初始化，等待加载...')
      await this.initializeLayout()
    }
    
    const renderOptions = { ...this.config, ...options }
    
    // 性能检查：限制更新频率
    const now = Date.now()
    if (now - this.lastRenderTime < renderOptions.updateThrottle) {
      return
    }
    this.lastRenderTime = now
    
    console.log(`[fNIRS热力图] 开始渲染 - 模式: ${renderOptions.renderMode}, 通道数: ${channelData.length}`)
    
    // 数据预处理
    const processedData = this.preprocessChannelData(channelData, renderOptions)
    
    // 根据渲染模式选择渲染方法
    switch (renderOptions.renderMode) {
      case '2d':
        return this.render2DHeatmap(container, processedData, renderOptions)
      case 'adaptive':
        return this.renderAdaptiveHeatmap(container, processedData, renderOptions)
      default:
        console.warn(`[fNIRS热力图] 未知渲染模式: ${renderOptions.renderMode}，使用2D模式`)
        return this.render2DHeatmap(container, processedData, renderOptions)
    }
  }
  
  /**
   * 数据预处理
   * 处理864通道数据：432空间×2指标(HbO+HbR)
   */
  preprocessChannelData(channelData, options) {
    if (!channelData || channelData.length === 0) {
      console.warn('[fNIRS热力图] 通道数据为空')
      return []
    }
    
    const channels = this.triangleLayout.channels
    
    // 如果是864通道数据（432×2），需要分离HbO和HbR
    if (channelData.length === 864 && channels.length === 432) {
      const hboData = []
      const hbrData = []
      
      for (let i = 0; i < 432; i++) {
        hboData.push(channelData[i * 2])     // 偶数索引：HbO
        hbrData.push(channelData[i * 2 + 1]) // 奇数索引：HbR
      }
      
      // 根据数据类型选择要渲染的数据
      let selectedData
      switch (options.dataType) {
        case 'HbO':
          selectedData = hboData
          break
        case 'HbR':
          selectedData = hbrData
          break
        case 'HbO-HbR':
          selectedData = hboData.map((hbo, i) => hbo - hbrData[i])
          break
        default:
          selectedData = hboData
      }
      
      console.log(`[fNIRS热力图] 数据预处理完成 - ${options.dataType}: ${selectedData.length}通道`)
      return selectedData
      
    } else if (channelData.length === channels.length) {
      // 直接匹配通道数，无需预处理
      return channelData
    } else {
      console.warn(`[fNIRS热力图] 数据长度不匹配: 期望${channels.length}或864，实际${channelData.length}`)
      return channelData.slice(0, Math.min(channelData.length, channels.length))
    }
  }
  
  /**
   * 渲染2D热力图
   * 移植自fnirs_channel_heatmap.py的_plot_2d_heatmap功能
   */
  render2DHeatmap(container, channelData, options) {
    console.log('[fNIRS热力图] 渲染2D热力图...')
    
    if (!container || channelData.length === 0) return
    
    // 清空容器
    d3.select(container).selectAll('*').remove()
    
    // 获取通道位置
    const channels = this.triangleLayout.channels.slice(0, channelData.length)
    
    // 计算布局边界
    const xExtent = d3.extent(channels, d => d.x)
    const yExtent = d3.extent(channels, d => d.y)
    const valueExtent = d3.extent(channelData)
    
    // 创建SVG
    const containerRect = container.getBoundingClientRect()
    const width = containerRect.width || 400
    const height = containerRect.height || 300
    
    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
    
    // 创建比例尺
    const xScale = d3.scaleLinear()
      .domain(xExtent)
      .range([50, width - 50])
    
    const yScale = d3.scaleLinear()
      .domain(yExtent)
      .range([height - 50, 50])
    
    // 创建颜色比例尺（双向：红正蓝负）
    const colorScale = d3.scaleSequential()
      .domain(valueExtent)
      .interpolator(d3.interpolateRdBu)
      .clamp(true)
    
    // 创建插值网格（简化版本）
    const gridSize = 50
    const gridData = []
    
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const x = d3.scaleLinear().domain([0, gridSize-1]).range(xExtent)(i)
        const y = d3.scaleLinear().domain([0, gridSize-1]).range(yExtent)(j)
        
        // 简化插值：使用最近邻
        let minDistance = Infinity
        let nearestValue = 0
        
        channels.forEach((channel, index) => {
          const distance = Math.sqrt(
            Math.pow(x - channel.x, 2) + Math.pow(y - channel.y, 2)
          )
          if (distance < minDistance) {
            minDistance = distance
            nearestValue = channelData[index] || 0
          }
        })
        
        gridData.push({
          x: xScale(x),
          y: yScale(y),
          value: nearestValue,
          rawX: x,
          rawY: y
        })
      }
    }
    
    // 渲染网格热力图
    svg.selectAll('.grid-cell')
      .data(gridData)
      .enter()
      .append('rect')
      .attr('class', 'grid-cell')
      .attr('x', d => d.x - width/(gridSize*2))
      .attr('y', d => d.y - height/(gridSize*2))
      .attr('width', width/gridSize)
      .attr('height', height/gridSize)
      .attr('fill', d => colorScale(d.value))
      .attr('opacity', 0.8)
    
    // 渲染通道点
    if (options.showChannels) {
      svg.selectAll('.channel-dot')
        .data(channels)
        .enter()
        .append('circle')
        .attr('class', 'channel-dot')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 3)
        .attr('fill', (d, i) => colorScale(channelData[i] || 0))
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .append('title')
        .text((d, i) => `通道${i+1}: ${(channelData[i] || 0).toFixed(4)}`)
    }
    
    // 渲染光源和检测器
    if (options.showOptodes) {
      // 光源（红色）
      svg.selectAll('.source-dot')
        .data(this.triangleLayout.sources)
        .enter()
        .append('circle')
        .attr('class', 'source-dot')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 4)
        .attr('fill', '#ff4444')
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
        .append('title')
        .text(d => `光源${d.id+1}`)
      
      // 检测器（蓝色）  
      svg.selectAll('.detector-dot')
        .data(this.triangleLayout.detectors)
        .enter()
        .append('circle')
        .attr('class', 'detector-dot')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 3)
        .attr('fill', '#4444ff')
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .append('title')
        .text(d => `检测器${d.id+1}`)
    }
    
    console.log('[fNIRS热力图] 2D热力图渲染完成')
  }
  
  /**
   * 渲染自适应热力图
   * 基于extra_tool/heatmap_adaptive_demo.html的自适应定位功能
   */
  renderAdaptiveHeatmap(container, channelData, options) {
    console.log('[fNIRS热力图] 渲染自适应热力图...')
    
    // 获取自适应配置
    const adaptiveConfig = options.adaptivePosition
    
    // 创建热力图容器
    const heatmapContainer = document.createElement('div')
    heatmapContainer.style.position = 'absolute'
    heatmapContainer.style.pointerEvents = 'none'
    heatmapContainer.style.opacity = adaptiveConfig.opacity
    heatmapContainer.style.transform = `rotate(${adaptiveConfig.rotation}deg)`
    
    // 计算自适应位置（基于父容器）
    const parentRect = container.getBoundingClientRect()
    const heatmapWidth = parentRect.width * adaptiveConfig.scaleW
    const heatmapHeight = parentRect.height * adaptiveConfig.scaleH
    
    const left = parentRect.width * adaptiveConfig.x - heatmapWidth / 2
    const top = parentRect.height * adaptiveConfig.y - heatmapHeight / 2
    
    heatmapContainer.style.left = left + 'px'
    heatmapContainer.style.top = top + 'px'
    heatmapContainer.style.width = heatmapWidth + 'px'
    heatmapContainer.style.height = heatmapHeight + 'px'
    
    // 清空并添加容器
    container.innerHTML = ''
    container.appendChild(heatmapContainer)
    
    // 在自适应容器中渲染2D热力图
    this.render2DHeatmap(heatmapContainer, channelData, options)
    
    console.log(`[fNIRS热力图] 自适应热力图渲染完成 - 位置: ${left.toFixed(1)}, ${top.toFixed(1)}, 尺寸: ${heatmapWidth.toFixed(1)}×${heatmapHeight.toFixed(1)}`)
  }
  
  // 移除3D和极坐标功能，专注于2D渲染
  
  /**
   * 配置自适应位置
   * 从extra_tool/heatmap_adaptive_demo.html移植的配置功能
   */
  setAdaptivePosition(position) {
    this.config.adaptivePosition = { ...this.config.adaptivePosition, ...position }
    console.log('[fNIRS热力图] 自适应位置已更新:', this.config.adaptivePosition)
  }
  
  /**
   * 获取Triangle布局信息
   */
  getLayoutInfo() {
    return this.triangleLayout ? {
      sources: this.triangleLayout.sources.length,
      detectors: this.triangleLayout.detectors.length,
      channels: this.triangleLayout.channels.length,
      maxChannels: this.config.maxChannels
    } : null
  }
  
  /**
   * 销毁渲染器
   */
  destroy() {
    this.renderCache.clear()
    this.triangleLayout = null
    this.channelPositions = null
    console.log('[fNIRS热力图] 渲染器已销毁')
  }
}

export default FNIRSHeatmapRenderer