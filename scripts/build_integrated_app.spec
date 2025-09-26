# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(['../integrated_app.py'],
             pathex=[],
             binaries=[],
             datas=[
               ('../dist/**', 'dist'),
               ('../fnirs_sdk/*.py', 'fnirs_sdk'),
               ('../fnirs_sdk/config/**', 'fnirs_sdk/config'),
               ('../fnirs_sdk/converters/**', 'fnirs_sdk/converters'),
               ('../fnirs_sdk/data_structures/**', 'fnirs_sdk/data_structures'),
               ('../fnirs_sdk/processing/**', 'fnirs_sdk/processing'),
             ],
             hiddenimports=[
               'webbrowser',
               'http.server',
               'socketserver',
               'threading',
               'json',
               'urllib.parse'
             ],
             hookspath=[],
             hooksconfig={},
             runtime_hooks=[],
             excludes=[],
             win_no_prefer_redirects=False,
             win_private_assemblies=False,
             cipher=block_cipher,
             noarchive=False)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(pyz,
          a.scripts,
          a.binaries,
          a.zipfiles,
          a.datas,
          [],
          name='康复训练系统',
          debug=False,
          bootloader_ignore_signals=False,
          strip=False,
          upx=True,
          upx_exclude=[],
          runtime_tmpdir=None,
          console=True,
          icon=None,
          onefile=True)