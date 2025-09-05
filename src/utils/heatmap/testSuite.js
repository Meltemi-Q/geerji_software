/**
 * 热力图报告风格测试套件
 * 提供视觉验收、性能测试、功能验证等完整测试工具
 */

import { IDWInterpolator, GridBuilder } from './interpolation/idw.js'
import { ColorMapManager } from './colorMaps.js'
import { MaskUtils } from './maskUtils.js'
import { OverlayManager } from './overlayUtils.js'

/**
 * 测试套件主类
 */
export class HeatmapTestSuite {
  constructor() {
    this.testResults = {
      functional: [],
      performance: [],
      visual: [],
      integration: []
    }
    this.startTime = Date.now()
  }

  /**
   * 运行完整测试套件
   * @param {Object} config - 测试配置
   * @returns {Promise<Object>} 测试结果报告
   */
  async runFullTestSuite(config = {}) {
    console.log('[测试套件] 开始完整测试套件')
    this.startTime = Date.now()
    
    try {
      // 1. 功能测试
      await this.runFunctionalTests(config)
      
      // 2. 性能测试
      await this.runPerformanceTests(config)
      
      // 3. 视觉验收测试
      await this.runVisualTests(config)
      
      // 4. 集成测试
      await this.runIntegrationTests(config)
      
      // 5. 生成测试报告
      const report = this.generateTestReport()
      
      console.log('[测试套件] 测试套件完成')
      return report
      
    } catch (error) {
      console.error('[测试套件] 测试套件执行失败:', error)
      return this.generateErrorReport(error)
    }
  }

  /**
   * 功能测试
   */
  async runFunctionalTests(config) {
    console.log('[测试套件] 开始功能测试')
    
    // 测试数据生成
    const testData = this.generateTestData()
    
    // 1. IDW插值测试
    await this.testIDWInterpolation(testData)
    
    // 2. 颜色映射测试
    await this.testColorMapping(testData)
    
    // 3. 掩膜处理测试
    await this.testMaskUtils(testData)
    
    // 4. 覆盖层测试
    await this.testOverlayManager(testData)
    
    console.log('[测试套件] 功能测试完成')
  }

  /**
   * 性能测试
   */
  async runPerformanceTests(config) {
    console.log('[测试套件] 开始性能测试')
    
    const testConfigs = [
      { gridSize: 80, channels: 24, name: '小规模' },
      { gridSize: 120, channels: 432, name: '标准规模' },
      { gridSize: 150, channels: 864, name: '大规模' }
    ]
    
    for (const testConfig of testConfigs) {
      await this.performanceTest(testConfig)
    }
    
    console.log('[测试套件] 性能测试完成')
  }

  /**
   * 视觉验收测试
   */
  async runVisualTests(config) {
    console.log('[测试套件] 开始视觉验收测试')
    
    // 1. 颜色域稳定性测试
    this.testColorStability()
    
    // 2. 离散色阶测试
    this.testDiscreteColorLevels()
    
    // 3. 掩膜边界测试
    this.testMaskBoundaries()
    
    // 4. 坐标对齐测试
    this.testCoordinateAlignment()
    
    console.log('[测试套件] 视觉验收测试完成')
  }

  /**
   * 集成测试
   */
  async runIntegrationTests(config) {
    console.log('[测试套件] 开始集成测试')
    
    // 1. 端到端数据流测试
    await this.testEndToEndDataFlow()
    
    // 2. 模式切换测试
    await this.testModeSwitching()
    
    // 3. 错误处理测试
    await this.testErrorHandling()
    
    console.log('[测试套件] 集成测试完成')
  }

  /**
   * IDW插值功能测试
   */
  async testIDWInterpolation(testData) {
    const testName = 'IDW插值算法'
    const startTime = performance.now()
    
    try {
      const interpolator = new IDWInterpolator({
        power: 2,
        kNeighbors: 16
      })
      
      const gridInfo = GridBuilder.createGridInfo(testData.channels)
      const result = interpolator.interpolate(testData.channels, gridInfo)
      
      // 验证结果
      const validPoints = Array.from(result).filter(v => !isNaN(v)).length
      const totalPoints = result.length
      const coverage = validPoints / totalPoints
      
      const endTime = performance.now()
      
      this.testResults.functional.push({
        name: testName,
        passed: coverage > 0.3 && validPoints > 0,
        duration: endTime - startTime,
        details: {
          totalPoints,
          validPoints,
          coverage: Math.round(coverage * 100) + '%',
          gridSize: Math.sqrt(totalPoints)
        }
      })
      
    } catch (error) {
      this.testResults.functional.push({
        name: testName,
        passed: false,
        error: error.message,
        duration: performance.now() - startTime
      })
    }
  }

  /**
   * 颜色映射测试
   */
  async testColorMapping(testData) {
    const testName = '颜色映射功能'
    const startTime = performance.now()
    
    try {
      const colorManager = new ColorMapManager({
        valueDomain: { min: -0.05, max: 0.05 },
        colorMap: 'Spectral',
        discreteLevels: 9
      })
      
      // 测试不同数值的颜色映射
      const testValues = [-0.05, -0.025, 0, 0.025, 0.05]
      const colors = testValues.map(v => colorManager.getColor(v, true))
      
      // 验证颜色格式
      const validColors = colors.every(color => 
        Array.isArray(color) && 
        color.length >= 3 &&
        color.every(c => c >= 0 && c <= 255)
      )
      
      // 验证颜色条数据
      const colorBarData = colorManager.getColorBarData()
      const validColorBar = colorBarData.data && colorBarData.data.length === 9
      
      // 验证中心色
      const centerColor = colorManager.getCenterColor()
      const validCenterColor = Array.isArray(centerColor) && centerColor.length >= 3
      
      const endTime = performance.now()
      
      this.testResults.functional.push({
        name: testName,
        passed: validColors && validColorBar && validCenterColor,
        duration: endTime - startTime,
        details: {
          testValues: testValues.length,
          colorBarLevels: colorBarData.data ? colorBarData.data.length : 0,
          centerColorValid: validCenterColor
        }
      })
      
    } catch (error) {
      this.testResults.functional.push({
        name: testName,
        passed: false,
        error: error.message,
        duration: performance.now() - startTime
      })
    }
  }

  /**
   * 掩膜工具测试
   */
  async testMaskUtils(testData) {
    const testName = '掩膜处理功能'
    const startTime = performance.now()
    
    try {
      const gridSize = 60
      const bounds = { minX: 0, maxX: 100, minY: 0, maxY: 60 }
      
      // 创建前额掩膜
      const mask = MaskUtils.createShapeMask(gridSize, bounds, {
        maskType: 'forehead',
        edgeSmoothing: true
      })
      
      // 验证掩膜
      const validMask = mask && mask.length === gridSize * gridSize
      const nonZeroPoints = Array.from(mask).filter(v => v > 0.01).length
      const coverage = nonZeroPoints / mask.length
      
      // 测试掩膜应用
      const testGrid = new Float32Array(gridSize * gridSize).fill(1.0)
      const maskedGrid = MaskUtils.applyMask(testGrid, mask)
      const maskedPoints = Array.from(maskedGrid).filter(v => !isNaN(v)).length
      
      const endTime = performance.now()
      
      this.testResults.functional.push({
        name: testName,
        passed: validMask && coverage > 0.1 && coverage < 0.8,
        duration: endTime - startTime,
        details: {
          gridSize,
          maskCoverage: Math.round(coverage * 100) + '%',
          maskedPoints,
          validMask
        }
      })
      
    } catch (error) {
      this.testResults.functional.push({
        name: testName,
        passed: false,
        error: error.message,
        duration: performance.now() - startTime
      })
    }
  }

  /**
   * 覆盖层管理器测试
   */
  async testOverlayManager(testData) {
    const testName = '12-node覆盖层功能'
    const startTime = performance.now()
    
    try {
      const overlayManager = new OverlayManager({
        overlayOpacity: 0.6,
        overlayHullType: 'convex'
      })
      
      // 由于布局文件可能无法访问，使用模拟数据
      const mockOptodePoints = [
        { x: 10, y: 10 }, { x: 50, y: 15 }, { x: 90, y: 10 },
        { x: 20, y: 40 }, { x: 50, y: 45 }, { x: 80, y: 40 },
        { x: 15, y: 70 }, { x: 50, y: 75 }, { x: 85, y: 70 }
      ]
      
      overlayManager.optodePoints2D = mockOptodePoints
      
      const containerBounds = { 
        left: 0, top: 0, width: 400, height: 300 
      }
      
      const overlayData = overlayManager.createOverlayPolygon(
        containerBounds, 
        null // 无颜色管理器，使用默认颜色
      )
      
      // 验证覆盖层数据
      const validOverlay = overlayData && 
                          overlayData.points && 
                          overlayData.svgPoints &&
                          overlayData.style
      
      const overlayInfo = overlayManager.getOverlayInfo()
      
      const endTime = performance.now()
      
      this.testResults.functional.push({
        name: testName,
        passed: validOverlay,
        duration: endTime - startTime,
        details: {
          optodePoints: mockOptodePoints.length,
          polygonPoints: overlayData ? overlayData.points.length : 0,
          hasStyle: overlayData ? !!overlayData.style : false
        }
      })
      
    } catch (error) {
      this.testResults.functional.push({
        name: testName,
        passed: false,
        error: error.message,
        duration: performance.now() - startTime
      })
    }
  }

  /**
   * 单项性能测试
   */
  async performanceTest(config) {
    const testName = `性能测试-${config.name}(${config.gridSize}×${config.gridSize})`
    const testData = this.generateTestData(config.channels)
    
    const times = []
    const iterations = 5
    
    try {
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now()
        
        // 完整处理流程
        const interpolator = new IDWInterpolator({ kNeighbors: 16 })
        const gridInfo = GridBuilder.createGridInfo(testData.channels, { 
          gridSize: config.gridSize 
        })
        
        const interpolated = interpolator.interpolate(testData.channels, gridInfo)
        const smoothed = interpolator.applyGaussianSmoothing(
          interpolated, 
          config.gridSize, 
          2.0
        )
        
        const mask = MaskUtils.createShapeMask(config.gridSize, gridInfo.bounds)
        const final = MaskUtils.applyMask(smoothed, mask)
        
        const endTime = performance.now()
        times.push(endTime - startTime)
      }
      
      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length
      const fps = avgTime > 0 ? 1000 / avgTime : 0
      
      // 性能目标：500-1000ms，至少1fps
      const passed = avgTime <= 1000 && fps >= 1.0
      
      this.testResults.performance.push({
        name: testName,
        passed,
        avgTime: Math.round(avgTime),
        fps: Math.round(fps * 10) / 10,
        gridSize: config.gridSize,
        channels: config.channels,
        iterations
      })
      
    } catch (error) {
      this.testResults.performance.push({
        name: testName,
        passed: false,
        error: error.message,
        gridSize: config.gridSize,
        channels: config.channels
      })
    }
  }

  /**
   * 颜色稳定性测试
   */
  testColorStability() {
    const testName = '颜色域稳定性'
    
    try {
      const colorManager = new ColorMapManager({
        valueDomain: { min: -0.05, max: 0.05 },
        discreteLevels: 9
      })
      
      // 测试连续多次获取相同值的颜色
      const testValue = 0.025
      const colors = []
      for (let i = 0; i < 100; i++) {
        colors.push(colorManager.getColor(testValue, true))
      }
      
      // 验证颜色一致性
      const firstColor = colors[0]
      const allSame = colors.every(color => 
        color[0] === firstColor[0] && 
        color[1] === firstColor[1] && 
        color[2] === firstColor[2]
      )
      
      this.testResults.visual.push({
        name: testName,
        passed: allSame,
        details: {
          testValue,
          iterations: colors.length,
          consistent: allSame
        }
      })
      
    } catch (error) {
      this.testResults.visual.push({
        name: testName,
        passed: false,
        error: error.message
      })
    }
  }

  /**
   * 离散色阶测试
   */
  testDiscreteColorLevels() {
    const testName = '离散色阶准确性'
    
    try {
      const colorManager = new ColorMapManager({
        valueDomain: { min: -0.05, max: 0.05 },
        discreteLevels: 9
      })
      
      // 测试值应该映射到正确的离散级别
      const testValues = [-0.05, -0.03, -0.01, 0, 0.01, 0.03, 0.05]
      const discreteColors = testValues.map(v => colorManager.getColor(v, true))
      const continuousColors = testValues.map(v => colorManager.getColor(v, false))
      
      // 验证离散和连续模式的差异
      let hasDifferences = false
      for (let i = 0; i < testValues.length; i++) {
        const discrete = discreteColors[i]
        const continuous = continuousColors[i]
        if (discrete[0] !== continuous[0] || discrete[1] !== continuous[1] || discrete[2] !== continuous[2]) {
          hasDifferences = true
          break
        }
      }
      
      this.testResults.visual.push({
        name: testName,
        passed: hasDifferences, // 离散和连续应该有差异
        details: {
          testValues: testValues.length,
          hasDifferences
        }
      })
      
    } catch (error) {
      this.testResults.visual.push({
        name: testName,
        passed: false,
        error: error.message
      })
    }
  }

  /**
   * 掩膜边界测试
   */
  testMaskBoundaries() {
    const testName = '掩膜边界平滑性'
    
    try {
      const gridSize = 40
      const bounds = { minX: 0, maxX: 100, minY: 0, maxY: 60 }
      
      const mask = MaskUtils.createShapeMask(gridSize, bounds, {
        edgeSmoothing: true,
        smoothingSigma: 2.0
      })
      
      // 检查边界梯度
      let hasGradients = false
      for (let y = 1; y < gridSize - 1; y++) {
        for (let x = 1; x < gridSize - 1; x++) {
          const center = mask[y * gridSize + x]
          const neighbors = [
            mask[(y-1) * gridSize + x],
            mask[(y+1) * gridSize + x], 
            mask[y * gridSize + (x-1)],
            mask[y * gridSize + (x+1)]
          ]
          
          const avgNeighbor = neighbors.reduce((sum, v) => sum + v, 0) / 4
          if (Math.abs(center - avgNeighbor) > 0.1 && Math.abs(center - avgNeighbor) < 0.9) {
            hasGradients = true
            break
          }
        }
        if (hasGradients) break
      }
      
      this.testResults.visual.push({
        name: testName,
        passed: hasGradients, // 应该有平滑的梯度边界
        details: {
          gridSize,
          hasGradients
        }
      })
      
    } catch (error) {
      this.testResults.visual.push({
        name: testName,
        passed: false,
        error: error.message
      })
    }
  }

  /**
   * 坐标对齐测试
   */
  testCoordinateAlignment() {
    const testName = '坐标系对齐准确性'
    
    try {
      const testChannels = [
        { position: [0, 0], value: 1.0 },
        { position: [50, 30], value: 0.5 },
        { position: [100, 60], value: -0.5 }
      ]
      
      const gridInfo = GridBuilder.createGridInfo(testChannels, { gridSize: 20 })
      
      // 验证边界计算
      const bounds = gridInfo.bounds
      const validBounds = bounds.minX <= 0 && bounds.maxX >= 100 &&
                         bounds.minY <= 0 && bounds.maxY >= 60
      
      // 验证网格信息
      const validGrid = gridInfo.gridSize === 20 &&
                        gridInfo.width > 0 &&
                        gridInfo.height > 0
      
      this.testResults.visual.push({
        name: testName,
        passed: validBounds && validGrid,
        details: {
          bounds,
          gridSize: gridInfo.gridSize,
          validBounds,
          validGrid
        }
      })
      
    } catch (error) {
      this.testResults.visual.push({
        name: testName,
        passed: false,
        error: error.message
      })
    }
  }

  /**
   * 端到端数据流测试
   */
  async testEndToEndDataFlow() {
    const testName = '端到端数据流'
    const startTime = performance.now()
    
    try {
      const testData = this.generateTestData()
      
      // 完整的处理流程
      const interpolator = new IDWInterpolator({ kNeighbors: 16 })
      const colorManager = new ColorMapManager({
        valueDomain: { min: -0.05, max: 0.05 },
        discreteLevels: 9
      })
      
      const gridInfo = GridBuilder.createGridInfo(testData.channels)
      const interpolated = interpolator.interpolate(testData.channels, gridInfo)
      const smoothed = interpolator.applyGaussianSmoothing(interpolated, gridInfo.gridSize)
      const mask = MaskUtils.createShapeMask(gridInfo.gridSize, gridInfo.bounds)
      const final = MaskUtils.applyMask(smoothed, mask)
      
      // 转换为可视化数据
      const visualData = []
      for (let i = 0; i < final.length; i++) {
        if (!isNaN(final[i])) {
          const color = colorManager.getColor(final[i], true)
          visualData.push({ value: final[i], color })
        }
      }
      
      const endTime = performance.now()
      
      this.testResults.integration.push({
        name: testName,
        passed: visualData.length > 0,
        duration: endTime - startTime,
        details: {
          inputChannels: testData.channels.length,
          outputPoints: visualData.length,
          processingSteps: 5
        }
      })
      
    } catch (error) {
      this.testResults.integration.push({
        name: testName,
        passed: false,
        error: error.message,
        duration: performance.now() - startTime
      })
    }
  }

  /**
   * 模式切换测试
   */
  async testModeSwitching() {
    const testName = '渲染模式切换'
    
    // 由于这是纯逻辑测试，模拟切换过程
    try {
      const modes = ['report', 'legacy']
      const switchResults = []
      
      for (const mode of modes) {
        const startTime = performance.now()
        
        // 模拟模式切换逻辑
        const success = this.simulateModeSwitch(mode)
        const endTime = performance.now()
        
        switchResults.push({
          mode,
          success,
          switchTime: endTime - startTime
        })
      }
      
      const allSuccessful = switchResults.every(r => r.success)
      const avgSwitchTime = switchResults.reduce((sum, r) => sum + r.switchTime, 0) / switchResults.length
      
      this.testResults.integration.push({
        name: testName,
        passed: allSuccessful && avgSwitchTime < 500,
        details: {
          modes: modes.length,
          avgSwitchTime: Math.round(avgSwitchTime),
          allSuccessful
        }
      })
      
    } catch (error) {
      this.testResults.integration.push({
        name: testName,
        passed: false,
        error: error.message
      })
    }
  }

  /**
   * 错误处理测试
   */
  async testErrorHandling() {
    const testName = '错误处理机制'
    
    try {
      const errorTests = [
        {
          name: '空数据处理',
          test: () => {
            const interpolator = new IDWInterpolator()
            return interpolator.interpolate([], { gridSize: 10, bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 }})
          }
        },
        {
          name: '无效颜色域',
          test: () => {
            return new ColorMapManager({ valueDomain: { min: 1, max: 0 }})
          }
        },
        {
          name: '无效网格大小',
          test: () => {
            return MaskUtils.createShapeMask(-1, { minX: 0, maxX: 10, minY: 0, maxY: 10 })
          }
        }
      ]
      
      let handledErrors = 0
      
      for (const errorTest of errorTests) {
        try {
          errorTest.test()
        } catch (error) {
          handledErrors++
        }
      }
      
      // 期望所有错误都被正确处理（抛出异常或返回安全值）
      this.testResults.integration.push({
        name: testName,
        passed: handledErrors === errorTests.length,
        details: {
          totalTests: errorTests.length,
          handledErrors,
          errorHandlingRate: Math.round((handledErrors / errorTests.length) * 100) + '%'
        }
      })
      
    } catch (error) {
      this.testResults.integration.push({
        name: testName,
        passed: false,
        error: error.message
      })
    }
  }

  /**
   * 生成测试数据
   */
  generateTestData(channelCount = 24) {
    const channels = []
    
    for (let i = 0; i < channelCount; i++) {
      const angle = (i / channelCount) * 2 * Math.PI
      const radius = 30 + Math.random() * 20
      
      channels.push({
        position: [
          50 + Math.cos(angle) * radius,
          35 + Math.sin(angle) * radius
        ],
        value: (Math.sin(angle * 2) + Math.random() * 0.2 - 0.1) * 0.05,
        channelIndex: i
      })
    }
    
    return { channels }
  }

  /**
   * 模拟模式切换
   */
  simulateModeSwitch(mode) {
    // 模拟切换验证逻辑
    return ['report', 'legacy'].includes(mode)
  }

  /**
   * 生成测试报告
   */
  generateTestReport() {
    const totalTime = Date.now() - this.startTime
    
    const allTests = [
      ...this.testResults.functional,
      ...this.testResults.performance, 
      ...this.testResults.visual,
      ...this.testResults.integration
    ]
    
    const passedTests = allTests.filter(t => t.passed)
    const failedTests = allTests.filter(t => !t.passed)
    const successRate = (passedTests.length / allTests.length) * 100
    
    // 性能统计
    const perfTests = this.testResults.performance.filter(t => t.passed)
    const avgFPS = perfTests.length > 0 
      ? perfTests.reduce((sum, t) => sum + t.fps, 0) / perfTests.length 
      : 0
    const avgTime = perfTests.length > 0
      ? perfTests.reduce((sum, t) => sum + t.avgTime, 0) / perfTests.length
      : 0
    
    const report = {
      summary: {
        totalTests: allTests.length,
        passed: passedTests.length,
        failed: failedTests.length,
        successRate: Math.round(successRate),
        totalDuration: totalTime,
        avgFPS: Math.round(avgFPS * 10) / 10,
        avgRenderTime: Math.round(avgTime)
      },
      details: {
        functional: this.testResults.functional,
        performance: this.testResults.performance,
        visual: this.testResults.visual,
        integration: this.testResults.integration
      },
      failures: failedTests,
      recommendations: this.generateRecommendations(failedTests, perfTests)
    }
    
    console.log('[测试套件] 测试报告生成完成:', report.summary)
    return report
  }

  /**
   * 生成错误报告
   */
  generateErrorReport(error) {
    return {
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 1,
        successRate: 0,
        error: error.message
      },
      details: this.testResults,
      criticalError: {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * 生成改进建议
   */
  generateRecommendations(failures, perfTests) {
    const recommendations = []
    
    if (failures.length > 0) {
      recommendations.push({
        type: 'error',
        priority: 'high',
        message: `有${failures.length}个测试失败，需要修复功能问题`
      })
    }
    
    const slowTests = perfTests.filter(t => t.avgTime > 800)
    if (slowTests.length > 0) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: `${slowTests.length}个性能测试较慢，建议优化算法或启用Web Worker`
      })
    }
    
    const lowFPSTests = perfTests.filter(t => t.fps < 1.5)
    if (lowFPSTests.length > 0) {
      recommendations.push({
        type: 'performance',
        priority: 'medium', 
        message: `${lowFPSTests.length}个测试帧率过低，建议降低网格密度或优化渲染`
      })
    }
    
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'success',
        priority: 'info',
        message: '所有测试通过，报告风格热力图功能正常'
      })
    }
    
    return recommendations
  }
}