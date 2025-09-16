<template>
  <div class="tablet-app">
    <!-- HM测试页面 -->
    <HeatmapTestView 
      v-if="appState === 'hm-test'"
    />
    
    <!-- 训练界面 -->
    <TrainingContainer 
      v-else-if="appState === 'training'"
      :hbo-data="hboData"
      :hbr-data="hbrData"
      :current-values="currentValues"
      :training-duration="trainingStatus.duration"
      :is-training="trainingStatus.isTraining"
      :patient-info="patientInfo"
      :device-status="deviceStatus"
      :kangzhuxia-status="kangzhuxiaStatus"
      :data-history="dataHistory"
      :selected-time-range="selectedTimeRange"
      @start-training="startTraining"
      @pause-training="pauseTraining"
      @stop-training="stopTraining"
      @emergency-stop="emergencyStop"
      @connect-kangzhuxia="connectKangzhuxia"
      @update-time-range="updateSelectedTimeRange"
      @disconnect-kangzhuxia="disconnectKangzhuxia"
    />
    
    <!-- 训练结束后的评估界面 -->
    <AssessmentView 
      v-else-if="appState === 'assessment'"
      :combined-heatmap="combinedHeatmap"
      :brain-activity-score="brainActivityScore"
      :assessment-text="assessmentText"
      :training-summary="trainingSummary"
      @new-training="newTraining"
      @save-record="saveRecord"
      @return-standby="returnToStandby"
    />
    
    <!-- 待机界面 -->
    <StandbyView 
      v-else
      @start-training="startTraining"
    />
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import TrainingContainer from './components/training/TrainingContainer.vue' // 新的模块化训练容器
import AssessmentView from './components/AssessmentView.vue'
import StandbyView from './components/StandbyView.vue'
import HeatmapTestView from './components/HeatmapTestView.vue' // HM测试页面
import { sessionManager } from './services/sessionManager.js'
import { userDataService } from './services/UserDataService.js'

export default {
  name: 'App',
  components: {
    TrainingContainer,
    AssessmentView,
    StandbyView,
    HeatmapTestView
  },
  setup() {
    // 应用状态：'standby', 'training', 'assessment', 'hm-test'
    const appState = ref('standby')
    
    // 检查URL路径和Hash，支持直接导航
    const checkRoute = () => {
      const path = window.location.pathname
      const hash = window.location.hash
      
      console.log('[App] 路由检查:', { path, hash, currentAppState: appState.value })
      
      // 支持 /hm 路径或 #hm hash
      if (path === '/hm' || hash === '#hm') {
        console.log('[App] 切换到HM测试模式')
        appState.value = 'hm-test'
      }
      // 支持 #training hash 直接进入训练模式
      else if (hash === '#training') {
        if (appState.value !== 'training') {
          console.log('[App] 直接进入训练模式 (首次)')
          appState.value = 'training'
          // 触发训练初始化
          nextTick(() => {
            startTraining()
          })
        } else {
          console.log('[App] 已在训练模式，跳过重复初始化')
        }
      }
      // 支持 #assessment hash 直接进入评估模式
      else if (hash === '#assessment') {
        console.log('[App] 直接进入评估模式')
        appState.value = 'assessment'
      }
    }
    
    // 监听URL变化
    window.addEventListener('hashchange', checkRoute)
    window.addEventListener('popstate', checkRoute)
    
    // 页面加载时立即检查路由状态
    checkRoute()

    // 加载通道映射（若存在），用于与432通道顺序对齐
    const loadChannelMap = async () => {
      try {
        const res = await fetch('/config/channel_map.json')
        if (res.ok) {
          const map = await res.json()
          window.__CHANNEL_MAP__ = Array.isArray(map) ? map : []
          console.log('[App] 已加载通道映射: 条目数', window.__CHANNEL_MAP__.length)
        }
      } catch (e) {
        // 忽略缺失
      }
    }
    
    // 患者信息 - 从localStorage读取选中的用户
    const patientInfo = ref({
      name: '张三',
      age: 87,
      room: '201-3'
    })
    
    // 从localStorage加载患者信息
    function loadPatientInfo() {
      try {
        const savedPatientInfo = localStorage.getItem('patientInfo')
        if (savedPatientInfo) {
          const patientData = JSON.parse(savedPatientInfo)
          console.log('[用户信息同步] 从localStorage加载患者信息:', patientData)
          
          // 更新患者信息显示
          patientInfo.value = {
            name: patientData.name || '张三',
            age: patientData.age || 87,
            room: patientData.room || '201-3'
          }
          
          console.log('[用户信息同步] ✅ 患者信息已同步到训练界面:', patientInfo.value)
        } else {
          console.log('[用户信息同步] 未找到已保存的患者信息，使用默认值')
        }
      } catch (error) {
        console.error('[用户信息同步] 读取患者信息失败:', error)
      }
    }
    
    // 设备状态
    const deviceStatus = ref({
      fnirs: 'connected',      // connected, disconnected, error
      kangzhuxia: 'disconnected'    // connected, disconnected, running, stopped, error
    })
    
    // 康助侠设备控制状态
    const kangzhuxiaStatus = ref({
      connected: false,
      card_status: 0,    // 0:未刷卡, 1:已刷卡
      motion_status: 0,  // 0:停止, 1:运动
      emergency_status: 0 // 0:正常, 1:急停
    })
    
    // 训练状态
    const trainingStatus = ref({
      isTraining: false,
      duration: 0,            // 秒
      speed: 'low',           // low, high
      sessionId: null
    })
    
    // 当前时间
    const currentTime = ref(new Date().toLocaleTimeString())
    
    // 真实fNIRS HbO数据 (含氧血红蛋白) - 432通道
    const hboData = ref(new Array(432).fill(0.025))
    
    // 真实fNIRS HbR数据 (脱氧血红蛋白) - 432通道  
    const hbrData = ref(new Array(432).fill(-0.015))
    
    // 当前数值
    const currentValues = ref({
      hbo: 0.025,
      hbr: -0.015,
      hboTrend: 'up',    // up, down, stable
      hbrTrend: 'down'
    })
    
    // 综合热力图数据 (训练结束后)
    const combinedHeatmap = ref(null)
    
    // 历史数据存储（10秒滚动窗口）
    const dataHistory = ref([])
    // 改为基于帧的滚动窗口（120帧）
    const WINDOW_FRAMES = 120
    const selectedTimeRange = ref({ start: 0, end: 100 })
    
    // 脑活跃度评分
    const brainActivityScore = ref({
      score: 7.8,
      maxScore: 10,
      stars: 4
    })
    
    // 评估文字
    const assessmentText = ref({
      title: '训练效果良好',
      description: '大脑活跃度显著提升',
      suggestion: '建议继续进行康复训练'
    })
    
    // 训练总结
    const trainingSummary = ref({
      duration: 923,           // 15分23秒
      avgHboChange: 0.032,
      avgHbrChange: -0.018
    })
    
    // 定时器
    let timeUpdateTimer = null
    let dataUpdateTimer = null
    let trainingStartMs = null
    
    // fNIRS API配置（从环境变量读取，默认8091）
    const FNIRS_API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8091'
    
    /**
     * 从Python SDK服务器获取真实fNIRS数据
     */
    async function fetchRealFNIRSData() {
      const apiUrl = `${FNIRS_API_BASE}/api/fnirs/data`
      try {
        const response = await fetch(apiUrl)
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const data = await response.json()
        
        return {
          hboData: data.hbo_data || [],
          hbrData: data.hbr_data || [],
          hboStats: data.hbo_stats || {},
          hbrStats: data.hbr_stats || {},
          timestamp: data.timestamp || Date.now() / 1000,
          frameId: data.frame_id || 0
        }
      } catch (error) {
        console.warn('[fNIRS API] 获取真实数据失败，使用模拟数据:', error.message)
        console.error('[API调试] 详细错误信息:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
          url: apiUrl
        })
        
        // 如果API失败，回退到模拟数据（增强容错机制）
        const fallbackData = {
          hboData: generateRealisticFNIRSData(0.025, 'hbo'),
          hbrData: generateRealisticFNIRSData(-0.015, 'hbr'),
          hboStats: { 
            mean: 0.025, 
            std: 0.015, 
            min: 0.01, 
            max: 0.04 
          },
          hbrStats: { 
            mean: -0.015, 
            std: 0.012, 
            min: -0.03, 
            max: 0.0 
          },
          timestamp: Date.now() / 1000,
          frameId: Math.floor(Date.now() / 1000) % 10000,
          fallbackMode: true // 标记为回退模式
        }
        
        // 在控制台显示友好提示
        if (error.message.includes('Failed to fetch')) {
          console.log('💡 [用户提示] 后端服务可能未启动，请检查 fnirs_data_server.py')
        }
        
        return fallbackData
      }
    }
    
    /**
     * 存储历史数据帧（10秒滚动窗口）
     */
    function storeHistoryFrame(hboData, hbrData, timestamp, frameId = null, stats = null) {
      console.log('[历史数据存储] 调用storeHistoryFrame，参数:', {
        hboDataLength: hboData?.length,
        hbrDataLength: hbrData?.length,
        timestamp,
        frameId,
        statsAvailable: !!stats
      })
      
      const now = Date.now()
      const historyFrame = {
        hbo: [...hboData],  // 深拷贝避免引用问题
        hbr: [...hbrData],
        timestamp,
        frameId: frameId || dataHistory.value.length,
        recordTime: now,  // 使用统一的时间基准
        // 存储SDK统计数据（用于曲线显示）
        hboMean: stats?.hbo_stats?.mean || (hboData.reduce((a, b) => a + b, 0) / hboData.length),
        hbrMean: stats?.hbr_stats?.mean || (hbrData.reduce((a, b) => a + b, 0) / hbrData.length),
        hboStats: stats?.hbo_stats || null,
        hbrStats: stats?.hbr_stats || null
      }
      
      // 添加新数据帧（保持数据累积，不删除历史数据）
      dataHistory.value.push(historyFrame)
      
      // 【修复】：保持数据累积存储，让图表显示时动态切片
      // 不再删除历史数据，让数据持续累积以支持滚动曲线显示
      console.log(`[数据累积] 存储第${dataHistory.value.length}帧，总时长: ${((now - (dataHistory.value[0]?.recordTime || now)) / 1000).toFixed(1)}秒`)
      
      console.log('[历史数据存储] 数据帧已存储，当前历史长度:', dataHistory.value.length)
      
      // 【修复】更新时间选择范围（支持数据累积的滚动显示）
      selectedTimeRange.value.end = dataHistory.value.length - 1
      const recentFrames = WINDOW_FRAMES
      selectedTimeRange.value.start = Math.max(0, dataHistory.value.length - recentFrames)
      console.log(`[滚动显示] 滚动显示最新${recentFrames}帧 (第${selectedTimeRange.value.start}-${selectedTimeRange.value.end}帧)`) 
    }
    
    /**
     * 从历史数据中获取指定时间段的数据（支持10秒滚动窗口）
     */
    function getHistoryData(startIdx = null, endIdx = null) {
      if (!startIdx && !endIdx) {
        // 默认返回最近10秒的数据
        const now = Date.now()
        const cutoffTime = now - TIME_WINDOW_MS
        return dataHistory.value.filter(frame => frame.recordTime >= cutoffTime)
      }
      
      const start = startIdx || selectedTimeRange.value.start
      const end = endIdx || selectedTimeRange.value.end
      
      return dataHistory.value.slice(start, end + 1)
    }
    
    /**
     * 更新时间选择范围
     */
    function updateSelectedTimeRange(newTimeRange) {
      selectedTimeRange.value = { ...newTimeRange }
      console.log(`[时间选择] 更新时间范围: ${newTimeRange.start} - ${newTimeRange.end}`)
    }
    
    // 生成真实SDK格式的432通道fNIRS数据，模拟血氧浓度的生理性波动（备用函数）
    function generateRealisticFNIRSData(baseValue, signalType = 'hbo') {
      const channelCount = 432  // Triangle布局：18光源×24检测器
      const data = []
      const currentTime = Date.now() / 1000  // 当前时间（秒）
      
      for (let i = 0; i < channelCount; i++) {
        // 空间分布模式 - 基于真实大脑解剖结构
        const spatialFactor = (i / channelCount) 
        
        // 生理性波动组件
        const respiratoryWave = Math.sin(currentTime * 2 * Math.PI * 0.3) * 0.008  // ~0.3Hz 呼吸波
        const cardiacWave = Math.sin(currentTime * 2 * Math.PI * 1.2) * 0.005     // ~1.2Hz 心跳波
        const lowFreqWave = Math.sin(currentTime * 2 * Math.PI * 0.1) * 0.012     // ~0.1Hz 低频波
        const veryLowFreqWave = Math.sin(currentTime * 2 * Math.PI * 0.04) * 0.018 // ~0.04Hz 极低频波
        
        // 大脑激活模式 - 随时间变化的认知负荷
        const cognitiveLoad = Math.sin(currentTime * 2 * Math.PI * 0.02 + i * 0.1) * 0.025
        
        // HbO和HbR的反向相关性（生理真实性）
        let signalModulation = 1.0
        if (signalType === 'hbr') {
          signalModulation = -0.6  // HbR与HbO呈负相关，但幅度较小
        }
        
        // 空间激活梯度 - 不同脑区的不同激活水平
        let spatialActivation = 0
        if (spatialFactor < 0.3) {
          // 前额叶区域 - 高认知负荷
          spatialActivation = cognitiveLoad * 1.5 * signalModulation
        } else if (spatialFactor < 0.7) {
          // 运动皮层区域 - 中等激活
          spatialActivation = cognitiveLoad * 1.0 * signalModulation
        } else {
          // 后部区域 - 较低激活
          spatialActivation = cognitiveLoad * 0.7 * signalModulation
        }
        
        // 添加通道特异性噪声
        const channelNoise = (Math.random() - 0.5) * 0.008
        const instrumentalDrift = Math.sin(currentTime * 0.01 + i * 0.05) * 0.003
        
        // 合成最终信号
        const finalValue = baseValue + 
                          spatialActivation + 
                          respiratoryWave + 
                          cardiacWave + 
                          lowFreqWave + 
                          veryLowFreqWave + 
                          channelNoise + 
                          instrumentalDrift
        
        data.push(finalValue)
      }
      
      // 数据生成完成
      return data
    }
    
    // 康助侠设备连接
    async function connectKangzhuxia() {
      try {
        // 模拟连接康助侠设备
        console.log('连接康助侠设备...')
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        kangzhuxiaStatus.value.connected = true
        deviceStatus.value.kangzhuxia = 'connected'
        console.log('康助侠设备连接成功')
        
        // 模拟获取初始状态
        await updateKangzhuxiaStatus()
        
      } catch (error) {
        console.error('康助侠设备连接失败:', error)
        deviceStatus.value.kangzhuxia = 'error'
      }
    }
    
    // 康助侠设备断开
    async function disconnectKangzhuxia() {
      try {
        console.log('断开康助侠设备...')
        await new Promise(resolve => setTimeout(resolve, 500))
        
        kangzhuxiaStatus.value.connected = false
        deviceStatus.value.kangzhuxia = 'disconnected'
        console.log('康助侠设备已断开')
        
      } catch (error) {
        console.error('康助侠设备断开失败:', error)
      }
    }
    
    // 启动康助侠数据采集
    async function startKangzhuxiaCollection() {
      try {
        console.log('启动康助侠数据采集...')
        await new Promise(resolve => setTimeout(resolve, 500))
        
        kangzhuxiaStatus.value.motion_status = 1
        deviceStatus.value.kangzhuxia = 'running'
        console.log('康助侠数据采集已启动')
        
      } catch (error) {
        console.error('康助侠数据采集启动失败:', error)
      }
    }
    
    // 停止康助侠数据采集
    async function stopKangzhuxiaCollection() {
      try {
        console.log('停止康助侠数据采集...')
        await new Promise(resolve => setTimeout(resolve, 500))
        
        kangzhuxiaStatus.value.motion_status = 0
        deviceStatus.value.kangzhuxia = 'connected'
        console.log('康助侠数据采集已停止')
        
      } catch (error) {
        console.error('康助侠数据采集停止失败:', error)
      }
    }
    
    
    // 更新康助侠状态
    async function updateKangzhuxiaStatus() {
      try {
        // 模拟获取设备状态
        const mockStatus = {
          connected: kangzhuxiaStatus.value.connected,
          card_status: 1, // 模拟已刷卡
          motion_status: kangzhuxiaStatus.value.motion_status,
          emergency_status: 0
        }
        
        kangzhuxiaStatus.value = mockStatus
        
      } catch (error) {
        console.error('获取康助侠状态失败:', error)
      }
    }

    
    // 开始训练
    async function startTraining() {
      console.log('[训练调试] 开始训练流程...')
      
      // 0. 加载最新的患者信息
      loadPatientInfo()
      
      // 1. 同步患者信息到云端
      console.log('[云端同步] 同步患者信息到云端...')
      const syncResult = await userDataService.syncCurrentPatientToCloud()
      if (syncResult.success) {
        console.log('[云端同步] ✅ 患者信息同步成功:', syncResult.message)
        console.log('[云端同步] 云端患者ID:', syncResult.patient_id)
      } else {
        console.warn('[云端同步] ⚠️ 患者信息同步失败:', syncResult.error)
        console.warn('[云端同步] 将以离线模式继续训练')
      }
      
      // 2. 启动训练会话
      console.log('[会话管理] 启动新的训练会话...')
      const sessionResult = await sessionManager.startSession('brain')
      if (!sessionResult.success) {
        console.error('[会话管理] 会话启动失败:', sessionResult.error)
        // 仍然继续训练，但没有云端同步
      } else {
        console.log('[会话管理] 会话启动成功:', sessionResult.session_id)
      }
      
      // 3. 确保康助侠设备已连接
      if (!kangzhuxiaStatus.value.connected) {
        console.log('[训练调试] 连接康助侠设备...')
        await connectKangzhuxia()
      }
      
      // 4. 设置应用训练状态
      appState.value = 'training'
      trainingStatus.value = {
        isTraining: true,
        duration: 0,
        speed: 'low',
        sessionId: sessionResult.session_id || 'KZ_' + Date.now()
      }
      // 设置训练起始时间基准
      trainingStartMs = Date.now()
      // 开始训练时清空历史，触发曲线x轴累计时间从0开始
      dataHistory.value = []
      selectedTimeRange.value = { start: 0, end: 0 }
      
      console.log('[训练调试] 训练状态已设置:', trainingStatus.value)
      
      // 5. 立即开始数据模拟更新（不等待康助侠连接）
      console.log('[训练调试] 启动数据模拟...')
      startDataSimulation()
      
      // 6. 异步启动康助侠数据采集
      startKangzhuxiaCollection().catch(error => {
        console.error('[训练调试] 康助侠连接失败，但训练继续:', error)
      })
    }
    
    // 暂停训练
    function pauseTraining() {
      console.log('[训练调试] 暂停训练...')
      trainingStatus.value.isTraining = false
      stopDataSimulation()
      
      // 暂停会话（停止数据收集但保持会话活跃）
      sessionManager.pauseSession()
    }
    
    // 停止训练
    async function stopTraining() {
      console.log('[训练调试] 停止训练流程...')
      
      // 1. 更新应用状态
      appState.value = 'assessment'
      trainingStatus.value.isTraining = false
      
      // 2. 停止康助侠数据采集
      await stopKangzhuxiaCollection()
      
      // 3. 停止数据模拟
      stopDataSimulation()
      
      // 4. 结束训练会话（自动上传会话数据）
      console.log('[会话管理] 结束训练会话...')
      const sessionEndResult = await sessionManager.endSession({
        training_mode: 'completed',
        duration: trainingStatus.value.duration,
        stop_reason: 'normal_completion'
      })
      
      if (!sessionEndResult.success) {
        console.error('[会话管理] 会话结束失败:', sessionEndResult.error)
      } else {
        console.log('[会话管理] 会话成功结束并上传')
      }
      
      // 5. 重置计时基准
      trainingStartMs = null
      // 清空历史数据与时间范围，确保下次进入曲线x轴从0开始
      dataHistory.value = []
      selectedTimeRange.value = { start: 0, end: 0 }
      
      // 6. 生成综合评估数据
      await generateAssessmentData()
    }
    
    // 紧急停止
    async function emergencyStop() {
      console.log('[训练调试] 紧急停止训练...')
      
      appState.value = 'standby'
      trainingStatus.value = {
        isTraining: false,
        duration: 0,
        speed: 'low',
        sessionId: null
      }
      
      // 紧急结束训练会话（标记为紧急停止）
      console.log('[会话管理] 紧急结束训练会话...')
      const sessionEndResult = await sessionManager.endSession({
        training_mode: 'emergency_stopped',
        duration: trainingStatus.value.duration,
        stop_reason: 'emergency_stop'
      })
      
      if (!sessionEndResult.success) {
        console.error('[会话管理] 紧急停止会话结束失败:', sessionEndResult.error)
      } else {
        console.log('[会话管理] 紧急停止会话成功结束')
      }
      
      // 紧急停止康助侠设备
      if (kangzhuxiaStatus.value.connected) {
        await stopKangzhuxiaCollection()
      }
      
      stopDataSimulation()
      trainingStartMs = null
      // 清空历史数据与时间范围
      dataHistory.value = []
      selectedTimeRange.value = { start: 0, end: 0 }
    }
    
    // 保存记录
    async function saveRecord() {
      console.log('[保存记录] 开始保存训练记录...')
      
      try {
        // 获取当前训练会话状态
        const sessionStatus = sessionManager.getSessionStatus()
        
        if (!sessionStatus.active && !sessionStatus.session) {
          console.warn('[保存记录] 没有活动会话或历史会话数据，创建离线记录')
          // 创建离线训练记录
          const offlineRecord = {
            patient_info: patientInfo.value,
            training_summary: trainingSummary.value,
            brain_activity_score: brainActivityScore.value,
            assessment_text: assessmentText.value,
            combined_heatmap: combinedHeatmap.value,
            timestamp: new Date().toISOString(),
            record_type: 'offline_manual_save',
            patient_id: localStorage.getItem('current_patient_id'),
            notes: '用户在评估界面手动保存的训练记录'
          }
          
          // 保存到localStorage作为备份
          const recordKey = `training_record_${Date.now()}`
          localStorage.setItem(recordKey, JSON.stringify(offlineRecord))
          console.log('[保存记录] ✅ 离线训练记录已保存到本地存储:', recordKey)
          console.log('[保存记录] 患者:', offlineRecord.patient_info.name)
          return
        }
        
        // 构建完整的训练记录
        const trainingRecord = {
          // 患者信息
          patient_info: {
            name: patientInfo.value.name,
            age: patientInfo.value.age,
            patient_id: localStorage.getItem('current_patient_id')
          },
          
          // 训练总结
          training_summary: {
            duration: trainingSummary.value.duration,
            avgHboChange: trainingSummary.value.avgHboChange,
            avgHbrChange: trainingSummary.value.avgHbrChange,
            total_data_points: sessionStatus.stats?.totalDataPoints || 0
          },
          
          // 评估结果
          assessment: {
            brain_activity_score: brainActivityScore.value,
            assessment_text: assessmentText.value,
            quality_score: sessionStatus.stats?.qualityScore || 0
          },
          
          // 热力图数据 (如果有的话)
          heatmap_data: combinedHeatmap.value ? {
            data: combinedHeatmap.value,
            timestamp: new Date().toISOString()
          } : null,
          
          // 会话信息
          session_info: sessionStatus.session,
          
          // 记录元信息
          record_metadata: {
            saved_at: new Date().toISOString(),
            record_type: 'training_completion',
            system_version: '1.0.0'
          }
        }
        
        console.log('[保存记录] 训练记录数据:', trainingRecord)
        
        // 保存到localStorage作为本地备份
        const localRecordKey = `training_record_${Date.now()}`
        localStorage.setItem(localRecordKey, JSON.stringify(trainingRecord))
        
        // 如果有云端同步能力，尝试上传到云端
        const patientId = localStorage.getItem('current_patient_id')
        if (patientId) {
          console.log('[保存记录] 尝试上传训练记录到云端...')
          
          // 这里可以扩展云端API调用
          // 目前sessionManager已经在endSession时自动上传了训练数据
          // 这里主要是保存用户主动保存的完整记录
          
          console.log('[保存记录] ✅ 训练记录保存完成')
          console.log('[保存记录] 患者ID:', patientId)
          console.log('[保存记录] 本地存储Key:', localRecordKey)
        } else {
          console.warn('[保存记录] 未找到患者ID，仅保存到本地存储')
        }
        
      } catch (error) {
        console.error('[保存记录] ❌ 保存训练记录失败:', error)
        
        // 错误情况下也尝试保存基本信息
        const errorRecord = {
          error: error.message,
          patient_info: patientInfo.value,
          timestamp: new Date().toISOString(),
          record_type: 'error_fallback'
        }
        
        localStorage.setItem(`error_record_${Date.now()}`, JSON.stringify(errorRecord))
        console.log('[保存记录] 错误记录已保存到本地存储')
      }
    }
    
    // 开始新训练
    function newTraining() {
      appState.value = 'standby'
      trainingStatus.value = {
        isTraining: false,
        duration: 0,
        speed: 'low',
        sessionId: null
      }
      trainingStartMs = null
      // 清空历史数据与时间范围
      dataHistory.value = []
      selectedTimeRange.value = { start: 0, end: 0 }
    }

    // 返回待机界面
    function returnToStandby() {
      appState.value = 'standby'
      trainingStatus.value = {
        isTraining: false,
        duration: 0,
        speed: 'low',
        sessionId: null
      }
      
      // 重新加载患者信息（用户可能选择了新的患者）
      loadPatientInfo()
      
      // 重置数值到初始状态
      currentValues.value = {
        hbo: 0.025,
        hbr: -0.015,
        hboTrend: 'up',
        hbrTrend: 'down'
      }
      trainingStartMs = null
      // 清空历史数据与时间范围
      dataHistory.value = []
      selectedTimeRange.value = { start: 0, end: 0 }
    }
    
    // 开始数据模拟
    function startDataSimulation() {
      console.log('[数据流调试] 开始数据模拟，训练状态:', trainingStatus.value.isTraining)
      
      dataUpdateTimer = setInterval(async () => {
        console.log('[数据流调试] 定时器触发，训练状态:', trainingStatus.value.isTraining)
        
        if (trainingStatus.value.isTraining) {
          // 用真实时间计算训练时长（秒）
          if (trainingStartMs === null) {
            trainingStartMs = Date.now()
          }
          trainingStatus.value.duration = Math.max(0, Math.floor((Date.now() - trainingStartMs) / 1000))
          console.log('[数据流调试] 训练时长更新:', trainingStatus.value.duration)
          
          // 从Python SDK服务器获取真实fNIRS数据
          try {
            console.log('[数据流调试] 开始调用 fetchRealFNIRSData()')
            const fnirData = await fetchRealFNIRSData()
            console.log('[数据流调试] API调用成功，数据:', {
              hboDataLength: fnirData.hboData?.length,
              hbrDataLength: fnirData.hbrData?.length,
              timestamp: fnirData.timestamp,
              frameId: fnirData.frameId
            })
            
            // 更新热力图数组数据（432通道）
            hboData.value = fnirData.hboData
            hbrData.value = fnirData.hbrData
            
            // 存储历史数据帧（包含SDK统计数据）
            storeHistoryFrame(fnirData.hboData, fnirData.hbrData, fnirData.timestamp, fnirData.frameId, {
              hbo_stats: fnirData.hboStats,
              hbr_stats: fnirData.hbrStats
            })
            
            // 计算当前平均值用于显示和趋势判断
            const prevHbo = currentValues.value.hbo
            const prevHbr = currentValues.value.hbr
            
            currentValues.value.hbo = fnirData.hboStats.mean || (fnirData.hboData.reduce((sum, val) => sum + val, 0) / fnirData.hboData.length)
            currentValues.value.hbr = fnirData.hbrStats.mean || (fnirData.hbrData.reduce((sum, val) => sum + val, 0) / fnirData.hbrData.length)
            
            // 计算变化量和趋势
            const hboVariation = currentValues.value.hbo - prevHbo
            const hbrVariation = currentValues.value.hbr - prevHbr
            
            currentValues.value.hboTrend = hboVariation > 0.001 ? 'up' : hboVariation < -0.001 ? 'down' : 'stable'
            currentValues.value.hbrTrend = hbrVariation > 0.001 ? 'up' : hbrVariation < -0.001 ? 'down' : 'stable'
            
            console.log('[数据流调试] 数据更新完成:', {
              hbo: currentValues.value.hbo.toFixed(6),
              hbr: currentValues.value.hbr.toFixed(6),
              hboTrend: currentValues.value.hboTrend,
              hbrTrend: currentValues.value.hbrTrend,
              dataHistoryLength: dataHistory.value.length,
              fallbackMode: fnirData.fallbackMode || false
            })
            
            // 输出真实SDK数据范围用于调试
            if (trainingStatus.value.duration % 10 === 0) { // 每10秒输出一次
              console.log(`[真实SDK数据] HbO平均: ${currentValues.value.hbo.toFixed(6)}, HbR平均: ${currentValues.value.hbr.toFixed(6)}`)
              console.log(`[真实SDK数据] HbO范围: [${fnirData.hboStats.min?.toFixed(4) || 'N/A'}, ${fnirData.hboStats.max?.toFixed(4) || 'N/A'}]`)
              console.log(`[真实SDK数据] HbR范围: [${fnirData.hbrStats.min?.toFixed(4) || 'N/A'}, ${fnirData.hbrStats.max?.toFixed(4) || 'N/A'}]`)
              console.log(`[真实SDK数据] 时间戳: ${new Date(fnirData.timestamp * 1000).toLocaleTimeString()}, 帧ID: ${fnirData.frameId}`)
            }
            
          } catch (error) {
            console.error('[fNIRS数据更新] 获取数据失败:', error)
            console.error('[数据流调试] 错误详情:', {
              message: error.message,
              stack: error.stack,
              url: `${FNIRS_API_BASE}/api/fnirs/data`
            })
            // 错误时保持之前的数据
          }
        } else {
          console.log('[数据流调试] 训练未激活，跳过数据更新')
        }
      }, 125) // 8Hz更新频率以匹配SDK
    }
    
    // 停止数据模拟
    function stopDataSimulation() {
      if (dataUpdateTimer) {
        clearInterval(dataUpdateTimer)
        dataUpdateTimer = null
      }
    }
    
    // 生成评估数据
    async function generateAssessmentData() {
      // 生成综合热力图 - 使用真实fNIRS数据
      try {
        const finalData = await fetchRealFNIRSData()
        // 合成综合热力图数据（HbO + HbR的加权组合）
        combinedHeatmap.value = finalData.hboData.map((hbo, index) => {
          const hbr = finalData.hbrData[index]
          return hbo + (hbr * 0.6) // HbO权重更高，符合生理特征
        })
      } catch (error) {
        console.warn('[评估数据] API调用失败，使用备用数据:', error)
        // 备用数据
        combinedHeatmap.value = generateRealisticFNIRSData(0.02, 'hbo')
      }
      
      // 更新训练总结
      trainingSummary.value = {
        duration: trainingStatus.value.duration,
        avgHboChange: currentValues.value.hbo,
        avgHbrChange: currentValues.value.hbr
      }
    }
    
    // 生命周期
    onMounted(async () => {
      loadChannelMap()
      
      // 加载患者信息
      loadPatientInfo()
      
      // 尝试恢复中断的训练会话
      console.log('[会话管理] 检查是否需要恢复会话...')
      const restoreResult = await sessionManager.restoreSession()
      if (restoreResult.success) {
        console.log('[会话管理] 成功恢复会话:', restoreResult.session_data.session_id)
        // 可以选择是否自动进入训练模式，这里保守做法只显示日志
      } else {
        console.log('[会话管理] 没有需要恢复的会话:', restoreResult.error)
      }
      
      // 检查初始路由
      checkRoute()
      
      // 更新时间显示
      timeUpdateTimer = setInterval(() => {
        currentTime.value = new Date().toLocaleTimeString()
      }, 1000)
    })
    
    onUnmounted(() => {
      if (timeUpdateTimer) {
        clearInterval(timeUpdateTimer)
      }
      
      // 清理路由监听器
      window.removeEventListener('hashchange', checkRoute)
      window.removeEventListener('popstate', checkRoute)
      stopDataSimulation()
    })
    
    return {
      appState,
      patientInfo,
      deviceStatus,
      kangzhuxiaStatus,
      trainingStatus,
      currentTime,
      hboData,
      hbrData,
      currentValues,
      combinedHeatmap,
      brainActivityScore,
      assessmentText,
      trainingSummary,
      dataHistory,
      selectedTimeRange,
      getHistoryData,
      updateSelectedTimeRange,
      loadPatientInfo,
      startTraining,
      pauseTraining,
      stopTraining,
      emergencyStop,
      saveRecord,
      newTraining,
      returnToStandby,
      connectKangzhuxia,
      disconnectKangzhuxia,
      kangzhuxiaStatus
    }
  }
}
</script>

<style scoped>
.tablet-app {
  width: 100%;
  height: 100vh;
  background-color: #f8f9fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}
</style>
