; ============================================================
; TRIX Companion NSIS 安装脚本
; - 开机自启注册（HKCU，无需管理员权限）
; - 注意：语言由 electron-builder 在 nsis.language 中统一配置
; ============================================================

!macro customInstall
  ; 注册 HKCU Run（当前用户，无需管理员权限）
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" \
    "TRIX Companion" '"$INSTDIR\TRIX Companion.exe" --hidden'
!macroend

!macro customUnInstall
  ; 移除开机自启
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" \
    "TRIX Companion"

  ; 移除开始菜单文件夹
  Delete "$SMPROGRAMS\TRIX Companion.lnk"
  Delete "$SMPROGRAMS\TRIX Companion\卸载 TRIX Companion.lnk"
  RMDir /r "$SMPROGRAMS\TRIX Companion"

  ; 移除桌面快捷方式
  Delete "$DESKTOP\TRIX Companion.lnk"
!macroend
