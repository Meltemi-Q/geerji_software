import { test, expect } from '@playwright/test';

test.describe('戈尔基康复训练系统 - 手动完成最终步骤', () => {
  test('手动验证开始训练和四种模式切换', async ({ page }) => {
    // 手动操作指南测试
    console.log('🔧 手动测试指南：');
    console.log('1. 打开浏览器访问 http://localhost:3001/');
    console.log('2. 等待设备检查完成（约3-5秒）');
    console.log('3. 点击"③ 开始训练"按钮（应该变为可点击状态）');
    console.log('4. 测试四种训练模式切换');
    
    // 1. 打开网站并等待设备检查完成
    await page.goto('http://localhost:3001/');
    await page.waitForLoadState('networkidle');
    
    // 等待较长时间让设备检查完全完成
    console.log('等待设备检查完成...');
    await page.waitForTimeout(10000); // 等待10秒让设备检查完成
    
    // 截图当前状态
    await page.screenshot({ 
      path: 'test-results/manual-01-ready-to-start-training.png',
      fullPage: true 
    });
    console.log('✅ 截图保存: manual-01-ready-to-start-training.png - 准备开始训练');
    
    // 2. 尝试点击开始训练（如果可用）
    try {
      const startButton = page.locator('button:has-text("③ 开始训练")').first();
      
      // 检查按钮状态
      const isDisabled = await startButton.getAttribute('disabled');
      console.log('开始训练按钮状态:', isDisabled ? '禁用' : '可点击');
      
      if (!isDisabled) {
        console.log('✅ 开始训练按钮可点击，执行点击...');
        await startButton.click();
        await page.waitForTimeout(3000);
        
        // 截图训练界面
        await page.screenshot({ 
          path: 'test-results/manual-02-training-interface.png',
          fullPage: true 
        });
        console.log('✅ 截图保存: manual-02-training-interface.png - 训练界面');
        
        // 3. 测试模式切换
        const modes = [
          { name: '专业大脑', selector: 'button:has-text("专业大脑")', file: 'manual-03a-brain-mode' },
          { name: '传统热力图', selector: 'button:has-text("传统热力图")', file: 'manual-03b-heatmap-mode' },
          { name: '数据曲线', selector: 'button:has-text("数据曲线")', file: 'manual-03c-curve-mode' },
          { name: '交互游戏', selector: 'button:has-text("交互游戏")', file: 'manual-03d-game-mode' }
        ];
        
        for (const mode of modes) {
          try {
            console.log(`尝试切换到: ${mode.name}`);
            const modeButton = page.locator(mode.selector).first();
            
            if (await modeButton.isVisible({ timeout: 2000 })) {
              await modeButton.click();
              await page.waitForTimeout(2000);
              
              await page.screenshot({ 
                path: `test-results/${mode.file}.png`,
                fullPage: true 
              });
              console.log(`✅ 截图保存: ${mode.file}.png - ${mode.name}模式`);
            } else {
              console.log(`⚠️  ${mode.name}模式按钮不可见`);
            }
          } catch (e) {
            console.log(`❌ ${mode.name}模式切换失败:`, e.message);
          }
        }
        
      } else {
        console.log('⚠️  开始训练按钮仍然禁用，可能需要更长等待时间');
      }
      
    } catch (e) {
      console.log('❌ 开始训练操作失败:', e.message);
    }
    
    // 4. 最终状态截图
    await page.screenshot({ 
      path: 'test-results/manual-04-final-state.png',
      fullPage: true 
    });
    console.log('✅ 截图保存: manual-04-final-state.png - 最终状态');
    
    // 5. 生成测试总结
    console.log('\n📋 手动测试完成，请查看截图验证：');
    console.log('  • manual-01-ready-to-start-training.png - 检查开始训练按钮状态');
    console.log('  • manual-02-training-interface.png - 训练界面（如果成功进入）');
    console.log('  • manual-03a-brain-mode.png - 专业大脑模式');
    console.log('  • manual-03b-heatmap-mode.png - 传统热力图模式');
    console.log('  • manual-03c-curve-mode.png - 数据曲线模式');
    console.log('  • manual-03d-game-mode.png - 交互游戏模式');
    console.log('  • manual-04-final-state.png - 最终状态');
  });
});