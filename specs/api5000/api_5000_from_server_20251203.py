#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
近红外项目服务端API
提供用户信息管理和报告管理的API接口
"""

import os
import json
import time
import logging
import mysql.connector
from typing import Dict, Any, List, Optional, Tuple
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("server/api.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("nir_api")

# 初始化Flask应用
app = Flask(__name__)
CORS(app)  # 启用跨域资源共享

# 数据库配置
DB_CONFIG = {
    'host': 'localhost',
    'user': 'nirs_program',
    'password': 'Geerji4mini.',
    'database': 'nir_system',
    'port': 3306
}

# 存储路径
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPORTS_DIR = os.path.join(BASE_DIR, 'reports')
REHAB_DATA_DIR = os.path.join(BASE_DIR, 'rehab_data')
os.makedirs(REPORTS_DIR, exist_ok=True)
os.makedirs(REHAB_DATA_DIR, exist_ok=True)

# 数据库连接函数
def get_db_connection():
    """获取数据库连接"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except mysql.connector.Error as err:
        logger.error(f"数据库连接错误: {err}")
        raise

# 通用响应格式
def make_response(success: bool, message: str, data: Any = None) -> Dict[str, Any]:
    """创建标准API响应格式"""
    return {
        "success": success,
        "message": message,
        "data": data,
        "timestamp": int(time.time())
    }


@app.route('/api/health', methods=['GET'])
def health_check():
    """简单健康检查：进程和数据库是否可用"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
        conn.close()
        payload = {"status": "ok", "db": "up"}
        return jsonify(make_response(True, "ok", payload)), 200
    except Exception as e:
        logger.error(f"/api/health 检查失败: {e}")
        payload = {"status": "error", "db": "down"}
        return jsonify(make_response(False, "health check failed", payload)), 500

def _header_info() -> Dict[str, Optional[str]]:
    h = request.headers
    return {
        'device_id': h.get('X-Device-Id'),
        'instance_id': h.get('X-Instance-Id'),
        'session_id': h.get('X-Session-Id'),
        'app_type': h.get('X-App-Type'),
        'mode': h.get('X-Mode')
    }

def _ensure_identity_user(id_type: str, id_value: str, create_if_missing: bool = False,
                          name: Optional[str] = None, age: Optional[int] = None, gender: Optional[str] = None) -> Optional[int]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT user_id FROM identity_bindings WHERE id_type=%s AND id_value=%s", (id_type, id_value))
        row = cursor.fetchone()
        if row:
            return int(row[0])
        if not create_if_missing:
            return None
        if not (name and (age is not None) and gender):
            return None
        cursor.execute("INSERT INTO users (name, age, gender, paradigm_choice, collecting, assigned) VALUES (%s,%s,%s,NULL,0,1)", (name, age, gender))
        user_id = cursor.lastrowid
        cursor.execute("INSERT INTO identity_bindings (user_id,id_type,id_value) VALUES (%s,%s,%s)", (user_id, id_type, id_value))
        os.makedirs(os.path.join(REPORTS_DIR, str(user_id)), exist_ok=True)
        conn.commit()
        return int(user_id)
    finally:
        cursor.close()
        conn.close()

def _save_uploaded_file(folder: str, prefix: str, fs) -> Tuple[str, float]:
    date_dir = time.strftime('%Y-%m-%d')
    target = os.path.join(folder, date_dir)
    os.makedirs(target, exist_ok=True)
    filename = secure_filename(fs.filename)
    unique = f"{prefix}_{int(time.time())}_{filename}"
    path = os.path.join(target, unique)
    fs.save(path)
    size_mb = round(os.path.getsize(path) / (1024*1024), 3)
    rel = os.path.relpath(path, BASE_DIR).replace('\\','/')
    return rel, size_mb

def _save_report_for_user(user_id: int, report_file) -> Tuple[str, int]:
    """保存报告PDF到用户目录并插入reports表，返回(相对路径, report_id)"""
    if not report_file or not report_file.filename:
        raise ValueError('报告文件无效')
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM users WHERE id=%s", (user_id,))
        if not cursor.fetchone():
            raise ValueError('用户不存在')
        user_dir = os.path.join(REPORTS_DIR, str(user_id))
        os.makedirs(user_dir, exist_ok=True)
        filename = secure_filename(report_file.filename)
        unique = f"{int(time.time())}_{filename}"
        file_path = os.path.join(user_dir, unique)
        report_file.save(file_path)
        relative_path = os.path.join(str(user_id), unique).replace('\\','/')
        cursor.execute("INSERT INTO reports (user_id, report_path) VALUES (%s,%s)", (user_id, relative_path))
        report_id = cursor.lastrowid
        conn.commit()
        return relative_path, int(report_id)
    finally:
        cursor.close()
        conn.close()

# @app.route('/api/user/register', methods=['POST'])
# def register_user():
#     """
#     存储用户信息API
#     接收并存储用户基本信息到数据库
    
#     请求体:
#     {
#         "name": "用户姓名",
#         "age": 年龄(整数),
#         "gender": "性别(男/女)"
#     }
#     """
#     try:
#         data = request.json
        
#         # 验证请求数据
#         if not data or not all(k in data for k in ['name', 'age', 'gender']):
#             return jsonify(make_response(False, "缺少必要的用户信息")), 400
        
#         name = data.get('name')
#         age = data.get('age')
#         gender = data.get('gender')
        
#         # 连接数据库
#         conn = get_db_connection()
#         cursor = conn.cursor()
        
#         # 检查用户是否已存在
#         cursor.execute("SELECT id FROM users WHERE name = %s", (name,))
#         existing_user = cursor.fetchone()
        
#         if existing_user:
#             user_id = existing_user[0]
#             # 更新用户信息
#             cursor.execute(
#                 "UPDATE users SET age = %s, gender = %s WHERE id = %s",
#                 (age, gender, user_id)
#             )
#             message = "用户信息已更新"
#         else:
#             # 创建新用户
#             cursor.execute(
#                 "INSERT INTO users (name, age, gender) VALUES (%s, %s, %s)",
#                 (name, age, gender)
#             )
#             user_id = cursor.lastrowid
#             # 创建用户报告目录
#             user_dir = os.path.join(REPORTS_DIR, str(user_id))
#             os.makedirs(user_dir, exist_ok=True)
#             message = "用户信息已创建"
        
#         conn.commit()
#         cursor.close()
#         conn.close()
        
#         logger.info(f"用户 {name} ({user_id}) {message}")
#         return jsonify(make_response(True, message, {"user_id": user_id}))
        
#     except Exception as e:
#         logger.error(f"注册用户出错: {str(e)}")
#         return jsonify(make_response(False, f"服务器错误: {str(e)}")), 500

@app.route('/api/user/register', methods=['POST'])
def register_user():
    """
    存储用户信息API
    接收并存储用户基本信息到数据库
    
    请求体:
    {
        "name": "用户姓名",
        "age": 年龄(整数),
        "gender": "性别(男/女)"
    }
    """
    try:
        data = request.json
        
        # 验证请求数据
        if not data or not all(k in data for k in ['name', 'age', 'gender']):
            return jsonify(make_response(False, "缺少必要的用户信息")), 400
        
        name = data.get('name')
        age = data.get('age')
        gender = data.get('gender')
        user_id_from_req = data.get('user_id') # 允许通过user_id进行更新

        # 连接数据库
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 检查用户是否已存在
        existing_user_id = None
        if user_id_from_req:
            cursor.execute("SELECT id FROM users WHERE id = %s", (user_id_from_req,))
            row = cursor.fetchone()
            if row:
                existing_user_id = row[0]
        elif name: # 如果没有提供user_id，则按名称查找 (保持部分原有逻辑)
            cursor.execute("SELECT id FROM users WHERE name = %s", (name,))
            row = cursor.fetchone()
            if row:
                existing_user_id = row[0]
        
        if existing_user_id:
            user_id = existing_user_id
            updates = {}
            update_params = []

            if 'age' in data:
                updates['age'] = data['age']
            if 'gender' in data:
                updates['gender'] = data['gender']
            if 'paradigm_choice' in data: # paradigm_choice 可以是字符串或 None
                updates['paradigm_choice'] = data['paradigm_choice']
            if 'collecting' in data: # collecting 是布尔值
                updates['collecting'] = 1 if bool(data['collecting']) else 0
            if 'assigned' in data: # assigned 是布尔值
                updates['assigned'] = 1 if bool(data['assigned']) else 0

            if not updates:
                # 如果仅提供了 user_id 或 name 但没有其他可更新字段
                message = "用户信息已存在但未提供更新字段"
                # 确保返回 user_id
                cursor.close()
                conn.close()
                return jsonify(make_response(True, message, {"user_id": user_id}))
            
            set_clauses = [f"{key} = %s" for key in updates.keys()]
            update_values = list(updates.values())
            update_values.append(user_id)
            
            try:
                cursor.execute(
                    f"UPDATE users SET {', '.join(set_clauses)} WHERE id = %s",
                    tuple(update_values)
                )
                message = "用户信息已更新"
            except mysql.connector.Error as err:
                logger.error(f"更新用户 {user_id} 信息时出错: {err}")
                conn.rollback()
                cursor.close()
                conn.close()
                return jsonify(make_response(False, f"数据库更新错误: {err}")), 500
        else:
            # 创建新用户
            # 确保新用户注册时 name, age, gender 必填
            if not name or age is None or not gender: # age可以是0，所以检查is None
                 cursor.close()
                 conn.close()
                 return jsonify(make_response(False, "新用户注册缺少姓名、年龄或性别信息")), 400

            try:
                cursor.execute(
                    "INSERT INTO users (name, age, gender, paradigm_choice, collecting, assigned) VALUES (%s, %s, %s, NULL, 0, 1)",
                    (name, age, gender)
                )
                user_id = cursor.lastrowid
                # 创建用户报告目录
                user_dir = os.path.join(REPORTS_DIR, str(user_id))
                os.makedirs(user_dir, exist_ok=True)
                message = "用户信息已创建"
            except mysql.connector.Error as err:
                logger.error(f"创建新用户 {name} 时出错: {err}")
                conn.rollback()
                cursor.close()
                conn.close()
                return jsonify(make_response(False, f"数据库插入错误: {err}")), 500
        
        conn.commit()
        cursor.close()
        conn.close()
        
        logger.info(f"用户 {name} ({user_id}) {message}")
        return jsonify(make_response(True, message, {"user_id": user_id}))
        
    except Exception as e:
        logger.error(f"注册用户出错: {str(e)}")
        return jsonify(make_response(False, f"服务器错误: {str(e)}")), 500

@app.route('/api/user/info', methods=['GET'])
def get_user_info():
    """
    获取用户信息API
    - 如果提供 'id' 或 'name' 参数，则获取单个用户信息。
    - 如果不提供任何参数，则返回所有用户列表。
    
    查询参数:
    id: 用户ID (可选)
    name: 用户名 (可选)
    """
    try:
        user_id = request.args.get('id')
        name = request.args.get('name')
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        if user_id:
            cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            data = cursor.fetchone()
            if not data:
                return jsonify(make_response(False, "用户不存在")), 404
        elif name:
            cursor.execute("SELECT * FROM users WHERE name = %s", (name,))
            data = cursor.fetchone()
            if not data:
                return jsonify(make_response(False, "用户不存在")), 404
        else:
            # 如果没有参数，则返回所有用户
            cursor.execute("SELECT * FROM users ORDER BY id DESC")
            data = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # 格式化日期
        if isinstance(data, list):
            for item in data:
                if 'created_at' in item and item['created_at']:
                    item['created_at'] = item['created_at'].isoformat()
        elif isinstance(data, dict):
             if 'created_at' in data and data['created_at']:
                data['created_at'] = data['created_at'].isoformat()

        return jsonify(make_response(True, "获取用户信息成功", data))
        
    except Exception as e:
        logger.error(f"获取用户信息出错: {str(e)}")
        return jsonify(make_response(False, f"服务器错误: {str(e)}")), 500

# @app.route('/api/user/latest', methods=['GET'])
# def get_latest_users():
#     """
#     获取最新用户信息API
#     获取最近注册的用户信息列表，供客户端轮询使用
    
#     查询参数:
#     limit: 返回的用户数量限制 (默认5)
#     """
#     try:
#         limit = request.args.get('limit', default=5, type=int)
        
#         # 连接数据库
#         conn = get_db_connection()
#         cursor = conn.cursor(dictionary=True)
        
#         # 查询最新用户信息
#         cursor.execute(
#             "SELECT * FROM users ORDER BY created_at DESC LIMIT %s",
#             (limit,)
#         )
        
#         users = cursor.fetchall()
#         cursor.close()
#         conn.close()
        
#         # 格式化创建时间
#         for user in users:
#             if 'created_at' in user and user['created_at']:
#                 user['created_at'] = user['created_at'].isoformat()
        
#         return jsonify(make_response(True, "获取最新用户信息成功", users))
        
#     except Exception as e:
#         logger.error(f"获取最新用户信息出错: {str(e)}")
#         return jsonify(make_response(False, f"服务器错误: {str(e)}")), 500

@app.route('/api/user/latest', methods=['GET'])
def get_latest_user():
    try:
        limit = int(request.args.get('limit', 1))
        mark_as_assigned = request.args.get('mark_assigned', 'false').lower() == 'true'
        
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # 查询未分配的最新用户
        query = "SELECT * FROM users WHERE assigned = FALSE ORDER BY id DESC LIMIT %s"
        cursor.execute(query, (limit,))
        users = cursor.fetchall()
        
        if not users:
            cursor.close()
            connection.close()
            return jsonify({"success": True, "data": []})
        
        if mark_as_assigned:
            update_query = "UPDATE users SET assigned = TRUE WHERE id = %s"
            for user in users:
                user_id = user['id']
                cursor.execute(update_query, (user_id,))
            connection.commit()
        
        cursor.close()
        connection.close()
        return jsonify({"success": True, "data": users})
        
    except Exception as e:
        print(f"获取最新用户出错: {str(e)}")
        return jsonify({"success": False, "message": "服务器错误"}), 500

@app.route('/api/report/save', methods=['POST'])
def save_report():
    """
    保存报告API
    接收并存储用户的报告文件
    
    请求体:
    - Content-Type: multipart/form-data
    - 字段:
        - user_id: 用户ID
        - report_file: 报告文件
    """
    try:
        # 验证请求数据
        if 'user_id' not in request.form:
            return jsonify(make_response(False, "缺少用户ID")), 400
        
        if 'report_file' not in request.files:
            return jsonify(make_response(False, "缺少报告文件")), 400
        
        user_id = request.form['user_id']
        report_file = request.files['report_file']
        
        if not report_file.filename:
            return jsonify(make_response(False, "文件名为空")), 400
        
        # 检查用户是否存在
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify(make_response(False, "用户不存在")), 404
        
        # 创建用户报告目录
        user_dir = os.path.join(REPORTS_DIR, str(user_id))
        os.makedirs(user_dir, exist_ok=True)
        
        # 保存报告文件
        filename = secure_filename(report_file.filename)
        timestamp = int(time.time())
        unique_filename = f"{timestamp}_{filename}"
        file_path = os.path.join(user_dir, unique_filename)
        report_file.save(file_path)
        
        # 记录报告信息到数据库
        relative_path = os.path.join(str(user_id), unique_filename)
        
        cursor.execute(
            "INSERT INTO reports (user_id, report_path) VALUES (%s, %s)",
            (user_id, relative_path)
        )
        
        report_id = cursor.lastrowid
        conn.commit()
        cursor.close()
        conn.close()
        
        logger.info(f"用户 {user_id} 的报告已保存: {file_path}")
        return jsonify(make_response(True, "报告保存成功", {"report_id": report_id, "file_path": relative_path}))
        
    except Exception as e:
        logger.error(f"保存报告出错: {str(e)}")
        return jsonify(make_response(False, f"服务器错误: {str(e)}")), 500

@app.route('/api/report/list', methods=['GET'])
def list_reports():
    """
    获取报告列表API
    根据用户ID获取其所有报告列表
    
    查询参数:
    user_id: 用户ID
    """
    try:
        user_id = request.args.get('user_id')
        
        # 验证请求参数
        if not user_id:
            return jsonify(make_response(False, "缺少用户ID")), 400
        
        # 连接数据库
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # 查询用户报告列表
        cursor.execute(
            """
            SELECT r.id, r.report_path, r.created_at, u.name 
            FROM reports r 
            JOIN users u ON r.user_id = u.id 
            WHERE r.user_id = %s 
            ORDER BY r.created_at DESC
            """,
            (user_id,)
        )
        
        reports = cursor.fetchall()
        cursor.close()
        conn.close()
        
        # 格式化创建时间
        for report in reports:
            if 'created_at' in report and report['created_at']:
                report['created_at'] = report['created_at'].isoformat()
        
        return jsonify(make_response(True, "获取报告列表成功", reports))
        
    except Exception as e:
        logger.error(f"获取报告列表出错: {str(e)}")
        return jsonify(make_response(False, f"服务器错误: {str(e)}")), 500

@app.route('/api/report/download/<int:report_id>', methods=['GET'])
def download_report(report_id):
    """
    下载报告API
    根据报告ID下载报告文件
    
    路径参数:
    report_id: 报告ID
    """
    try:
        # 连接数据库
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # 查询报告信息
        cursor.execute("SELECT report_path FROM reports WHERE id = %s", (report_id,))
        report = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not report:
            return jsonify(make_response(False, "报告不存在")), 404
        
        # 获取报告文件路径
        file_path = os.path.join(REPORTS_DIR, report['report_path'])
        
        # 检查文件是否存在
        if not os.path.exists(file_path):
            return jsonify(make_response(False, "报告文件不存在")), 404
        
        # 返回文件
        return send_file(
            file_path,
            as_attachment=True,
            download_name=os.path.basename(file_path)
        )
        
    except Exception as e:
        logger.error(f"下载报告出错: {str(e)}")
        return jsonify(make_response(False, f"服务器错误: {str(e)}")), 500

@app.route('/api/report/latest', methods=['GET'])
def get_latest_reports():
    """
    获取最新报告API
    获取系统中最新生成的报告列表，供小程序轮询使用
    
    查询参数:
    user_id: 用户ID (必需)
    limit: 返回的报告数量限制 (默认5)
    """
    try:
        user_id = request.args.get('user_id')
        limit = request.args.get('limit', default=5, type=int)
        
        # 验证用户ID
        if not user_id:
            return jsonify(make_response(False, "缺少用户ID")), 400
        
        # 连接数据库
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # 查询最新报告信息
        cursor.execute(
            """
            SELECT r.id, r.report_path, r.created_at, r.user_id, u.name, u.gender, u.age
            FROM reports r 
            JOIN users u ON r.user_id = u.id 
            WHERE r.user_id = %s
            ORDER BY r.created_at DESC 
            LIMIT %s
            """,
            (user_id, limit)
        )
        
        reports = cursor.fetchall()
        cursor.close()
        conn.close()
        
        # 格式化创建时间
        for report in reports:
            if 'created_at' in report and report['created_at']:
                report['created_at'] = report['created_at'].isoformat()
        
        return jsonify(make_response(True, "获取最新报告成功", reports))
        
    except Exception as e:
        logger.error(f"获取最新报告出错: {str(e)}")
        return jsonify(make_response(False, f"服务器错误: {str(e)}")), 500

# =============================
# 康复系统扩展接口（5000端口）
# =============================

@app.route('/api/identity/resolve', methods=['POST'])
def identity_resolve():
    try:
        data = request.get_json(force=True)
        id_type = data.get('id_type')
        id_value = data.get('id_value')
        create_if_missing = bool(data.get('create_if_missing', True))
        user_id = data.get('user_id')
        name, age, gender = data.get('name'), data.get('age'), data.get('gender')
        if not id_type or not id_value:
            return jsonify(make_response(False, '缺少id_type或id_value')), 400
        if user_id:
            conn = get_db_connection()
            cursor = conn.cursor()
            try:
                cursor.execute('SELECT id FROM users WHERE id=%s', (user_id,))
                if not cursor.fetchone():
                    return jsonify(make_response(False, '用户不存在')), 404
                cursor.execute('SELECT user_id FROM identity_bindings WHERE id_type=%s AND id_value=%s', (id_type, id_value))
                if not cursor.fetchone():
                    cursor.execute('INSERT INTO identity_bindings (user_id,id_type,id_value) VALUES (%s,%s,%s)', (user_id, id_type, id_value))
                conn.commit()
                return jsonify(make_response(True, '绑定成功', {'user_id': int(user_id)}))
            finally:
                cursor.close()
                conn.close()
        uid = _ensure_identity_user(id_type, id_value, create_if_missing, name, age, gender)
        if not uid:
            return jsonify(make_response(False, '未找到绑定用户，且未满足创建条件')), 404
        return jsonify(make_response(True, '解析成功', {'user_id': uid}))
    except Exception as e:
        logger.error(f"identity_resolve失败: {e}")
        return jsonify(make_response(False, f"服务器错误: {e}")), 500

@app.route('/api/rehab/session/start', methods=['POST'])
def rehab_session_start():
    try:
        data = request.get_json(force=True)
        user_id = data.get('user_id')
        if not user_id and data.get('id_type') and data.get('id_value'):
            user_id = _ensure_identity_user(data['id_type'], data['id_value'], False)
        if not user_id and data.get('patient_id'):
            user_id = _ensure_identity_user('external_patient_id_5002', str(data['patient_id']), False)
        if not user_id:
            return jsonify(make_response(False, '缺少user_id或无法根据标识解析用户')), 400
        headers = _header_info()
        session_uuid = f"S_{int(time.time()*1000)}"
        manufacturer = data.get('manufacturer', 'golgi')
        data_version = data.get('data_version', 'v2.2.0')
        notes = data.get('notes')
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO rehab_sessions (user_id, session_uuid, manufacturer, data_version, status, start_time, notes, device_id, instance_id, app_type, mode)
                VALUES (%s,%s,%s,%s,'active',NOW(),%s,%s,%s,%s,%s)
                """,
                (user_id, session_uuid, manufacturer, data_version, notes, headers['device_id'], headers['instance_id'], headers['app_type'], headers['mode'])
            )
            sid = cursor.lastrowid
            conn.commit()
            return jsonify(make_response(True, '会话已开始', {'session_id': int(sid), 'session_uuid': session_uuid}))
        finally:
            cursor.close()
            conn.close()
    except Exception as e:
        logger.error(f"rehab_session_start失败: {e}")
        return jsonify(make_response(False, f"服务器错误: {e}")), 500

@app.route('/api/rehab/session/finish', methods=['POST'])
def rehab_session_finish():
    try:
        data = request.get_json(force=True)
        session_id = data.get('session_id')
        session_uuid = data.get('session_uuid')
        if not session_id and not session_uuid:
            return jsonify(make_response(False, '缺少session_id或session_uuid')), 400
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            if session_id:
                cursor.execute("UPDATE rehab_sessions SET end_time=NOW(), status='completed' WHERE id=%s", (session_id,))
            else:
                cursor.execute("UPDATE rehab_sessions SET end_time=NOW(), status='completed' WHERE session_uuid=%s", (session_uuid,))
            conn.commit()
            return jsonify(make_response(True, '会话已结束'))
        finally:
            cursor.close()
            conn.close()
    except Exception as e:
        logger.error(f"rehab_session_finish失败: {e}")
        return jsonify(make_response(False, f"服务器错误: {e}")), 500

def _rehab_upload_core(form, files):
    data_type = (form.get('data_type') or 'motion').lower()
    manufacturer = (form.get('manufacturer') or 'golgi').lower()
    session_id = form.get('session_id')
    user_id = form.get('user_id')
    patient_info = form.get('patient_info')
    meta = None
    if patient_info:
        try:
            meta = json.loads(patient_info)
        except Exception:
            meta = None
    if not user_id and meta and meta.get('patient_id'):
        pid = str(meta['patient_id'])
        name, age, gender = meta.get('name'), meta.get('age'), meta.get('gender')
        user_id = _ensure_identity_user('external_patient_id_5002', pid, bool(name and (age is not None) and gender), name, age, gender)
    if not session_id:
        if not user_id:
            return None, (400, make_response(False, '缺少session_id或无法解析user_id'))
        headers = _header_info()
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            session_uuid = f"S_{int(time.time()*1000)}"
            cursor.execute(
                "INSERT INTO rehab_sessions (user_id, session_uuid, manufacturer, data_version, status, start_time, device_id, instance_id, app_type, mode) VALUES (%s,%s,%s,%s,'active',NOW(),%s,%s,%s,%s)",
                (user_id, session_uuid, manufacturer, 'v2.2.0', headers['device_id'], headers['instance_id'], headers['app_type'], headers['mode'])
            )
            session_id = cursor.lastrowid
            conn.commit()
        finally:
            cursor.close()
            conn.close()
    upload = files.get('fnirs_file') or files.get('motion_file') or files.get('data_file') or files.get('file')
    if not upload or not upload.filename:
        return None, (400, make_response(False, f'缺少{data_type}数据文件'))
    rel_path, size_mb = _save_uploaded_file(REHAB_DATA_DIR, f"{data_type}_{manufacturer}", upload)
    duration_seconds = None
    if form.get('duration_seconds'):
        try:
            duration_seconds = int(form.get('duration_seconds'))
        except Exception:
            duration_seconds = None
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if data_type == 'fnirs':
            cursor.execute(
                """
                INSERT INTO rehab_fnirs_records (session_id, file_path, file_size_mb, duration_seconds, channels, fs, wavelengths, metadata_json)
                VALUES (%s,%s,%s,%s,432,8,'735,850',%s)
                """,
                (session_id, rel_path, size_mb, duration_seconds, json.dumps(meta, ensure_ascii=False) if meta else None)
            )
            rid = cursor.lastrowid
        else:
            cursor.execute(
                """
                INSERT INTO rehab_motion_records (session_id, file_path, file_size_mb, duration_seconds, device_name, metadata_json)
                VALUES (%s,%s,%s,%s,%s,%s)
                """,
                (session_id, rel_path, size_mb, duration_seconds, '康莲设备', json.dumps(meta, ensure_ascii=False) if meta else None)
            )
            rid = cursor.lastrowid
        conn.commit()
    finally:
        cursor.close()
        conn.close()
    return {
        'session_id': int(session_id),
        'record_id': int(rid),
        'data_type': data_type,
        'manufacturer': manufacturer,
        'file_path': rel_path,
        'file_size_mb': size_mb,
        'duration_seconds': duration_seconds
    }, None

@app.route('/api/rehab/upload/data', methods=['POST'])
def rehab_upload_data():
    try:
        result, err = _rehab_upload_core(request.form, request.files)
        if err:
            code, payload = err
            return jsonify(payload), code
        return jsonify(make_response(True, '上传成功', result))
    except Exception as e:
        logger.error(f"rehab_upload_data失败: {e}")
        return jsonify(make_response(False, f"服务器错误: {e}")), 500

@app.route('/api/upload/data', methods=['POST'])
def compat_upload_data():
    return rehab_upload_data()

@app.route('/api/rehab/sessions', methods=['GET'])
def list_rehab_sessions():
    try:
        user_id = request.args.get('user_id', type=int)
        if not user_id:
            return jsonify(make_response(False, '缺少user_id')), 400
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute("SELECT id, user_id, session_uuid, manufacturer, data_version, status, start_time, end_time, notes, device_id, instance_id, app_type, mode FROM rehab_sessions WHERE user_id=%s ORDER BY id DESC", (user_id,))
            rows = cursor.fetchall()
        finally:
            cursor.close()
            conn.close()
        for r in rows:
            if r.get('start_time'): r['start_time'] = r['start_time'].isoformat()
            if r.get('end_time'): r['end_time'] = r['end_time'].isoformat()
        return jsonify(make_response(True, '获取会话成功', rows))
    except Exception as e:
        logger.error(f"list_rehab_sessions失败: {e}")
        return jsonify(make_response(False, f"服务器错误: {e}")), 500

@app.route('/api/rehab/stats', methods=['GET'])
def rehab_stats():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute('SELECT COUNT(*) AS sessions FROM rehab_sessions')
            s = cursor.fetchone()['sessions']
            cursor.execute('SELECT COUNT(*) AS fnirs FROM rehab_fnirs_records')
            f = cursor.fetchone()['fnirs']
            cursor.execute('SELECT COUNT(*) AS motion FROM rehab_motion_records')
            m = cursor.fetchone()['motion']
        finally:
            cursor.close()
            conn.close()
        return jsonify(make_response(True, '统计成功', {'sessions': s, 'fnirs_records': f, 'motion_records': m}))
    except Exception as e:
        logger.error(f"rehab_stats失败: {e}")
        return jsonify(make_response(False, f"服务器错误: {e}")), 500

@app.route('/api/rehab/report/upload', methods=['POST'])
def rehab_report_upload():
    """
    会话级报告上传：将PDF报告与rehab_sessions会话建立关联
    表单字段：
    - session_id 或 session_uuid（二选一）
    - report_file (pdf)
    可选：patient_info（json字符串，若后续扩展）
    返回：{session_id, report_id, file_path}
    """
    try:
        form = request.form
        files = request.files
        session_id = form.get('session_id', type=int)
        session_uuid = form.get('session_uuid')
        if not session_id and not session_uuid:
            return jsonify(make_response(False, '缺少session_id或session_uuid')), 400
        report_file = files.get('report_file') or files.get('file')
        if not report_file or not report_file.filename:
            return jsonify(make_response(False, '缺少报告文件')), 400
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            if session_id:
                cursor.execute('SELECT id,user_id FROM rehab_sessions WHERE id=%s', (session_id,))
            else:
                cursor.execute('SELECT id,user_id FROM rehab_sessions WHERE session_uuid=%s', (session_uuid,))
            row = cursor.fetchone()
        finally:
            cursor.close()
            conn.close()
        if not row:
            return jsonify(make_response(False, '会话不存在')), 404
        sid = int(row['id'])
        uid = int(row['user_id'])
        rel_path, report_id = _save_report_for_user(uid, report_file)
        # 关联表写入
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                'INSERT IGNORE INTO rehab_session_reports (session_id, report_id) VALUES (%s,%s)',
                (sid, report_id)
            )
            conn.commit()
        finally:
            cursor.close()
            conn.close()
        return jsonify(make_response(True, '会话报告上传成功', {
            'session_id': sid,
            'report_id': report_id,
            'file_path': rel_path
        }))
    except Exception as e:
        logger.error(f"rehab_report_upload失败: {e}")
        return jsonify(make_response(False, f"服务器错误: {e}")), 500

@app.route('/api/rehab/data/list', methods=['GET'])
def rehab_data_list():
    """
    获取用户的原始数据列表
    支持按session_id过滤
    """
    try:
        user_id = request.args.get('user_id', type=int)
        session_id = request.args.get('session_id', type=int)
        limit = request.args.get('limit', default=50, type=int)
        offset = request.args.get('offset', default=0, type=int)
        
        if not user_id:
            return jsonify(make_response(False, "缺少user_id")), 400
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            if session_id:
                cursor.execute(
                    """
                    SELECT r.id, r.session_id, r.file_path, r.file_size_mb, r.duration_seconds, r.created_at
                    FROM rehab_fnirs_records r
                    JOIN rehab_sessions s ON r.session_id = s.id
                    WHERE s.user_id = %s AND r.session_id = %s
                    ORDER BY r.id DESC LIMIT %s OFFSET %s
                    """, (user_id, session_id, limit, offset))
            else:
                cursor.execute(
                    """
                    SELECT r.id, r.session_id, r.file_path, r.file_size_mb, r.duration_seconds, r.created_at
                    FROM rehab_fnirs_records r
                    JOIN rehab_sessions s ON r.session_id = s.id
                    WHERE s.user_id = %s
                    ORDER BY r.id DESC LIMIT %s OFFSET %s
                    """, (user_id, limit, offset))
            rows = cursor.fetchall()
        finally:
            cursor.close()
            conn.close()
        
        for it in rows:
            if it.get("created_at"):
                it["created_at"] = it["created_at"].isoformat()
        
        return jsonify(make_response(True, "获取原始数据列表成功", rows))
    except Exception as e:
        logger.error(f"rehab_data_list失败: {e}")
        return jsonify(make_response(False, f"服务器错误: {e}")), 500

@app.route('/api/rehab/data/download/<int:record_id>', methods=['GET'])
def rehab_data_download(record_id):
    """
    下载指定的原始数据文件
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute('SELECT file_path FROM rehab_fnirs_records WHERE id=%s', (record_id,))
            row = cursor.fetchone()
        finally:
            cursor.close()
            conn.close()
        
        if not row:
            return jsonify(make_response(False, "记录不存在")), 404
        
        # 注意：数据库中的 file_path 是相对 BASE_DIR 的路径（例如 rehab_data/2025-11-07/xxx.mat）
        # 这里必须以 BASE_DIR 作为根拼接，避免出现 REHAB_DATA_DIR/rehab_data/... 的双重前缀
        fp = os.path.join(BASE_DIR, row['file_path'])
        if not os.path.exists(fp):
            return jsonify(make_response(False, "文件不存在")), 404
        
        return send_file(fp, as_attachment=True, download_name=os.path.basename(fp))
    except Exception as e:
        logger.error(f"rehab_data_download失败: {e}")
        return jsonify(make_response(False, f"服务器错误: {e}")), 500

if __name__ == '__main__':
    # 启动服务器
    app.run(host='0.0.0.0', port=5000, debug=False)