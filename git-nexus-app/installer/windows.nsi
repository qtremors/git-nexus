Unicode true
Target x86-unicode
RequestExecutionLevel user
ManifestDPIAware true
SetCompressor /SOLID lzma

!include "MUI2.nsh"
!include "x64.nsh"
!include "WinVer.nsh"

!define APP_NAME "GitNexus"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\GitNexus"
Name "${APP_NAME} ${APP_VERSION}"
OutFile "${OUTPUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\GitNexus"
InstallDirRegKey HKCU "${UNINSTALL_KEY}" "InstallLocation"
VIProductVersion "${APP_VERSION}.0"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "ProductVersion" "${APP_VERSION}"
VIAddVersionKey "FileVersion" "${APP_VERSION}.0"
VIAddVersionKey "FileDescription" "GitNexus Windows Installer"
VIAddVersionKey "LegalCopyright" "Copyright 2025-2026 Tremors"

!define MUI_ICON "${REPOSITORY_ROOT}\assets\git-nexus.ico"
!define MUI_UNICON "${REPOSITORY_ROOT}\assets\git-nexus.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TEXT "Install GitNexus ${APP_VERSION} for your Windows account.$\r$\n$\r$\nSettings and downloaded files are stored separately from the application. Git is required for repository cloning and Replay."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${PAYLOAD_DIR}\LICENSE.md"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\git-nexus.exe"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function .onInit
    SetRegView 64
    SetShellVarContext current
    ${IfNot} ${RunningX64}
        MessageBox MB_OK|MB_ICONSTOP "GitNexus requires 64-bit Windows." /SD IDOK
        SetErrorLevel 1
        Abort
    ${EndIf}
    ${IfNot} ${AtLeastWin10}
        MessageBox MB_OK|MB_ICONSTOP "GitNexus requires Windows 10 version 1903 or newer." /SD IDOK
        SetErrorLevel 1
        Abort
    ${EndIf}
    ReadRegStr $0 HKLM "Software\Microsoft\Windows NT\CurrentVersion" "CurrentBuildNumber"
    IntCmp $0 18362 supported unsupported supported
    unsupported:
        MessageBox MB_OK|MB_ICONSTOP "GitNexus requires Windows 10 version 1903 or newer." /SD IDOK
        SetErrorLevel 1
        Abort
    supported:
    IfFileExists "$WINDIR\Sysnative\vcruntime140.dll" runtime_present
        MessageBox MB_OK|MB_ICONSTOP "Install the Microsoft Visual C++ x64 runtime first, then run setup again.$\r$\n$\r$\nhttps://aka.ms/vc14/vc_redist.x64.exe" /SD IDOK
        SetErrorLevel 2
        Abort
    runtime_present:
    FindWindow $0 "" "GitNexus"
    ${If} $0 != 0
        MessageBox MB_OK|MB_ICONSTOP "Close GitNexus before installing." /SD IDOK
        SetErrorLevel 1
        Abort
    ${EndIf}
FunctionEnd

Section "GitNexus"
    SetOutPath "$INSTDIR"
    File "${PAYLOAD_DIR}\git-nexus.exe"
    File "${PAYLOAD_DIR}\LICENSE.md"
    File "${PAYLOAD_DIR}\PRIVACY.md"
    File "${PAYLOAD_DIR}\THIRD_PARTY_NOTICES.md"
    File "${PAYLOAD_DIR}\THIRD-PARTY-LICENSES.txt"
    File "${PAYLOAD_DIR}\NSIS-LICENSES.txt"
    File "${PAYLOAD_DIR}\README.txt"
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    CreateDirectory "$SMPROGRAMS\GitNexus"
    CreateShortcut "$SMPROGRAMS\GitNexus\GitNexus.lnk" "$INSTDIR\git-nexus.exe" "" "$INSTDIR\git-nexus.exe" 0
    CreateShortcut "$SMPROGRAMS\GitNexus\Uninstall GitNexus.lnk" "$INSTDIR\Uninstall.exe"
    CreateShortcut "$DESKTOP\GitNexus.lnk" "$INSTDIR\git-nexus.exe" "" "$INSTDIR\git-nexus.exe" 0
    WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "${APP_NAME}"
    WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${APP_VERSION}"
    WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "Tremors"
    WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\git-nexus.exe,0"
    WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
    WriteRegStr HKCU "${UNINSTALL_KEY}" "QuietUninstallString" '$\"$INSTDIR\Uninstall.exe$\" /S'
    WriteRegStr HKCU "${UNINSTALL_KEY}" "URLInfoAbout" "https://github.com/qtremors/git-nexus"
    WriteRegDWORD HKCU "${UNINSTALL_KEY}" "EstimatedSize" ${INSTALLED_SIZE_KB}
    WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
    WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
SectionEnd

Function un.onInit
    SetRegView 64
    SetShellVarContext current
    FindWindow $0 "" "GitNexus"
    ${If} $0 != 0
        MessageBox MB_OK|MB_ICONSTOP "Close GitNexus before uninstalling." /SD IDOK
        SetErrorLevel 1
        Abort
    ${EndIf}
FunctionEnd

Section "Uninstall"
    Delete "$DESKTOP\GitNexus.lnk"
    Delete "$SMPROGRAMS\GitNexus\GitNexus.lnk"
    Delete "$SMPROGRAMS\GitNexus\Uninstall GitNexus.lnk"
    RMDir "$SMPROGRAMS\GitNexus"
    DeleteRegKey HKCU "${UNINSTALL_KEY}"
    Delete "$INSTDIR\git-nexus.exe"
    Delete "$INSTDIR\LICENSE.md"
    Delete "$INSTDIR\PRIVACY.md"
    Delete "$INSTDIR\THIRD_PARTY_NOTICES.md"
    Delete "$INSTDIR\THIRD-PARTY-LICENSES.txt"
    Delete "$INSTDIR\NSIS-LICENSES.txt"
    Delete "$INSTDIR\README.txt"
    Delete "$INSTDIR\Uninstall.exe"
    RMDir "$INSTDIR"
SectionEnd
