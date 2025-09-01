/**
 * Triangle数据处理器测试脚本
 * 用于验证数据解析功能
 */

import { TriangleDataProcessor } from './TriangleDataProcessor.js'

async function testTriangleDataProcessor() {
  console.log('🧪 开始测试Triangle数据处理器...')
  
  try {
    const processor = new TriangleDataProcessor()
    
    // 测试数据处理流程
    const channelData = await processor.processTriangleData()
    
    // 验证数据有效性
    const validation = processor.validateData()
    
    console.log('✅ Triangle数据处理测试结果:')
    console.log('数据验证:', validation)
    console.log('光源数量:', channelData.sources.length)
    console.log('检测器数量:', channelData.detectors.length) 
    console.log('通道总数:', channelData.totalChannels)
    console.log('布局尺寸:', channelData.layoutDimensions)
    
    // 显示前几个通道位置作为示例
    console.log('前5个通道位置:')
    channelData.channelPositions.slice(0, 5).forEach(channel => {
      console.log(`通道${channel.channelId}: (${channel.position[0].toFixed(2)}, ${channel.position[1].toFixed(2)}) 距离: ${channel.distance.toFixed(2)}mm`)
    })
    
    return channelData
    
  } catch (error) {
    console.error('❌ Triangle数据处理测试失败:', error)
    throw error
  }
}

export { testTriangleDataProcessor }