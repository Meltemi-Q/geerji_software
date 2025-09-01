/**
 * 模块化热力图渲染器 - 基于位置和数值计算的连续插值热力图
 * 重构为模块化架构，提高代码可读性和维护性
 */
import * as d3 from 'd3'
import { HeatmapConfig } from './HeatmapConfig.js'
import { GeometryUtils } from './GeometryUtils.js'
import { ImageFilters } from './ImageFilters.js'
import { HeatmapCore } from './HeatmapCore.js'
import { RenderUtils } from './RenderUtils.js'

export class HeatmapRenderer {
  constructor(config = {}) {
    // 使用配置管理模块
    this.configManager = new HeatmapConfig(config)
    
    // 为了向后兼容，将配置属性映射到实例
    this.config = this.configManager.config
    this.gridSize = this.configManager.gridSize
    this.radius = this.configManager.radius
    this.yOffset = this.configManager.yOffset
    this.idwPower = this.configManager.idwPower
    this.gaussianSigma = this.configManager.gaussianSigma
    this.scaleClampStrategy = this.configManager.scaleClampStrategy
    this.minScaleGuard = this.configManager.minScaleGuard
    this.scaleDebugMode = this.configManager.scaleDebugMode
    this.maskAlpha = this.configManager.maskAlpha
    this.maskDomainConsistency = this.configManager.maskDomainConsistency
    
    // 异步加载外部配置
    this.loadExternalConfig()
  }
  
  async loadExternalConfig() {
    await this.configManager.loadExternalConfig()
    // 同步更新实例属性
    this._syncConfigToInstance()
  }

  _syncConfigToInstance() {
    this.config = this.configManager.config
    this.gridSize = this.configManager.gridSize
    this.idwPower = this.configManager.idwPower
    this.gaussianSigma = this.configManager.gaussianSigma
    this.scaleClampStrategy = this.configManager.scaleClampStrategy
    this.minScaleGuard = this.configManager.minScaleGuard
    this.scaleDebugMode = this.configManager.scaleDebugMode
    this.maskAlpha = this.configManager.maskAlpha
    this.maskDomainConsistency = this.configManager.maskDomainConsistency
  }

  /**
   * 委托给几何工具模块的大脑轮廓判定
   */
  isPointInBrainContour(x, y) {
    return GeometryUtils.isPointInBrainContour(x, y)
  }

  /**
   * 委托给几何工具模块的约束半径计算
   */
  calculateConstraintRadius(channelPositions) {
    return GeometryUtils.calculateConstraintRadius(channelPositions, this.radius)
  }

  /**
   * 委托给几何工具模块的通道选择
   */
  selectChannelsForTopograph(info, targetDistance = 30) {
    return GeometryUtils.selectChannelsForTopograph(info, targetDistance)
  }

  /**
   * 委托给几何工具模块的多边形判定
   */
  isPointInPolygon(point, polygon) {
    return GeometryUtils.isPointInPolygon(point, polygon)
  }

  /**
   * 委托给几何工具模块的凸包计算
   */
  createConvexHull(points) {
    return GeometryUtils.createConvexHull(points)
  }

  /**
   * 委托给几何工具模块的凸包扩展
   */
  expandConvexHull(hull, expansionFactor = 1.1) {
    return GeometryUtils.expandConvexHull(hull, expansionFactor)
  }

  /**
   * 委托给图像滤波模块的高斯滤波
   */
  gaussianFilter(grid, sigma = 0.5) {
    return ImageFilters.gaussianFilter(grid, sigma)
  }

  /**
   * 委托给图像滤波模块的平滑遮罩创建
   */
  createSmoothMask(mask, sigma = 4.0) {
    const config = {
      scaleDebugMode: this.scaleDebugMode,
      maskAlpha: this.maskAlpha,
      maskDomainConsistency: this.maskDomainConsistency,
      isPointInBrainContourFn: this.isPointInBrainContour.bind(this)
    }
    return ImageFilters.createSmoothMask(mask, config, sigma)
  }

  /**
   * 委托给核心模块的热力图数据生成
   */
  generateContinuousHeatmap(info, channelValues) {
    // 构建配置对象，包含所有必要的参数
    const coreConfig = {
      gridSize: this.gridSize,
      radius: this.radius,
      idwPower: this.idwPower,
      gaussianSigma: this.gaussianSigma,
      minScaleGuard: this.minScaleGuard,
      scaleDebugMode: this.scaleDebugMode,
      scaleClampStrategy: this.scaleClampStrategy,
      maskAlpha: this.maskAlpha,
      maskDomainConsistency: this.maskDomainConsistency
    }
    
    return HeatmapCore.generateContinuousHeatmap(info, channelValues, coreConfig)
  }

  /**
   * 委托给渲染工具模块的头部轮廓渲染
   */
  createHeadOutlineRenderer() {
    return RenderUtils.createHeadOutlineRenderer()
  }
}