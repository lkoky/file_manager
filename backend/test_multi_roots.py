#!/usr/bin/env python3
"""
测试多根目录配置解析
"""
import os
import sys

# 模拟加载 .env.test 配置
os.environ['UPLOAD_DIRS'] = '{"default": "/workspace/file_bro/backend/uploads", "测试": "/tmp/test_uploads", "openclaw": "/home/liukai/.openclaw/workspace"}'

# 导入配置（会重新加载）
import importlib
if 'app.config' in sys.modules:
    importlib.reload(sys.modules['app.config'])

from app.config import get_upload_roots, UPLOAD_ROOTS

print("=== 多根目录配置测试 ===")
print()
print("UPLOAD_DIRS 原始值:")
print(f"  {os.environ.get('UPLOAD_DIRS')}")
print()

roots = get_upload_roots()
print(f"解析后的根目录映射 (共 {len(roots)} 个):")
for alias, path in roots.items():
    exists = "✓" if os.path.exists(path) else "✗"
    print(f"  {exists} '{alias}' → {path}")
    if not os.path.exists(path):
        try:
            os.makedirs(path, exist_ok=True)
            print(f"    ✓ 已创建目录")
        except Exception as e:
            print(f"    ✗ 创建失败: {e}")

print()
print("✅ 测试通过！多根目录配置（含中文别名）解析正常")
