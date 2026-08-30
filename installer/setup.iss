; Inno Setup script for YouTube Live Chat Overlay
; Build with: iscc installer\setup.iss /DMyAppVersion=1.0.0

#ifndef MyAppVersion
  #define MyAppVersion "1.0.0"
#endif

#define MyAppName "YouTube Live Chat Overlay"
#define MyAppPublisher "YouTube Live Chat Overlay"
#define MyAppURL "https://github.com"
#define MyAppExeName "YouTubeLiveChat.exe"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
OutputDir=..\release
OutputBaseFilename=YouTubeLiveChat-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "สร้าง Shortcut บน Desktop"; GroupDescription: "Shortcuts:"; Flags: checkedonce

[Files]
; Launcher exe (built with pkg)
Source: "..\release\YouTubeLiveChat.exe"; DestDir: "{app}"; Flags: ignoreversion
; Node.js portable runtime
Source: "..\release\node\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs createallsubdirs
; Application bundle
Source: "..\release\app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "เปิด {#MyAppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\app\data"
Type: filesandordirs; Name: "{app}\app\node_modules"

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
end;
