# MainWindow 完整方法索引

> 最后更新: 2025-11-28
> 文件: geerji_fnirs_new.py

## 1. 初始化方法

| 方法 | 行号 | 说明 |
|-----|------|-----|
| `__init__(self, user_info=None)` | ~120 | 主窗口初始化，创建所有管理器和组件 |

## 2. 事件处理委托方法

这些方法都委托给 `self.event_handler` 处理：

| 方法 | 说明 |
|-----|-----|
| `on_data_updated()` | 数据模型数据更新 |
| `on_device_connected()` | 设备连接成功 |
| `on_device_disconnected()` | 设备断开连接 |
| `on_data_collection_started()` | 数据采集开始 |
| `on_data_collection_stopped()` | 数据采集停止 |
| `on_connection_error(error_message)` | 连接错误 |
| `on_ui_state_changed(state_name, value)` | UI状态变更 |
| `on_mode_changed(new_mode)` | 模式变更 |
| `on_error_occurred_new(error_type, error_message, error_details)` | 错误处理 |
| `on_critical_error(error_type, error_message)` | 严重错误 |
| `_handle_data_imported(info, data, file_path)` | 数据导入成功 |
| `_handle_import_cancelled()` | 数据导入取消 |
| `_handle_import_error(error_message)` | 数据导入错误 |
| `on_plot_updated(plot_type)` | 绑图更新 |
| `on_plot_error(error_type, error_message)` | 绑图错误 |
| `on_interface_mode_changed(mode)` | 界面模式变更 |
| `on_interface_updated(ui_type)` | 界面更新 |
| `on_app_config_changed(config_name, new_value)` | 应用配置变更 |
| `on_processing_params_changed(param_name, new_value)` | 处理参数变更 |
| `on_device_config_changed(config_name, new_value)` | 设备配置变更 |
| `on_processed_data_updated(data_type)` | 处理数据更新 |
| `_handle_new_user_detected(user_data)` | 检测到新用户 |
| `_handle_cloud_status_changed(status)` | 云服务状态改变 |
| `_handle_upload_result(upload_status)` | 上传完成 |
| `_handle_report_generated(pdf_path, user_id)` | 报告生成完成 |
| `on_signal_quality_clicked()` | 信号质量按钮点击 |
| `on_quality_option_selected()` | 质量选项选择 |

## 3. 报告生成方法

| 方法 | 说明 |
|-----|-----|
| `_handle_report_completed(pdf_path)` | 处理报告生成成功 |
| `_handle_report_failed(error_msg)` | 处理报告生成失败 |

## 4. UI模式方法

| 方法 | 说明 |
|-----|-----|
| `toggle_bright_mode()` | 切换明亮模式 |
| `enter_paradigm_fullscreen()` | 进入范式全屏 |
| `exit_paradigm_fullscreen()` | 退出范式全屏 |
| `show_channel_grid()` | 显示通道网格 |

## 5. 数据处理方法

| 方法 | 说明 |
|-----|-----|
| `process_nirs_data()` | 处理fNIRS数据（完整流水线） |
| `update_channel_grid()` | 更新通道网格显示 |
| `update_online_processed_data(processed_data)` | 更新在线处理数据 |
| `get_keep()` | 获取需要显示的通道掩码 |
| `select_plot_data()` | 选择绘图数据 |
| `handle_data_view(data_type)` | 处理数据视图切换 |

## 6. 范式测试方法

| 方法 | 说明 |
|-----|-----|
| `setup_test_canvas()` | 设置测试画布 |
| `setup_paradigm_test()` | 初始化范式测试系统（委托） |
| `show_paradigm_menu()` | 显示范式菜单（委托） |
| `handle_paradigm_completion()` | 范式完成处理 |

## 7. 设置与配置方法

| 方法 | 说明 |
|-----|-----|
| `setup_settings_menu()` | 设置菜单初始化（委托） |
| `show_settings_menu()` | 显示设置菜单（委托） |
| `setup_data_submenu()` | 设置数据子菜单（委托） |
| `clear_cache()` | 清除缓存（委托） |
| `open_settings()` | 设置按钮点击处理 |

## 8. 云服务方法

| 方法 | 说明 |
|-----|-----|
| `toggle_cloud_service()` | 切换云服务模式 |
| `is_cloud_service_mode` | 云服务模式状态（属性） |
| `current_server_user` | 当前服务器用户（属性） |
| `api_base_url` | API基础URL（属性） |

## 9. 信号质量方法

| 方法 | 说明 |
|-----|-----|
| `update_signal_quality(option=None)` | 更新信号质量显示 |

## 10. 采集控制方法

| 方法 | 说明 |
|-----|-----|
| `update_collection_buttons_state()` | 更新采集按钮状态 |
| `start_data_collection(silent=False)` | 开始数据采集 |
| `stop_data_collection(hardware_stop=True)` | 停止数据采集 |
| `start_recording()` | 开始录制 |
| `stop_recording()` | 停止录制 |

## 11. 用户管理方法

| 方法 | 说明 |
|-----|-----|
| `switch_user()` | 切换用户 |

## 12. 数据管理方法

| 方法 | 说明 |
|-----|-----|
| `clear_data()` | 清除所有数据 |
| `reset_session()` | 重置会话状态 |
| `check_data()` | 检查数据 |

## 13. 设备管理方法

| 方法 | 说明 |
|-----|-----|
| `handle_data(buffer, frame_count, node_list)` | 处理接收到的数据 |
| `handle_nodes_info(nodes_info)` | 处理节点扫描结果 |
| `handle_event(event_data)` | 处理事件数据 |
| `scan_nodes()` | 扫描设备节点（委托） |
| `add_device()` | 添加设备（委托） |
| `show_raw_data()` | 显示原始数据（委托） |
| `disconnect_device()` | 断开设备（委托） |
| `connect_device()` | 连接设备（委托） |
| `load_YSB_info()` | 加载YSB信息（委托） |

## 14. 绘图方法

| 方法 | 说明 |
|-----|-----|
| `update_plot()` | 更新绘图 |
| `update_plot_style()` | 更新绘图样式 |

## 15. 事件标记方法

| 方法 | 说明 |
|-----|-----|
| `add_event_marker_new(event_name)` | 添加事件标记 |

## 16. Info管理方法

| 方法 | 说明 |
|-----|-----|
| `update_info()` | 更新info信息 |
| `initialize_online_YSB(raw_info)` | 初始化OnlineYSB |
| `get_ndot_info()` | 获取ndot信息 |
| `initialization_completed()` | 初始化完成回调 |
| `handle_initialization_complete()` | 处理初始化完成 |

## 17. UI事件方法

| 方法 | 说明 |
|-----|-----|
| `button_clicked(button_text)` | 按钮点击处理 |
| `onBottomButtonClicked()` | 底部按钮点击 |
| `stop_dot_animation()` | 停止点动画 |

## 18. 窗口管理方法

| 方法 | 说明 |
|-----|-----|
| `toggle_maximize()` | 切换最大化（委托） |
| `toggle_fullscreen()` | 切换全屏（委托） |
| `resizeEvent(event)` | 窗口大小调整 |
| `paintEvent(event)` | 绘制事件（委托） |
| `mousePressEvent(event)` | 鼠标按下（委托） |
| `mouseMoveEvent(event)` | 鼠标移动（委托） |
| `mouseReleaseEvent(event)` | 鼠标释放（委托） |
| `event(event)` | 通用事件处理 |
| `closeEvent(event)` | 关闭事件 |

## 19. 实时模式方法

| 方法 | 说明 |
|-----|-----|
| `stop_real_time_mode()` | 停止实时模式 |

## 20. 功能控制方法

| 方法 | 说明 |
|-----|-----|
| `toggle_feature(feature_name)` | 切换功能开关 |

## 21. 文件操作方法

| 方法 | 说明 |
|-----|-----|
| `save_temp_data()` | 保存临时数据 |
| `save_complete_recording()` | 保存完整录制 |
| `cleanup_temp_files()` | 清理临时文件 |

## 22. 模块级函数

| 函数 | 说明 |
|-----|-----|
| `ensure_audio_pool_ready()` | 检查音频池完整性 |

## 23. 属性列表

### 状态属性
| 属性 | 类型 | 说明 |
|-----|------|-----|
| `is_collecting` | bool | 采集状态 |
| `is_online_mode` | bool | 在线模式 |
| `is_bright_mode_active` | bool | 明亮模式 |
| `is_paradigm_fullscreen_active` | bool | 范式全屏 |

### 数据属性
| 属性 | 类型 | 说明 |
|-----|------|-----|
| `data` | np.ndarray | 原始数据 |
| `display_data` | np.ndarray | 显示数据 |
| `info` | dict | 设备信息 |
| `event_markers` | list | 事件标记 |
| `hbo_data` | np.ndarray | HbO数据 |
| `hbr_data` | np.ndarray | HbR数据 |
| `user_info` | dict | 用户信息 |

### 硬件属性
| 属性 | 类型 | 说明 |
|-----|------|-----|
| `ser` | Serial | 串口对象 |
| `receiver` | YSBReceiver | 接收器 |
| `receiver_thread` | QThread | 接收线程 |

### 参数属性
| 属性 | 默认值 | 说明 |
|-----|-------|-----|
| `sample_rate` | 8 | 采样率 |
| `framerate` | 8 | 帧率 |
| `wavelengths` | [735, 850] | 波长 |
| `frame_count` | 0 | 帧计数 |

### 路径属性
| 属性 | 说明 |
|-----|-----|
| `temp_dir` | 临时文件目录 |
| `save_dir` | 保存目录 |

## 24. 管理器引用

| 管理器 | 类型 | 说明 |
|-------|------|-----|
| `ui_initialization_manager` | UIInitializationManager | UI初始化 |
| `plot_visualization_manager` | PlotVisualizationManager | 绘图可视化 |
| `window_manager` | WindowManager | 窗口管理 |
| `business_logic_manager` | BusinessLogicManager | 业务逻辑 |
| `configuration_manager` | ConfigurationManager | 配置管理 |
| `cloud_service_manager` | CloudServiceManager | 云服务 |
| `data_import_manager` | DataImportManager | 数据导入 |
| `ui_event_manager` | UIEventManager | UI事件 |
| `report_generation_manager` | ReportGenerationManager | 报告生成 |
| `data_init_manager` | DataInitializationManager | 数据初始化 |
| `device_controller` | DeviceController | 设备控制 |
| `processing_pipeline` | DataProcessingPipeline | 处理流水线 |
| `data_model` | FNIRSDataModel | 数据模型 |
| `data_processing_methods` | DataProcessingMethods | 处理方法 |
| `event_handler` | MainWindowEventHandler | 事件处理 |
| `ui_manager` | UIManager | UI管理 |
| `plot_manager` | PlotManager | 绘图管理 |
| `interface_manager` | InterfaceManager | 界面管理 |
| `data_sync_helper` | DataSyncHelper | 数据同步 |
| `error_handler` | ErrorHandler | 错误处理 |
| `event_connection_manager` | EventConnectionManager | 事件连接 |
| `paradigm_controller` | ParadigmTestController | 范式控制 |
