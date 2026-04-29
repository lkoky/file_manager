#!/usr/bin/env python3
"""
配置文件验证脚本 - 检查 .env 配置是否正确
用法: python3 check_config.py
"""

import sys
import os
import json

# 添加后端路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

try:
    from config import settings, get_upload_roots, UPLOAD_ROOTS
except ImportError as e:
    print(f"❌ 导入失败: {e}")
    print("请确保在 backend 目录下运行，且已安装依赖")
    sys.exit(1)

def check_config():
    print("=" * 60)
    print("📋 File Manager 配置检查")
    print("=" * 60)
    print()

    # 检查单目录模式
    print(f"📁 单目录模式 UPLOAD_DIR: {settings.UPLOAD_DIR}")
    print(f"   绝对路径: {os.path.abspath(settings.UPLOAD_DIR)}")
    print()

    # 检查多根目录配置
    print(f"📂 多根目录配置 UPLOAD_DIRS:")
    if settings.UPLOAD_DIRS:
        if isinstance(settings.UPLOAD_DIRS, dict):
            print(f"   类型: 字典（自定义别名）")
            for alias, path in settings.UPLOAD_DIRS.items():
                print(f"   - '{alias}' → {path}")
        elif isinstance(settings.UPLOAD_DIRS, list):
            print(f"   类型: 列表（自动生成别名）")
            for i, path in enumerate(settings.UPLOAD_DIRS):
                print(f"   - root{i} → {path}")
    else:
        print("   （未配置，使用单目录模式）")
    print()

    # 显示解析后的根目录
    print(f"🔧 实际使用的根目录映射:")
    for alias, path in UPLOAD_ROOTS.items():
        exists = "✓" if os.path.exists(path) else "✗"
        print(f"   {exists} '{alias}' → {path}")
    print()

    # 检查目录是否存在
    print("📂 目录存在性检查:")
    all_ok = True
    for alias, path in UPLOAD_ROOTS.items():
        if os.path.exists(path):
            if os.path.isdir(path):
                print(f"   ✓ '{alias}': 目录正常")
            else:
                print(f"   ⚠️ '{alias}': 存在但不是目录")
                all_ok = False
        else:
            print(f"   ✗ '{alias}': 目录不存在（将自动创建）")
            try:
                os.makedirs(path, exist_ok=True)
                print(f"     ✓ 已创建目录")
            except Exception as e:
                print(f"     ✗ 创建失败: {e}")
                all_ok = False
    print()

    # 其他配置
    print("⚙️  其他配置:")
    print(f"   最大文件大小: {settings.MAX_FILE_SIZE // 1024 // 1024} MB")
    print(f"   预览最大大小: {settings.PREVIEW_MAX_SIZE // 1024 // 1024} MB")
    print(f"   CORS 允许源: {settings.ALLOWED_ORIGINS}")
    print()

    # 总结
    print("=" * 60)
    if all_ok:
        print("✅ 配置检查通过！")
        return 0
    else:
        print("⚠️  存在警告，请检查上述错误")
        return 1

if __name__ == "__main__":
    sys.exit(check_config())
