const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('=== 戈尔基康复训练系统页面布局测试 ===');
    
    // 设置视口大小
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    console.log('1. 正在访问页面 http://localhost:3001/');
    await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
    
    // 等待页面完全加载
    await page.waitForTimeout(3000);
    
    // 全屏截图
    console.log('2. 正在进行全屏截图...');
    await page.screenshot({ 
      path: 'screenshot-01-fullpage.png', 
      fullPage: true 
    });
    console.log('✅ 全屏截图保存为: screenshot-01-fullpage.png');
    
    // 视窗截图
    console.log('3. 正在进行视窗截图...');
    await page.screenshot({ 
      path: 'screenshot-02-viewport.png'
    });
    console.log('✅ 视窗截图保存为: screenshot-02-viewport.png');
    
    // 分析页面结构
    console.log('4. 分析页面结构...');
    const title = await page.title();
    console.log(`页面标题: ${title}`);
    
    // 检查是否存在底部白色区域问题
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    console.log(`页面总高度: ${bodyHeight}px, 视窗高度: ${viewportHeight}px`);
    
    // 查找基础信息按钮
    console.log('5. 查找基础信息按钮...');
    const infoButtonSelectors = [
      'text="基础信息"',
      'button:has-text("基础信息")',
      '[data-step="1"]',
      '.step-button:nth-child(1)'
    ];
    
    let foundButton = false;
    for (const selector of infoButtonSelectors) {
      try {
        const button = page.locator(selector).first();
        const isVisible = await button.isVisible({ timeout: 1000 });
        if (isVisible) {
          console.log(`✅ 找到基础信息按钮: ${selector}`);
          
          // 点击按钮
          await button.click();
          console.log('✅ 已点击基础信息按钮');
          
          // 等待模态框出现
          await page.waitForTimeout(2000);
          
          // 截图
          await page.screenshot({ path: 'screenshot-03-modal.png' });
          console.log('✅ 模态框截图保存为: screenshot-03-modal.png');
          
          foundButton = true;
          break;
        }
      } catch (error) {
        console.log(`❌ 选择器 ${selector} 无效`);
      }
    }
    
    if (!foundButton) {
      console.log('❌ 未找到基础信息按钮');
      // 打印页面上的所有按钮文本
      const buttons = await page.locator('button, [role="button"], .btn').all();
      console.log(`页面上共有 ${buttons.length} 个按钮:`);
      for (let i = 0; i < Math.min(buttons.length, 10); i++) {
        try {
          const text = await buttons[i].textContent();
          console.log(`  按钮${i+1}: "${text}"`);
        } catch (e) {
          console.log(`  按钮${i+1}: 无法获取文本`);
        }
      }
    }
    
    // 如果找到了模态框，尝试输入测试数据
    const modalSelectors = ['.modal', '.popup', '[role="dialog"]', '.patient-info-modal'];
    let modalFound = false;
    
    for (const selector of modalSelectors) {
      try {
        const modal = page.locator(selector).first();
        if (await modal.isVisible({ timeout: 1000 })) {
          console.log(`✅ 找到模态框: ${selector}`);
          modalFound = true;
          
          console.log('6. 尝试输入测试数据...');
          
          // 输入姓名
          try {
            await page.fill('input[placeholder*="姓名"], input[name*="name"]', '张三');
            console.log('✅ 姓名输入成功');
          } catch (e) {
            console.log('❌ 姓名输入失败');
          }
          
          // 输入年龄
          try {
            await page.fill('input[placeholder*="年龄"], input[name*="age"], input[type="number"]', '45');
            console.log('✅ 年龄输入成功');
          } catch (e) {
            console.log('❌ 年龄输入失败');
          }
          
          // 输入电话
          try {
            await page.fill('input[placeholder*="电话"], input[placeholder*="联系"], input[name*="phone"]', '12345678910');
            console.log('✅ 电话输入成功 (11位数字)');
          } catch (e) {
            console.log('❌ 电话输入失败');
          }
          
          await page.waitForTimeout(1000);
          await page.screenshot({ path: 'screenshot-04-form-filled.png' });
          console.log('✅ 表单填写截图保存为: screenshot-04-form-filled.png');
          
          break;
        }
      } catch (e) {
        // 继续尝试下一个选择器
      }
    }
    
    if (!modalFound) {
      console.log('❌ 未找到模态框');
    }
    
    console.log('=== 测试完成 ===');
    
  } catch (error) {
    console.error('测试过程中出现错误:', error.message);
    await page.screenshot({ path: 'screenshot-error.png' });
    console.log('✅ 错误截图保存为: screenshot-error.png');
  } finally {
    await browser.close();
  }
})();
