# StandbyView.vue 测试模式修改记录

## 修改位置
文件: ./src/components/StandbyView.vue
行数: 227-246

## 修改内容
在 onMounted() 中添加测试模式，跳过1-2步骤直接进入训练：

```javascript
// 【测试模式】直接跳过1-2步骤，快速进入训练
const isTestMode = true // 设为true跳过步骤，false恢复正常流程

if (isTestMode) {
  console.log('[测试模式] 直接跳过1-2步骤')
  stepCompleted.value.patientInfo = true
  stepCompleted.value.deviceCheck = true
  currentStep.value = 3
} else {
  // 原有逻辑...
}
```

## 还原方法
将 `const isTestMode = true` 改为 `const isTestMode = false` 即可恢复正常三步骤流程。

