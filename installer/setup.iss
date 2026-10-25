; Inno Setup script for Keybaht Live Chat
; Build with: iscc installer\setup.iss /DMyAppVersion=1.0.0
;
; Safety: keep install folder + AppId + exe names stable so updates/config keep working.
; Only the DISPLAY name is "Keybaht Live Chat".

#ifndef MyAppVersion
  #define MyAppVersion "1.0.0"
#endif

#define MyAppName "Keybaht Live Chat"
#define MyAppPublisher "Keybaht"
#define MyAppURL "https://github.com/zookzonnakab/youtube-live-chat-overlay"
; Technical install folder name — do not change (existing installs / paths)
#define MyInstallDirName "YouTube Live Chat Overlay"
; Keep exe/setup filenames stable for GitHub Release + auto-update
#define MyAppExeName "YouTubeLiveChat.exe"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
DefaultDirName={localappdata}\{#MyInstallDirName}
DefaultGroupName={#MyAppName}
OutputDir=..\release
OutputBaseFilename=YouTubeLiveChat-Setup-{#MyAppVersion}
SetupIconFile=app.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; Install under LocalAppData so config/updates work without admin
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\app.ico
CloseApplications=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "สร้าง Shortcut บน Desktop"; GroupDescription: "Shortcuts:"; Flags: checkedonce

[Files]
; Launcher exe (built with pkg + rcedit icon)
Source: "..\release\YouTubeLiveChat.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\release\app.ico"; DestDir: "{app}"; Flags: ignoreversion
; Node.js portable runtime
Source: "..\release\node\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs createallsubdirs
; Application bundle
Source: "..\release\app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\app.ico"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\app.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "เปิด {#MyAppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\app\data"
Type: filesandordirs; Name: "{app}\app\node_modules"
; Do NOT delete {localappdata}\YouTubeLiveChatOverlay — preserves config/settings across reinstalls

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
end;
