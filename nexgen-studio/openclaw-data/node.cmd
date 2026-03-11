@echo off
rem OpenClaw Node Host (v2026.2.26)
set "HOME=C:\Users\nexge"
set "TMPDIR=C:\Users\nexge\AppData\Local\Temp"
set "PATH=C:\Users\nexge\New folder\nexgen-studio\nexgen-studio\nexus-app\node_modules\.bin;C:\Users\nexge\New folder\nexgen-studio\nexgen-studio\node_modules\.bin;C:\Users\nexge\New folder\nexgen-studio\node_modules\.bin;C:\Users\nexge\New folder\node_modules\.bin;C:\Users\nexge\node_modules\.bin;C:\Users\node_modules\.bin;C:\node_modules\.bin;C:\Program Files\nodejs\node_modules\npm\node_modules\@npmcli\run-script\lib\node-gyp-bin;C:\Users\nexge\.codex\tmp\arg0\codex-arg0tqU3Yk;C:\Users\nexge\AppData\Roaming\npm\node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\path;C:\Python314\Scripts\;C:\Python314\;C:\WINDOWS\system32;C:\WINDOWS;C:\WINDOWS\System32\Wbem;C:\WINDOWS\System32\WindowsPowerShell\v1.0\;C:\WINDOWS\System32\OpenSSH\;C:\Program Files\Docker\Docker\resources\bin;C:\Program Files\nodejs\;C:\ProgramData\chocolatey\bin;C:\Users\nexge\AppData\Local\Microsoft\WindowsApps;C:\Users\nexge\AppData\Local\Programs\Microsoft VS Code\bin;C:\Users\nexge\AppData\Roaming\npm;C:\Users\nexge\AppData\Local\Programs\Ollama"
set "OPENCLAW_STATE_DIR=C:\Users\nexge\New folder\nexgen-studio\nexgen-studio\openclaw-data"
set "OPENCLAW_CONFIG_PATH=C:\Users\nexge\New folder\nexgen-studio\nexgen-studio\openclaw-data\openclaw.json"
set "OPENCLAW_LAUNCHD_LABEL=ai.openclaw.node"
set "OPENCLAW_SYSTEMD_UNIT=openclaw-node"
set "OPENCLAW_WINDOWS_TASK_NAME=OpenClaw Node"
set "OPENCLAW_TASK_SCRIPT_NAME=node.cmd"
set "OPENCLAW_LOG_PREFIX=node"
set "OPENCLAW_SERVICE_MARKER=openclaw"
set "OPENCLAW_SERVICE_KIND=node"
set "OPENCLAW_SERVICE_VERSION=2026.2.26"
"C:\Program Files\nodejs\node.exe" C:\Users\nexge\AppData\Roaming\npm\node_modules\openclaw\dist\index.js node run --host 127.0.0.1 --port 18789
