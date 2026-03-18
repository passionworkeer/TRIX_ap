; ============================================================
; TRIX Companion NSIS 语言配置 - 简体中文
; ============================================================
; LangString 格式: !insertmacro LANGFILE "IDENTIFIER" "Chinese text"
; 注册到 NSISLanguages via ${NSISCONFIG_LANGDLL}

!insertmacro LANGFILE "SimpChinese" "简体中文"

; ---- 安装向导字符串 ----
!insertmacro LANGSTRING STR_LicenseNote ${SimpChinese} "请在继续之前阅读许可证协议"
!insertmacro LANGSTRING STR_SelectDir ${SimpChinese} "选择安装目录"
!insertmacro LANGSTRING STR_SelectStartMenuFolder ${SimpChinese} "选择开始菜单文件夹"
!insertmacro LANGSTRING STR_Installing ${SimpChinese} "正在安装..."
!insertmacro LANGSTRING STR_Installed ${SimpChinese} "TRIX Companion 已成功安装"
!insertmacro LANGSTRING STR_Uninstalling ${SimpChinese} "正在卸载..."
!insertmacro LANGSTRING STR_Uninstalled ${SimpChinese} "TRIX Companion 已成功卸载"

; ---- 安装确认 ----
!insertmacro LANGSTRING STR_InfoBeforeInstall ${SimpChinese} "安装程序将在您的电脑上安装 TRIX Companion。$\r$\n$\r$\n推荐您在继续之前关闭所有其他应用程序。$\r$\n$\r$\n点击"下一步"继续，或点击"取消"退出安装程序。"
!insertmacro LANGSTRING STR_LaunchApp ${SimpChinese} "立即启动 TRIX Companion"
!insertmacro LANGSTRING STR_Finished ${SimpChinese} "TRIX Companion 安装完成"

; ---- 卸载确认 ----
!insertmacro LANGSTRING STR_UninstallConfirm ${SimpChinese} "您确定要完全移除 TRIX Companion 及其所有组件吗？"
!insertmacro LANGSTRING STR_RemoveSettings ${SimpChinese} "同时删除用户数据和设置（推荐）"
!insertmacro LANGSTRING STR_RemoveData ${SimpChinese} "是否也删除您的个人数据和配置文件？"

; ---- 错误信息 ----
!insertmacro LANGSTRING STR_CannotInstall ${SimpChinese} "安装程序无法安装 TRIX Companion"

; ---- 语言选择 ----
!insertmacro LANGSTRING STR_Language ${SimpChinese} "安装语言"
