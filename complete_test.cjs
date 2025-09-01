const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('=== 戈尔基康复训练系统完整功能测试 ===');
    
    // 设置视口大小
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    console.log('1. 访问页面并检查布局');
    await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // 检查是否存在底部白色区域问题
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    console.log(`✅ 页面高度检查: 总高度=${bodyHeight}px, 视窗=${viewportHeight}px`);
    
    if (bodyHeight === viewportHeight) {
      console.log('✅ 没有发现底部白色区域问题');
    } else {
      console.log('⚠️  页面高度与视窗不匹配，可能存在底部空白');
    }
    
    await page.screenshot({ path: 'test-01-initial-page.png', fullPage: true });
    console.log('✅ 初始页面截图: test-01-initial-page.png');
    
    console.log('2. 点击基础信息按钮');
    const infoButton = page.locator('button:has-text("基础信息")').first();
    await infoButton.click();
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'test-02-modal-opened.png' });
    console.log('✅ 模态框打开截图: test-02-modal-opened.png');
    
    console.log('3. 输入测试数据');
    
    // 输入姓名
    await page.fill('input[placeholder*="姓名"]', '张三');
    console.log('✅ 姓名输入: 张三');
    
    // 输入年龄
    await page.fill('input[placeholder*="年龄"], input[type="number"]', '45');
    console.log('✅ 年龄输入: 45');
    
    // 输入电话号码（11位数字）
    await page.fill('input[placeholder*="联系电话"], input[placeholder*="联系"]', '12345678910');
    console.log('✅ 电话输入: 12345678910 (11位数字)');
    
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-03-form-filled.png' });
    console.log('✅ 表单填写截图: test-03-form-filled.png');
    
    console.log('4. 测试电话号码验证');
    
    // 点击下一步按钮测试验证
    const nextButton = page.locator('button:has-text("下一步")').first();
    if (await nextButton.isVisible()) {
      await nextButton.click();
      console.log('✅ 点击下一步按钮');
      
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-04-after-validation.png' });
      console.log('✅ 验证后截图: test-04-after-validation.png');
    }
    
    console.log('=== 测试完成 ===');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error.message);
    await page.screenshot({ path: 'test-error.png' });
    console.log('✅ 错误截图保存: test-error.png');
  } finally {
    await browser.close();
  }
})();
