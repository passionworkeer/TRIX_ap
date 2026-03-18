; NSIS installer script for TRIX Companion
; Adds auto-start registry entry (default checked, no admin required)

!macro customInstall
  ; Register auto-start in HKCU (current user, no admin required)
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" \
    "TRIX Companion" '"$INSTDIR\TRIX Companion.exe" --hidden'
!macroend

!macro customUnInstall
  ; Remove auto-start entry
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" \
    "TRIX Companion"
!macroend
