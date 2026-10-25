# Laptop Worker, on demand

YouTube refuses the cloud Worker (`LOGIN_REQUIRED`), so those Drafts wait as
`laptop_only` for the Worker on the Master's Mac, where the transcript still
comes through. A launchd agent checks every 15 minutes and runs the Worker
only when such a Draft is waiting:

    pnpm worker --if-laptop-work

The check is one indexed query; with nothing waiting it exits at once. The
agent runs only while the Mac is awake and logged in.

## Install

Save as `~/Library/LaunchAgents/com.openrecipe.laptop-worker.plist`, fixing the
paths (repo, and the Node bin directory from `dirname $(which node)`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.openrecipe.laptop-worker</string>
  <key>WorkingDirectory</key><string>/Users/michy/Desktop/OpenRecipe/apps/web</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/michy/.nvm/versions/node/v24.15.0/bin/pnpm</string>
    <string>worker</string>
    <string>--if-laptop-work</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/Users/michy/.nvm/versions/node/v24.15.0/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
  <key>StartInterval</key><integer>900</integer>
  <key>StandardOutPath</key><string>/Users/michy/Library/Logs/openrecipe-worker.log</string>
  <key>StandardErrorPath</key><string>/Users/michy/Library/Logs/openrecipe-worker.log</string>
</dict>
</plist>
```

Then:

    launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.openrecipe.laptop-worker.plist
    launchctl kickstart gui/$(id -u)/com.openrecipe.laptop-worker   # run once now
    tail ~/Library/Logs/openrecipe-worker.log

Remove with `launchctl bootout gui/$(id -u)/com.openrecipe.laptop-worker`.

A new Node version under nvm moves the binary: update both paths and
bootstrap again. If the log says "Operation not permitted", macOS is keeping
background jobs out of `~/Desktop` — give `node` Full Disk Access, or move
the repo out of `~/Desktop`.
