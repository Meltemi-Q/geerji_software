# 报告生成

> 最后更新: 2025-11-28

## 1. 报告生成架构

```
┌─────────────────────────────────────────────────────┐
│                  MainWindow                          │
│                                                     │
│  report_generation_manager ◄──────────────────────┐ │
│        │                                          │ │
│        ▼                                          │ │
│  ┌─────────────────┐    ┌─────────────────┐      │ │
│  │ generate_mat_   │───►│ PDF 文件        │      │ │
│  │ report_cli()    │    └─────────────────┘      │ │
│  └─────────────────┘                              │ │
│        │                                          │ │
│        ▼                                          │ │
│  report_generation_completed ─────────────────────┘ │
│  report_generation_failed                           │
└─────────────────────────────────────────────────────┘
```

## 2. 报告生成管理器

### 2.1 创建

```python
from fnirs_app.processing.report_generation_manager import ReportGenerationManager
self.report_generation_manager = ReportGenerationManager(self)

# 连接信号
self.report_generation_manager.report_generation_completed.connect(
    self._handle_report_completed
)
self.report_generation_manager.report_generation_failed.connect(
    self._handle_report_failed
)
```

### 2.2 信号

| 信号 | 参数 | 说明 |
|-----|------|-----|
| `report_generation_completed` | `pdf_path: str` | 报告生成成功 |
| `report_generation_failed` | `error_msg: str` | 报告生成失败 |

## 3. 报告生成CLI

### 3.1 导入

```python
try:
    from report_generator_cli import generate_mat_report_cli
except ImportError:
    logger.error("无法导入 report_generator_cli.py")
    generate_mat_report_cli = None
```

### 3.2 调用

```python
# 由 report_generation_manager 内部调用
generate_mat_report_cli(
    mat_file_path,      # 输入MAT文件路径
    output_dir,         # 输出目录
    user_info           # 用户信息字典
)
```

## 4. 报告完成处理

### 4.1 成功处理

```python
def _handle_report_completed(self, pdf_path):
    """处理报告生成成功"""
    try:
        logger.info(f"报告生成成功: {pdf_path}")
        show_auto_close_message(self, "报告生成", 
            f"报告已生成: {os.path.basename(pdf_path)}", 1000)
        
        # 询问是否打开报告
        reply = QMessageBox.question(
            self,
            "报告生成成功",
            f"报告已生成:\n{pdf_path}\n\n是否立即打开报告？",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.Yes
        )
        
        if reply == QMessageBox.Yes:
            self._open_pdf(pdf_path)
            
    except Exception as e:
        logger.error(f"处理报告完成事件时发生错误: {e}")
```

### 4.2 打开PDF

```python
def _open_pdf(self, pdf_path):
    """使用系统默认PDF阅读器打开"""
    import subprocess
    import platform
    
    try:
        if platform.system() == 'Windows':
            os.startfile(pdf_path)
        elif platform.system() == 'Darwin':  # macOS
            subprocess.run(['open', pdf_path])
        else:  # Linux
            subprocess.run(['xdg-open', pdf_path])
    except Exception as e:
        logger.error(f"打开PDF文件失败: {e}")
        QMessageBox.warning(self, "打开失败", f"无法打开PDF文件: {e}")
```

### 4.3 失败处理

```python
def _handle_report_failed(self, error_msg):
    """处理报告生成失败"""
    try:
        logger.error(f"报告生成失败: {error_msg}")
        QMessageBox.warning(
            self,
            "报告生成失败",
            f"生成报告时发生错误:\n\n{error_msg}\n\n请检查数据完整性后重试。"
        )
    except Exception as e:
        logger.error(f"处理报告失败事件时发生错误: {e}")
```

## 5. 云服务报告上传

### 5.1 报告生成后上传

```python
def _handle_report_generated(self, generated_pdf_path, user_id_for_upload: int):
    """处理报告生成结果 - 委托给事件处理器"""
    return self.event_handler.handle_report_generated(generated_pdf_path, user_id_for_upload)
```

### 5.2 云服务模式下的流程

```
数据采集完成
    │
    ▼
stop_data_collection()
    │
    ├── 保存 MAT 文件
    │
    ├── is_cloud_service_mode? ──Yes──► 上传原始数据
    │                                   │
    │                                   ▼
    │                            handle_raw_data_ready()
    │                                   │
    │                                   ▼
    │                            生成报告 + 上传
    │
    └── No ──► 提示保存位置
```

## 6. 报告保存目录

```python
# 报告保存目录
self.save_dir = os.path.join(os.getcwd(), 'fnirs_reports')
os.makedirs(self.save_dir, exist_ok=True)
```

目录结构：
```
{cwd}/fnirs_reports/
├── report_20251128_143500.pdf
├── report_20251128_150000.pdf
└── ...
```

## 7. 事件处理器中的报告处理

### 7.1 上传结果处理

```python
def _handle_upload_result(self, upload_status: dict):
    """处理上传任务完成后的槽函数 - 委托给事件处理器"""
    return self.event_handler.handle_upload_result(upload_status)
```

## 8. 报告生成配置

报告生成可能涉及的配置参数（在 config.toml 中）：

```toml
[report]
output_dir = ""           # 报告输出目录 (空则使用默认)
template = "default"      # 报告模板
include_raw_data = false  # 是否包含原始数据
```

## 9. 报告内容

典型报告包含：
- 用户信息
- 测试时间和时长
- 信号质量评估
- HbO/HbR 时间序列图
- 事件标记
- 统计分析结果
