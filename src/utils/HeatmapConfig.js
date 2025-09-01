/**
 * 热力图渲染器配置管理模块
 * 负责配置的初始化、合并和外部配置加载
 */
export class HeatmapConfig {
  constructor(config = {}) {
    // 默认配置
    this.defaultConfig = {
      gridSize: 100,              // 网格分辨率
      interpolationRadius: 25,    // 插值半径
      gaussianSigma: 2,          // 高斯sigma
      colorMap: 'blue_red',      // 颜色映射
      valueRange: [-1, 1],       // 数值范围
      updateFrequency: 1000,     // 更新频率
      idwPower: 2,               // IDW幂指数
      minScaleGuard: false,      // 保底缩放策略
      scaleClampStrategy: 'default', // 缩放策略
      scaleDebugMode: true,      // 缩放调试模式
      maskAlpha: 0.3,            // 遮罩透明度
      maskDomainConsistency: true // 域一致性检查
    };
    
    // 合并传入的配置
    this.config = { ...this.defaultConfig, ...config };
    
    // 为了兼容性，保留原有属性设置
    this.gridSize = this.config.gridSize;
    this.radius = 0.35;  // 头部圆形半径
    this.yOffset = -0.15; // 向下偏移量（负值=向上）
    
    // 功能参数设置
    this.idwPower = this.config.idwPower;
    this.gaussianSigma = this.config.gaussianSigma;
    this.scaleClampStrategy = this.config.scaleClampStrategy;
    this.minScaleGuard = this.config.minScaleGuard;
    this.scaleDebugMode = this.config.scaleDebugMode;
    this.maskAlpha = this.config.maskAlpha;
    this.maskDomainConsistency = this.config.maskDomainConsistency;
  }

  /**
   * 异步加载外部配置文件
   */
  async loadExternalConfig() {
    // 配置文件白名单键
    const allowedKeys = [
      'gridSize', 'interpolationRadius', 'gaussianSigma', 'colorMap', 
      'valueRange', 'updateFrequency', 'idwPower', 'minScaleGuard', 
      'scaleClampStrategy', 'scaleDebugMode', 'maskAlpha', 'maskDomainConsistency'
    ];
    
    try {
      const response = await fetch('/heatmap_renderer_config.json');
      if (response.ok) {
        const externalConfig = await response.json();
        
        // 提取嵌套的config对象（如果存在）
        const configToMerge = externalConfig.config || externalConfig;
        
        // 仅合并白名单内的键
        allowedKeys.forEach(key => {
          if (configToMerge.hasOwnProperty(key)) {
            this.config[key] = configToMerge[key];
            this[key] = configToMerge[key]; // 同时更新实例属性
          }
        });
        
        console.log(`Loaded external config: idwPower=${this.config.idwPower}, gaussianSigma=${this.config.gaussianSigma}`);
      } else {
        console.log('No external config file found, using defaults');
      }
    } catch (error) {
      console.warn('Failed to load external config, using defaults:', error.message);
    }
  }

  /**
   * 获取配置值
   */
  get(key) {
    return this.config[key];
  }

  /**
   * 设置配置值
   */
  set(key, value) {
    this.config[key] = value;
    this[key] = value; // 同时更新实例属性
  }

  /**
   * 批量更新配置
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    // 同步更新实例属性
    Object.entries(newConfig).forEach(([key, value]) => {
      this[key] = value;
    });
  }
}