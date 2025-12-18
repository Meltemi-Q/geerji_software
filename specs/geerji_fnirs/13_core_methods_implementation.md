# 核心方法完整实现

> 最后更新: 2025-11-28
> 
> 本文档记录 MainWindow 中所有关键方法的**完整代码实现**，便于 AI 理解和修改。

---

## 1. start_data_collection - 开始采集

**位置**: 约 1331 行

```python
def start_data_collection(self, silent: bool = False):
    """开始数据采集
    
    参数:
        silent: 是否静默模式（不显示提示消息）
    
    流程:
        1. 显示提示消息
        2. 设置采集状态
        3. 记录会话起始帧
        4. 创建分段保存目录
        5. 清理历史分段文件（关键优化点）
        6. 启动分段保存定时器
        7. 创建报告保存目录
        8. 添加 start 事件标记
        9. 更新UI按钮状态
    """
    if not silent:
        show_auto_close_message(self, "开始采集", "开始采集数据")
    
    self.is_collecting = True
    self.start_time = time.time()  # 记录开始时间
    
    # 记录本次会话起始帧，用于结束时判断是否有新数据
    try:
        self.session_start_frame = int(getattr(self, "frame_count", 0) or 0)
    except Exception:
        self.session_start_frame = 0

    # 分段保存目录（按用户分组：%USERPROFILE%/.golgi/data/<user_name> 或配置 write.temp_dir/<user_name>）
    try:
        from fnirs_app.processing.file_operations import create_temp_directory_for_user
        uname = str((getattr(self, 'user_info', {}) or {}).get('name', '')).strip()
        self.temp_dir = create_temp_directory_for_user(uname)
    except Exception:
        base_dir = os.path.join(os.path.expanduser('~'), '.golgi', 'data')
        try:
            os.makedirs(base_dir, exist_ok=True)
        except Exception:
            pass
        self.temp_dir = base_dir

    # 清理历史遗留的分段文件，避免首次结束采集时一次性合并大量旧数据导致卡顿
    try:
        from fnirs_app.processing.file_operations import cleanup_temp_files
        cleanup_temp_files(self.temp_dir)
        logger.info("start_data_collection: 已清理历史分段文件 %s", self.temp_dir)
    except Exception as e:
        logger.warning("start_data_collection: 清理历史分段文件失败: %s", e)

    # 启动分段保存定时器（间隔在 DataInitializationManager 中按 write.segment_minutes 初始化）
    try:
        if hasattr(self, 'temp_save_timer'):
            self.temp_save_timer.start(self.temp_save_interval * 1000)
    except Exception:
        pass

    self.save_dir = os.path.join(os.getcwd(), 'fnirs_reports')
    os.makedirs(self.save_dir, exist_ok=True)

    self.add_event_marker_new('start')

    # 更新底部按钮高亮状态
    self.update_collection_buttons_state()
```

---

## 2. stop_data_collection - 停止采集

**位置**: 约 1399 行

```python
def stop_data_collection(self, *, hardware_stop: bool = True):
    """停止数据采集并保存数据

    参数:
        hardware_stop:
            - True: 同时向设备发送停止命令并停止接收线程（用于"结束采集"按钮、范式结束等场景）
            - False: 仅结束本次会话并保存数据，不触碰底层硬件（用于"切换用户"等需要连续采集的场景）
    
    流程:
        1. 添加 stop 事件标记
        2. 显示提示消息，设置 is_collecting = False
        3. 停止分段保存定时器
        4. 根据 hardware_stop 决定是否停止硬件
        5. 计算采集时长
        6. 计算本次会话新增帧数
        7. 获取数据源
        8. 判断是否有有效数据
        9. 合并分段文件生成 MAT
        10. 兜底保存（如果合并失败）
        11. 云服务模式下上传
        12. 重置状态
        13. 会话级停止时 reset_session
    """
    # 添加 stop 事件标记
    if not self.is_collecting and not self.event_markers:
        logger.info("Not collecting and no events, skipping stop marker.")
    elif not self.event_markers or self.event_markers[-1][1] != 'stop':
        self.add_event_marker_new('stop')
        logger.info('Added stop event marker.')

    try:
        if self.is_collecting:
            show_auto_close_message(self, "结束采集", "结束采集数据")
            self.is_collecting = False

            # 停止分段保存定时器
            try:
                if hasattr(self, 'temp_save_timer') and self.temp_save_timer.isActive():
                    self.temp_save_timer.stop()
            except Exception:
                pass

            # 根据需要决定是否真正向设备发送停止命令
            if hardware_stop:
                if self.ser:
                    shut = bytes([0x01, 0x00, 0x04, 0x00, 0x00, 0x04, 0x04])
                    self.ser.write(shut)
                    logger.info("Sent stop command to device.")

                if self.receiver:
                    self.receiver.stop()
                if self.receiver_thread and self.receiver_thread.isRunning():
                    self.receiver_thread.quit()
                    self.receiver_thread.wait()

            self.end_time = time.time()
            self.duration = self.end_time - self.start_time if hasattr(self, 'start_time') else 0
            logger.info(f"数据采集持续时间: {self.duration:.2f} 秒")

            # 本次会话新增的帧数
            try:
                start_frame = int(getattr(self, "session_start_frame", 0) or 0)
            except Exception:
                start_frame = 0
            try:
                delta_frames = max(0, int(getattr(self, "frame_count", 0) or 0) - start_frame)
            except Exception:
                delta_frames = 0

            # 选择内存数据源
            src = getattr(self, 'data', None)
            if src is None:
                src = getattr(self, 'display_data', None)
            if src is None and hasattr(self, 'data_model'):
                src = getattr(self.data_model, '_data', None)

            # 若本次会话没有新增帧或数据源为空，跳过保存
            if delta_frames <= 0 or src is None:
                logger.info("stop_data_collection: 本次采集无有效数据(delta_frames=%d)，跳过保存。", delta_frames)
                try:
                    show_auto_close_message(self, "数据未保存", "本次采集无有效数据，已跳过保存。", 1000)
                except Exception:
                    pass
                self.is_collecting = False
                self.update_collection_buttons_state()
                return True

            # 合并临时片段生成最终数据
            mat_file_path = None
            try:
                from fnirs_app.processing.file_operations import save_complete_recording
                mat_file_path = save_complete_recording(
                    self.temp_dir,
                    getattr(self, 'recording_buffer', []),
                    self.info,
                    self.event_markers
                )
                try:
                    self.cleanup_temp_files()
                except Exception:
                    pass
            except Exception as e:
                logger.error(f"合并片段失败: {e}")
                mat_file_path = None

            # 兜底保存
            if not mat_file_path:
                try:
                    user_dir = os.path.dirname(self.temp_dir.rstrip("/\\"))
                    if os.path.basename(self.temp_dir.rstrip("/\\")).lower() in ('.segments', 'segments', '.tmp', '.npy'):
                        user_dir = os.path.dirname(self.temp_dir.rstrip("/\\"))
                    os.makedirs(user_dir, exist_ok=True)
                    filename = f"rawdata_{time.strftime('%Y%m%d_%H%M%S')}.mat"
                    mat_file_path = os.path.join(user_dir, filename)

                    # 仅截取本次会话的尾部数据
                    src_session = src
                    try:
                        if isinstance(src, np.ndarray) and src.ndim == 2 and delta_frames > 0:
                            frames_in_buffer = src.shape[1]
                            frames_to_take = min(int(delta_frames), frames_in_buffer)
                            if frames_to_take > 0:
                                start_rel = max(0, frames_in_buffer - frames_to_take)
                                src_session = src[:, start_rel:]
                    except Exception as e:
                        src_session = src

                    # 数据清洗函数（内联定义）
                    def _sanitize_for_mat(x):
                        if x is None:
                            return ''
                        if isinstance(x, dict):
                            return {k: _sanitize_for_mat(v) for k, v in x.items()}
                        if isinstance(x, (list, tuple)):
                            return [_sanitize_for_mat(v) for v in x]
                        if isinstance(x, np.ndarray):
                            if x.dtype == object:
                                return np.array([_sanitize_for_mat(v) for v in x], dtype=object)
                            return x
                        return x

                    def _sanitize_events(evts):
                        if not evts:
                            return []
                        pairs = []
                        for e in evts:
                            try:
                                ts, name = e[0], e[1]
                            except Exception:
                                continue
                            try:
                                ts = float(ts) if ts is not None else np.nan
                            except Exception:
                                ts = np.nan
                            name = '' if name is None else str(name)
                            pairs.append([ts, name])
                        return np.array(pairs, dtype=object)

                    # 转换为 float32 并压缩
                    try:
                        data_to_save_data = np.ascontiguousarray(src_session).astype(np.float32, copy=False)
                    except Exception:
                        data_to_save_data = src_session
                    
                    data_to_save = {
                        'data': data_to_save_data,
                        'info': _sanitize_for_mat(self.info),
                        'duration': self.duration,
                        'events': _sanitize_events(self.event_markers)
                    }
                    savemat(mat_file_path, data_to_save, do_compression=True)
                    logger.info(f"数据已保存到: {mat_file_path}")
                except Exception as e:
                    logger.error(f"直接保存内存数据失败: {e}", exc_info=True)

            # 云服务模式下自动上传
            if self.is_cloud_service_mode and self.current_server_user and mat_file_path:
                meta = {
                    'name': self.current_server_user.get('name', ''),
                    'age': self.current_server_user.get('age', ''),
                    'gender': self.current_server_user.get('gender', '')
                }
                try:
                    show_auto_close_message(self, "云端上传", "正在上传原始数据到云端...", 2000)
                except Exception:
                    pass
                try:
                    self.cloud_service_manager.handle_raw_data_ready(
                        raw_file_path=mat_file_path,
                        user_id_for_upload=int(self.current_server_user.get('id')),
                        duration_seconds=int(self.duration) if hasattr(self, 'duration') else None,
                        threadpool=self.threadpool,
                        upload_result_callback=self.event_handler.handle_upload_result,
                        metadata=meta
                    )
                except Exception as e:
                    logger.error(f"原始数据上传调度失败: {e}")
            else:
                try:
                    show_auto_close_message(self, "数据已保存", f"数据已保存到: {mat_file_path}", 3000)
                except Exception:
                    pass

            # 重置状态
            self.is_collecting = False
            logger.info("数据采集已停止，状态已重置（hardware_stop=%s）", hardware_stop)
            self.update_collection_buttons_state()

            # 会话级停止时重置会话状态
            if not hardware_stop:
                try:
                    self.reset_session()
                except Exception as e:
                    logger.info("stop_data_collection: reset_session 失败: %s", e, exc_info=True)

            # 云服务模式下返回范式菜单
            if self.is_cloud_service_mode and hasattr(self, 'paradigm_controller') and self.paradigm_controller.current_stage:
                logger.info("云服务模式下，范式结束，返回到范式菜单")
                QTimer.singleShot(1000, lambda: self.show_paradigm_menu())
        
        else:
            # 未处于采集中的兜底处理
            if hasattr(self, 'temp_save_timer') and self.temp_save_timer.isActive():
                try:
                    self.temp_save_timer.stop()
                except Exception:
                    pass
            if hardware_stop and self.ser:
                shut = bytes([0x01, 0x00, 0x04, 0x00, 0x00, 0x04, 0x04])
                self.ser.write(shut)
                logger.info("Sent stop command to device.")

            # 兜底保存（与上面类似，省略重复代码）
            # ...

    except Exception as e:
        logger.error(f"保存数据时发生错误: {e}")
        try:
            QMessageBox.warning(self, "保存失败", f"保存数据时发生错误: {e}")
        except Exception:
            pass
```

---

## 3. handle_data - 处理接收到的数据

**位置**: 约 1030 行

```python
def handle_data(self, buffer, frame_count, node_list):
    """处理实时采集到的一帧数据
    
    参数:
        buffer: 环形缓冲区数据 (numpy array)
        frame_count: 当前帧计数
        node_list: 当前在线节点列表
    
    流程:
        1. 处理循环缓冲区解卷绕
        2. 使用数据模型更新数据
        3. 同步到原有属性
        4. 节点拓扑变更检测与去抖重建
        5. 初始化 info（如果为空）
        6. 定期垃圾回收
    """
    # 处理循环缓冲区：如果 frame_count 超过缓冲区大小，需要解卷绕
    max_len = buffer.shape[0]
    if frame_count <= max_len:
        raw = buffer[:frame_count]
    else:
        # 缓冲区已回绕，按时间顺序拼接
        idx = frame_count % max_len
        raw = np.concatenate((buffer[idx:], buffer[:idx]), axis=0)
        
    raw_data = raw.T  # 转置为 (channels, frames)

    # 使用数据模型的统一更新方法
    self.data_model.update_data_with_processing(raw_data, frame_count)

    # 保持兼容性 - 同步到原有属性
    self.data = self.data_model.data
    self.frame_count = self.data_model.frame_count
    self.display_data = self.data_model.display_data

    # 节点拓扑变更检测与去抖重建 info
    try:
        current_nodes_set = frozenset(node_list)
        current_nodes_list = list(node_list)
        
        if self._last_node_list_set is None:
            # 首次初始化
            self._last_node_list_set = current_nodes_set
            self._pending_node_list = current_nodes_list
            self._pending_change_count = 0
        elif current_nodes_set != self._last_node_list_set:
            # 检测到变化
            if self._pending_node_list == current_nodes_list:
                self._pending_change_count += 1
            else:
                self._pending_node_list = current_nodes_list
                self._pending_change_count = 1
            
            # 达到确认阈值且超过最小间隔才重建
            if (self._pending_change_count >= self._node_change_confirm_frames and
                    (self.frame_count - self._last_info_rebuild_frame) >= self._node_rebuild_min_interval):
                from fnirs_app.data_handling.data_types import init_PCcount_info
                self.info = init_PCcount_info(self._pending_node_list)
                self._last_node_list_set = current_nodes_set
                self._last_info_rebuild_frame = self.frame_count
                
                # 清理缓存以触发按新拓扑重建
                self.hbo_data = None
                self.hbr_data = None
                if hasattr(self, 'channel_grid_view'):
                    try:
                        self.channel_grid_view.reset()
                    except Exception:
                        pass
    except Exception:
        pass

    # 在线模式下若 info 为空，构造最小 info
    if self.info is None and self.data is not None:
        from fnirs_app.data_handling.data_types import init_PCcount_info
        self.info = init_PCcount_info(node_list)
        try:
            self._last_node_list_set = frozenset(node_list)
        except Exception:
            pass

    # 定期垃圾回收
    self.gc_counter += 1
    if self.gc_counter > 100:
        self.gc_counter = 0
        gc.collect()
```

---

## 4. process_nirs_data - 数据处理流水线

**位置**: 约 598 行

```python
def process_nirs_data(self):
    """处理fNIRS数据 - 完整处理流水线
    
    流程:
        1. 获取波长信息
        2. 处理3波长/2波长情况
        3. 光强度 → 光密度
        4. 光密度 → 浓度 (HbO/HbR)
        5. TDDR运动伪迹校正（可选）
        6. FFT带通滤波
    
    返回:
        dict: {'HbO': hbo_data, 'HbR': hbr_data}
    """
    # 获取波长信息
    self.wavelengths = np.unique(self.info['pairs']['lamda'])
    
    if len(self.wavelengths) == 3:
        # 3波长情况：只取第1和第3波长
        self.wavelengths = [self.wavelengths[0], self.wavelengths[2]]
        channels_per_wavelength = self.data.shape[0] // 3
        data = np.vstack([
            self.data[:channels_per_wavelength],
            self.data[2*channels_per_wavelength:]
        ])
        od_data = intensity2optical_density(data)

    elif len(self.wavelengths) == 2:
        od_data = intensity2optical_density(self.data)
    else:
        raise ValueError("波长数量不正确")

    # 光密度 → 浓度
    ppf = [6, 6]  # 部分路径因子
    conc_data = od2conc(od_data, self.wavelengths, self.info, ppf)

    # TDDR运动伪迹校正（可配置，默认关闭）
    try:
        tddr_enabled = bool(get_param('processing.tddr_enabled', False))
    except Exception:
        tddr_enabled = False
    
    if tddr_enabled:
        hbo_data = TDDR_motion_correction(conc_data['HbO'], 10)
        hbr_data = TDDR_motion_correction(conc_data['HbR'], 10)
    else:
        hbo_data = conc_data['HbO']
        hbr_data = conc_data['HbR']

    # 滤波参数
    filter_method = 'FFT'
    filter_model = 3  # 带通滤波
    filter_order = None
    sample_rate = self.sample_rate
    
    try:
        bp = get_param('processing.bandpass_hz', [0.01, 0.08]) or [0.01, 0.08]
        low_hz = float(bp[0])
        high_hz = float(bp[1])
        if low_hz <= 0 or high_hz <= 0 or low_hz >= high_hz:
            low_hz, high_hz = 0.01, 0.08
    except Exception:
        low_hz, high_hz = 0.01, 0.08
    
    hpf = low_hz / sample_rate
    lpf = high_hz / sample_rate

    # FFT带通滤波 (0.01-0.08 Hz)
    processed_data = nr_filter(
        {'HbO': hbo_data, 'HbR': hbr_data},
        filter_method=filter_method,
        filter_model=filter_model,
        filter_order=filter_order,
        hpf=hpf,
        lpf=lpf,
        sample_rate=sample_rate
    )

    return processed_data
```

---

## 5. switch_user - 切换用户

**位置**: 约 750 行

```python
def switch_user(self):
    """切换当前登录用户
    
    流程:
        1. 检查是否有正在进行的采集或范式
        2. 如有，询问用户是否结束并保存
        3. 清除当前用户信息
        4. 清空云端绑定用户
        5. 弹出用户信息窗口
        6. 保存新用户信息
        7. 云服务模式下同步新用户
    """
    from PySide6.QtWidgets import QMessageBox

    # 1. 检查是否有正在进行的采集或范式
    is_collecting = bool(getattr(self, "is_collecting", False))
    paradigm_active = False
    try:
        if hasattr(self, "paradigm_controller") and self.paradigm_controller:
            stage = getattr(self.paradigm_controller, "current_stage", None)
            if stage not in (None, "instruction", "test_complete"):
                paradigm_active = True
    except Exception as e:
        logger.info("switch_user: 检查范式状态失败: %s", e, exc_info=True)

    if is_collecting or paradigm_active:
        msg = (
            "当前正在采集或进行范式，切换用户前需要结束当前会话并保存数据。\n"
            "是否立即结束并保存？"
        )
        reply = QMessageBox.question(
            self,
            "切换用户",
            msg,
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        )
        if reply != QMessageBox.Yes:
            return

        # 尝试结束范式和采集
        if paradigm_active and hasattr(self, "paradigm_controller"):
            try:
                if hasattr(self, "add_event_marker_new"):
                    self.add_event_marker_new("force_end")
            except Exception as e:
                logger.info("switch_user: 添加 force_end 标记失败: %s", e, exc_info=True)
            try:
                self.paradigm_controller.cleanup_experiment_state()
            except Exception as e:
                logger.info("switch_user: 清理范式状态失败: %s", e, exc_info=True)

        if is_collecting:
            try:
                self.stop_data_collection(hardware_stop=False)
            except Exception as e:
                logger.info("switch_user: 停止采集失败: %s", e, exc_info=True)

    # 2. 清除当前用户信息
    try:
        from fnirs_app.core.user_info_manager import get_user_manager
        user_manager = get_user_manager()
        user_manager.clear_current_user()
    except Exception as e:
        logger.info("switch_user: 清除本地用户信息失败: %s", e, exc_info=True)

    self.user_info = {}
    try:
        if hasattr(self, "title_bar"):
            self.title_bar.update_user_info(self.user_info)
    except Exception as e:
        logger.info("switch_user: 更新标题栏用户信息失败: %s", e, exc_info=True)

    # 清空云端当前绑定用户
    try:
        if hasattr(self, "cloud_service_manager") and self.cloud_service_manager:
            self.cloud_service_manager.current_server_user = None
    except Exception as e:
        logger.info("switch_user: 清空 cloud current_server_user 失败: %s", e, exc_info=True)

    # 3. 弹出新的用户信息窗口
    try:
        from fnirs_app.ui.user_info_window import UserInfoWindow
        dlg = UserInfoWindow(parent=self)
        if dlg.exec() != UserInfoWindow.Accepted:
            logger.info("switch_user: 用户取消重新登录")
            return
        new_user_info = dlg.get_user_info() or {}
    except Exception as e:
        logger.error("switch_user: 打开用户信息窗口失败: %s", e, exc_info=True)
        return

    # 4. 保存新用户信息
    try:
        from fnirs_app.core.user_info_manager import get_user_manager
        user_manager = get_user_manager()
        ok = user_manager.save_user_info(
            new_user_info.get("name", ""),
            new_user_info.get("gender", ""),
            int(new_user_info.get("age", 0) or 0),
            new_user_info.get("external_id"),
        )
        if not ok:
            QMessageBox.warning(self, "切换用户失败", "保存新用户信息失败，请重试。")
            return

        full_info = user_manager.get_current_user() or new_user_info
        self.user_info = {
            "id": full_info.get("id"),
            "name": full_info.get("name"),
            "gender": full_info.get("gender"),
            "age": full_info.get("age"),
            "external_id": full_info.get("external_id"),
        }
        if hasattr(self, "title_bar"):
            self.title_bar.update_user_info(self.user_info)
    except Exception as e:
        logger.error("switch_user: 保存/更新新用户信息失败: %s", e, exc_info=True)
        return

    # 5. 云服务模式下同步新用户
    try:
        if self.is_cloud_service_mode:
            self.cloud_service_manager.current_server_user = None
            self.cloud_service_manager.sync_local_user_to_server(self.user_info)
    except Exception as e:
        logger.info("switch_user: 同步新用户到云端失败: %s", e, exc_info=True)
```

---

## 6. clear_data - 清除所有数据

**位置**: 约 883 行

```python
def clear_data(self):
    """清除所有数据和相关状态（统一入口）
    
    流程:
        1. 使用数据模型清除数据
        2. 清除主窗口的数据属性
        3. 清除绑图
        4. 重置状态
        5. 更新UI
    """
    # 1. 使用数据模型清除数据（包含事件与缓存）
    if hasattr(self, "data_model") and self.data_model is not None:
        try:
            self.data_model.clear_all_data()
        except Exception as e:
            logger.info("clear_data: data_model.clear_all_data() 失败: %s", e, exc_info=True)

    # 2. 同步清除原有属性
    self.data = None
    self.display_data = None
    self.info = None
    self.online_data = []
    self.online_info = None
    self.lmdata = None
    self.ddata = None
    self.lp2data = None
    self.hbo_data = None
    self.hbr_data = None
    self.hbt_data = None
    self.YSB_file_path = None
    self.event_markers = []  # 关键：清空事件标记

    # 3. 清除绑图
    if hasattr(self, "plot_widget") and self.plot_widget is not None:
        try:
            self.plot_widget.clear()
            if hasattr(self.plot_widget, "replot"):
                self.plot_widget.replot()
        except Exception as e:
            logger.info("clear_data: 清理 plot_widget 失败: %s", e, exc_info=True)

    if hasattr(self, "plot_manager") and self.plot_manager is not None:
        self.plot_manager.plot_curves = []

    if hasattr(self, "plot_curves"):
        self.plot_curves = []
    if hasattr(self, "event_marker_items"):
        self.event_marker_items = []

    # 4. 重置状态
    self.current_view = "original"
    self.wavelength_mode = True
    self.frame_count = 0

    # 5. 更新UI
    if hasattr(self, "interface_manager"):
        try:
            self.interface_manager.update_bottom_button_visibility()
        except Exception as e:
            logger.info("clear_data: 更新 bottom buttons 失败: %s", e, exc_info=True)
    if hasattr(self, "plot_visualization_manager"):
        try:
            self.plot_visualization_manager.update_button_text()
        except Exception as e:
            logger.info("clear_data: 更新 plot 按钮文本失败: %s", e, exc_info=True)
```

---

## 7. reset_session - 重置会话状态

**位置**: 约 936 行

```python
def reset_session(self):
    """重置当前会话状态（逻辑清零），用于连续范式测试
    
    特点：
        - 不清空Buffer物理内存
        - 只重置指针和标记
        - 轻量级，避免频繁全图清空导致卡顿
    """
    try:
        logger.info("正在重置会话状态(轻量逻辑清零)...")
        
        # 1. 清空事件和 info 中的同步点
        if hasattr(self, 'data_model'):
            self.data_model.clear_event_markers()
            self.data_model.frame_count = 0
            
        # 2. 重置主窗口属性
        self.frame_count = 0
        self.event_markers = []
        
        if self.info and 'paradigm' in self.info:
            if 'synchpts' in self.info['paradigm']: 
                self.info['paradigm']['synchpts'] = []
            if 'synchtype' in self.info['paradigm']: 
                self.info['paradigm']['synchtype'] = []
            if 'synchtimes' in self.info['paradigm']: 
                self.info['paradigm']['synchtimes'] = []
        
        # 3. 重置接收器计数器
        if hasattr(self, 'receiver') and self.receiver:
            self.receiver.reset_frame_count()
             
        # 4. 不强制清空 plot_widget，由下次 update_plot 刷新
        
        logger.info("会话状态重置完成（轻量级，无全图清空）")
        
    except Exception as e:
        logger.error(f"重置会话状态失败: {e}")
```

---

## 8. add_event_marker_new - 添加事件标记

**位置**: 约 1172 行

```python
def add_event_marker_new(self, event_name):
    """添加新的事件标记
    
    参数:
        event_name: 事件名称字符串
    
    流程:
        1. 调用数据模型的事件标记方法
        2. 同步到原有属性
        3. 记录日志
        4. 触发重绑
    """
    # 使用数据模型的事件标记方法
    self.data_model.add_event_marker_with_time(event_name)

    # 保持兼容性 - 同步到原有属性
    self.event_markers = self.data_model.event_markers
    self.info = self.data_model.info

    current_time = self.data_model.frame_count
    try:
        logger = logging.getLogger(__name__)
        logger.info("Event marker added: %s at frame %d", event_name, current_time)
    except Exception:
        pass

    self.update_plot()  # 触发重绑
```

---

## 9. save_temp_data - 保存临时数据

**位置**: 约 1940 行

```python
def save_temp_data(self):
    """保存临时数据文件（基于最近 N 秒数据快照）
    
    由 temp_save_timer 定时触发
    """
    try:
        logger.info("[segment] temp_save_timer tick")
        from fnirs_app.processing.file_operations import save_temp_data
        
        # 以当前定时器间隔作为片段时长（秒）
        seg_seconds = int(getattr(self, 'temp_save_interval', 300))
        
        recent = None
        try:
            recent = self.data_model.get_recent_data(seconds=seg_seconds)
        except Exception:
            pass
        
        if recent is None:
            # 回退：使用显示数据的最后窗口
            src = getattr(self, 'display_data', None)
            if src is None:
                logger.info("[segment] no data/display_data, skip")
                return
            sr = getattr(self, 'sample_rate', 8) or 8
            pts = min(src.shape[1], int(sr * seg_seconds))
            recent = src[:, -pts:]
        
        if recent is None or recent.size == 0:
            logger.info("[segment] recent window empty, skip")
            return
        
        # recent: shape (channels, frames) → 以时间为第一维存盘
        chunk = recent.T
        ok = save_temp_data([chunk], self.temp_dir)
        
        if ok:
            logger.info(f"[segment] saved npy, ~{seg_seconds}s, dir={self.temp_dir}, shape={chunk.shape}")
    except Exception as e:
        logger.error(f"[segment] save failed: {e}")
```

---

## 10. cleanup_temp_files - 清理临时文件

**位置**: 约 1973 行

```python
def cleanup_temp_files(self):
    """清理临时文件"""
    from fnirs_app.processing.file_operations import cleanup_temp_files
    cleanup_temp_files(self.temp_dir)
```

---

## 11. update_collection_buttons_state - 更新按钮状态

**位置**: 约 720 行

```python
def update_collection_buttons_state(self):
    """根据当前采集状态更新底部按钮的高亮状态
    
    规则:
        - 未采集中：高亮"开始采集"，熄灭"结束采集"
        - 采集中：高亮"结束采集"，熄灭"开始采集"
    """
    try:
        if hasattr(self, "start_button") and hasattr(self, "stop_button"):
            collecting = bool(getattr(self, "is_collecting", False))
            if collecting:
                self.start_button.setChecked(False)
                self.stop_button.setChecked(True)
            else:
                self.start_button.setChecked(True)
                self.stop_button.setChecked(False)
    except Exception as e:
        logger.info("update_collection_buttons_state 失败: %s", e, exc_info=True)
```

---

## 12. toggle_bright_mode - 切换明亮模式

**位置**: 约 470 行

```python
def toggle_bright_mode(self):
    """切换全屏明亮模式"""
    self.is_bright_mode_active = not self.is_bright_mode_active
    
    if self.is_bright_mode_active:
        self.title_bar.bright_mode_button.setText("🌟")
        show_auto_close_message(self, "模式切换", "已开启全屏明亮模式", 1500)
    else:
        self.title_bar.bright_mode_button.setText("⭐")
        show_auto_close_message(self, "模式切换", "已关闭全屏明亮模式", 1500)
        
        # 退出明亮模式时，如果测试正在进行
        if hasattr(self, 'paradigm_controller') and \
           self.paradigm_controller.ui_mgr.is_bright_mode:
            self.paradigm_controller.ui_mgr.exit_bright_mode()
            if self.paradigm_controller.current_stage not in [None, "instruction", "test_complete"]:
                self.paradigm_controller.show_current_state()
```

---

## 13. enter_paradigm_fullscreen / exit_paradigm_fullscreen

**位置**: 约 504 行 / 约 533 行

```python
def enter_paradigm_fullscreen(self):
    """进入范式全屏模式"""
    if self.is_paradigm_fullscreen_active or not hasattr(self, 'paradigm_controller'):
        return

    paradigm_view = self.paradigm_controller.ui_mgr.view

    # 保存原始父组件
    self._original_paradigm_view_parent = paradigm_view.parentWidget()
    if self._original_paradigm_view_parent:
        paradigm_view.setParent(None)

    # 隐藏其他UI元素
    self.title_bar.setVisible(False)
    self.content_widget.setVisible(False)

    # 添加范式视图到主布局
    self.main_layout.addWidget(paradigm_view)
    paradigm_view.setVisible(True)

    self.showFullScreen()
    self.is_paradigm_fullscreen_active = True


def exit_paradigm_fullscreen(self):
    """退出范式全屏模式"""
    if not self.is_paradigm_fullscreen_active or not hasattr(self, 'paradigm_controller'):
        return

    paradigm_view = self.paradigm_controller.ui_mgr.view

    self.showNormal()

    # 移除范式视图
    self.main_layout.removeWidget(paradigm_view)
    paradigm_view.setVisible(False)

    # 重新添加到 stacked_layout
    try:
        if hasattr(self, 'stacked_layout'):
            if self.stacked_layout.indexOf(paradigm_view) == -1:
                self.stacked_layout.addWidget(paradigm_view)
    except Exception:
        if self._original_paradigm_view_parent:
            paradigm_view.setParent(self._original_paradigm_view_parent)

    # 恢复UI元素
    self.content_widget.setVisible(True)
    self.title_bar.setVisible(True)

    # 切换回曲线图页
    try:
        if hasattr(self, 'plot_widget') and hasattr(self, 'stacked_layout'):
            self.stacked_layout.setCurrentWidget(self.plot_widget)
    except Exception:
        pass
    
    try:
        self.content_widget.raise_()
        self.content_widget.update()
        self.update()
    except Exception:
        pass

    self._original_paradigm_view_parent = None
    self.is_paradigm_fullscreen_active = False
    
    # 恢复为最大化状态
    self.showMaximized()
```

---

## 14. handle_paradigm_completion - 范式完成处理

**位置**: 约 1694 行

```python
def handle_paradigm_completion(self):
    """范式完成后的统一收尾逻辑
    
    流程:
        1. 返回范式菜单
        2. 清理范式控制器内部状态
        3. 结束本次采集会话并保存数据（不断开设备）
    """
    self.show_paradigm_menu()
    
    if self.paradigm_controller:
        self.paradigm_controller.cleanup_experiment_state()

    # 结束会话但不停止底层硬件
    try:
        self.stop_data_collection(hardware_stop=False)
    except Exception as e:
        logger.error(f"范式结束停止采集失败: {e}")
```

---

## 15. get_keep - 获取通道筛选掩码

**位置**: 约 1182 行

```python
def get_keep(self):
    """获取需要显示的通道掩码
    
    根据:
        - 配置的距离范围 (display.r2d_mm_range)
        - 当前选中的波长按钮
    
    返回:
        numpy bool array: 每个通道是否显示
    """
    # 读取距离筛选配置
    try:
        r2d_range = get_param('display.r2d_mm_range', [25, 35]) or [25, 35]
        rmin, rmax = float(r2d_range[0]), float(r2d_range[1])
    except Exception:
        rmin, rmax = 25.0, 35.0

    r2d = self.info['pairs']['r2d']
    wl = self.info['pairs']['WL']

    # 波长按钮优先
    mask_wl = np.ones_like(r2d, dtype=bool)
    if hasattr(self, 'button_735_hbr') and self.button_735_hbr.isChecked():
        mask_wl = (wl == 735)
    elif hasattr(self, 'button_850_hbo') and self.button_850_hbo.isChecked():
        mask_wl = (wl == 850)

    # 距离筛选 (3cm区间)
    mask_r = (r2d >= rmin) & (r2d <= rmax)
    
    return mask_wl & mask_r
```

---

## 16. update_plot - 更新绘图

**位置**: 约 1132 行

```python
def update_plot(self):
    """更新绑图 - 使用绑图管理器"""
    # 仅在曲线页可见时更新，避免在其他页面后台渲染
    try:
        if hasattr(self, 'stacked_layout') and hasattr(self, 'plot_widget'):
            if self.stacked_layout.currentWidget() == self.signal_quality_widget:
                if self.data.shape[-1] % 5 == 0:
                    self.signal_quality_widget.update_data(self.data[:,-100:-1], self.info)
                return
            if self.stacked_layout.currentWidget() is not self.plot_widget:
                return
    except Exception:
        pass
    
    self.plot_manager.update_plot()
```

---

## 17. closeEvent - 关闭事件

**位置**: 约 1850 行

```python
def closeEvent(self, event):
    """窗口关闭事件处理"""
    try:
        # 退出明亮模式
        if self.is_bright_mode_active and hasattr(self, 'paradigm_controller'):
            self.paradigm_controller.ui_mgr.exit_bright_mode()

        # 如果正在录制，询问是否保存
        if self.is_collecting:
            reply = QMessageBox.question(
                self,
                '确认关闭',
                '正在录制数据，是否保存后关闭？',
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No | QMessageBox.StandardButton.Cancel,
                QMessageBox.StandardButton.Cancel
            )

            if reply == QMessageBox.StandardButton.Cancel:
                event.ignore()
                return
            elif reply == QMessageBox.StandardButton.Yes:
                self.stop_data_collection()

        # 关闭前收缩双耳分听序列池
        try:
            from tools.generate_dichotic_sequences import shrink_choice_pool
            shrink_choice_pool(remove_count=2)
        except Exception as e:
            logger.warning(f"关闭前收缩双耳分听序列池失败: {e}")

        # 停止所有运行功能
        self.stop_real_time_mode()
        if hasattr(self, 'paradigm_controller'):
            self.paradigm_controller.cleanup()

        # 停止用户轮询定时器
        if hasattr(self, 'user_poll_timer') and self.user_poll_timer.isActive():
            self.user_poll_timer.stop()
            logger.info("应用程序关闭，已停止用户轮询定时器。")

        event.accept()

    except Exception as e:
        logging.error(f"关闭窗口时发生错误: {str(e)}", exc_info=True)
        event.accept()
```

---

## 18. 委托方法汇总

以下方法只是转发调用，实际逻辑在对应管理器中：

```python
# 业务逻辑管理器委托
def add_device(self):
    return self.business_logic_manager.add_device()

def disconnect_device(self):
    return self.business_logic_manager.disconnect_device()

def connect_device(self):
    return self.business_logic_manager.connect_device()

def scan_nodes(self):
    return self.business_logic_manager.scan_nodes()

def setup_paradigm_test(self):
    return self.business_logic_manager.setup_paradigm_test()

def show_paradigm_menu(self):
    return self.business_logic_manager.show_paradigm_menu()

def load_YSB_info(self):
    return self.business_logic_manager.load_YSB_info()

def show_raw_data(self):
    return self.business_logic_manager.show_raw_data()

# 配置管理器委托
def setup_settings_menu(self):
    return self.configuration_manager.setup_settings_menu()

def show_settings_menu(self):
    return self.configuration_manager.show_settings_menu()

def setup_data_submenu(self):
    return self.configuration_manager.setup_data_submenu()

def clear_cache(self):
    return self.configuration_manager.clear_cache()

# 窗口管理器委托
def toggle_maximize(self):
    return self.window_manager.toggle_maximize()

def toggle_fullscreen(self):
    return self.window_manager.toggle_fullscreen()

def paintEvent(self, event):
    return self.window_manager.handle_paint_event(event)

def mousePressEvent(self, event):
    return self.window_manager.handle_mouse_press_event(event)

def mouseMoveEvent(self, event):
    return self.window_manager.handle_mouse_move_event(event)

def mouseReleaseEvent(self, event):
    return self.window_manager.handle_mouse_release_event(event)

# 界面管理器委托
def show_channel_grid(self):
    if hasattr(self, 'interface_manager'):
        return self.interface_manager.show_channel_grid()

# 绑图管理器委托
def select_plot_data(self):
    return self.plot_manager.select_plot_data()

# UI事件管理器委托
def open_settings(self):
    self.ui_event_manager.handle_settings_button_click()

def button_clicked(self, button_text):
    self.ui_event_manager.handle_button_click(button_text)

def onBottomButtonClicked(self):
    self.ui_event_manager.handle_bottom_button_click()

def resizeEvent(self, event):
    self.ui_event_manager.handle_resize_event(event)
```
