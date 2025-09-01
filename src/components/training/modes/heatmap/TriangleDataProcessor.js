/**
 * Triangle数据处理器
 * 负责解析Triangle配置和计算通道位置
 * 基于fnirs_sdk的triangle配置格式
 */

export class TriangleDataProcessor {
  constructor() {
    this.triangleConfig = null
    this.channelData = null
    this.layoutDimensions = null
  }

  /**
   * 加载Triangle配置数据
   */
  async loadTriangleConfig() {
    try {
      const response = await fetch('/config/triangle_layout.json')
      if (!response.ok) {
        throw new Error(`Failed to load Triangle config: ${response.status}`)
      }
      
      this.triangleConfig = await response.json()
      this.layoutDimensions = this.triangleConfig.dimensions.dimensions_2d
      
      console.log('[TriangleDataProcessor] 配置加载成功:', {
        dimensions: this.layoutDimensions,
        docks: this.triangleConfig.docks.length
      })
      
      return this.triangleConfig
    } catch (error) {
      console.error('[TriangleDataProcessor] 配置加载失败:', error)
      throw error
    }
  }

  /**
   * 解析Triangle配置，提取光源和检测器位置
   * 完全复制correct_864_channel_heatmap.py的逻辑
   */
  parseTriangleLayout() {
    if (!this.triangleConfig) {
      throw new Error('Triangle配置未加载，请先调用loadTriangleConfig()')
    }

    const sources = []      // 光源列表
    const detectors = []    // 检测器列表
    let sourceCounter = 0
    let detectorCounter = 0

    // 解析每个dock的optodes
    this.triangleConfig.docks.forEach(dock => {
      dock.optodes.forEach(optode => {
        if (!optode.coordinates_2d) return

        const optodeData = {
          id: optode.optode_id,
          dock: dock.dock_id,
          x: optode.coordinates_2d.x,
          y: optode.coordinates_2d.y
        }

        // 根据optode_id分类：光源 vs 检测器
        if (optode.optode_id === 'optode_a' || 
            optode.optode_id === 'optode_b' || 
            optode.optode_id === 'optode_c') {
          // 光源
          optodeData.sourceIndex = sourceCounter++
          sources.push(optodeData)
        } else if (optode.optode_id === 'optode_1' || 
                   optode.optode_id === 'optode_2' ||
                   optode.optode_id === 'optode_3' || 
                   optode.optode_id === 'optode_4') {
          // 检测器
          optodeData.detectorIndex = detectorCounter++
          detectors.push(optodeData)
        }
      })
    })

    console.log(`[TriangleDataProcessor] 解析完成: ${sources.length}光源, ${detectors.length}检测器`)

    return { sources, detectors }
  }

  /**
   * 计算所有光源-检测器对的通道位置
   * 通道位置 = (光源位置 + 检测器位置) / 2
   */
  calculateChannelPositions(sources, detectors) {
    const channelPositions = []
    let channelId = 0

    sources.forEach((source, sourceIdx) => {
      detectors.forEach((detector, detectorIdx) => {
        // 计算通道中点位置（Triangle 2D坐标系，单位：mm）
        const channelX = (source.x + detector.x) / 2
        const channelY = (source.y + detector.y) / 2
        
        // 计算光源-检测器距离
        const distance = Math.sqrt(
          Math.pow(source.x - detector.x, 2) + 
          Math.pow(source.y - detector.y, 2)
        )

        channelPositions.push({
          channelId: channelId++,
          position: [channelX, channelY], // Triangle 2D坐标 (mm)
          sourceIndex: sourceIdx,
          detectorIndex: detectorIdx,
          source: source,
          detector: detector,
          distance: distance
        })
      })
    })

    console.log(`[TriangleDataProcessor] 通道位置计算完成: ${channelPositions.length}个通道`)
    console.log(`[TriangleDataProcessor] 验证: ${sources.length} × ${detectors.length} = ${sources.length * detectors.length}`)
    
    this.channelData = {
      sources,
      detectors,
      channelPositions,
      totalChannels: channelPositions.length,
      layoutDimensions: this.layoutDimensions
    }

    return this.channelData
  }

  /**
   * 完整的数据处理流程
   */
  async processTriangleData() {
    try {
      // 1. 加载配置
      await this.loadTriangleConfig()
      
      // 2. 解析布局
      const { sources, detectors } = this.parseTriangleLayout()
      
      // 3. 计算通道位置
      const channelData = this.calculateChannelPositions(sources, detectors)
      
      console.log('[TriangleDataProcessor] 数据处理完成:', {
        sources: sources.length,
        detectors: detectors.length,
        channels: channelData.totalChannels,
        dimensions: this.layoutDimensions
      })

      return channelData
    } catch (error) {
      console.error('[TriangleDataProcessor] 数据处理失败:', error)
      throw error
    }
  }

  /**
   * 获取布局边界信息
   */
  getLayoutBounds() {
    if (!this.layoutDimensions) {
      return { x: 188.72, y: 110.29 } // 默认尺寸
    }
    return this.layoutDimensions
  }

  /**
   * 验证数据有效性
   */
  validateData() {
    if (!this.channelData) {
      return { isValid: false, error: 'No channel data available' }
    }

    const { sources, detectors, channelPositions } = this.channelData
    const expectedChannels = sources.length * detectors.length

    if (channelPositions.length !== expectedChannels) {
      return { 
        isValid: false, 
        error: `Channel count mismatch: expected ${expectedChannels}, got ${channelPositions.length}` 
      }
    }

    // 检查是否接近标准配置 (18光源 × 24检测器 = 432通道)
    const isStandardConfig = sources.length === 18 && detectors.length === 24

    return {
      isValid: true,
      sources: sources.length,
      detectors: detectors.length,
      channels: channelPositions.length,
      isStandardConfig,
      dimensions: this.layoutDimensions
    }
  }
}