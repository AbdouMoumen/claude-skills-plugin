# Symlink Commands

These commands are adapted from the repository setup guide. Replace `<repo>` with the resolved absolute dotfiles path.

## Managed Targets

| Local target                 | Repo source                      | Type      |
| ---------------------------- | -------------------------------- | --------- |
| `~/.claude/skills`           | `<repo>/claude/skills`           | directory |
| `~/.claude/settings.json`    | `<repo>/claude/settings.json`    | file      |
| `~/.copilot/config.json`     | `<repo>/copilot/config.json`     | file      |
| `~/.copilot/mcp-config.json` | `<repo>/copilot/mcp-config.json` | file      |
| VS Code `User/prompts`       | `<repo>/copilot/prompts`         | directory |

## Backup Rule

Before replacing an existing real file or directory, back it up with a timestamp suffix:

```bash
mv "<target>" "<target>.backup-YYYYMMDD-HHMMSS"
```

On PowerShell:

```powershell
Move-Item -LiteralPath "<target>" -Destination "<target>.backup-YYYYMMDD-HHMMSS"
```

If the existing target is a wrong or broken symlink, remove only the symlink itself.

## Windows: PowerShell + cmd mklink

Create parent directories first:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude" | Out-Null
New-Item -ItemType Directory -Force "$env:USERPROFILE\.copilot" | Out-Null
```

Create Claude links:

```powershell
cmd /c mklink /D "$env:USERPROFILE\.claude\skills" "<repo>\claude\skills"
cmd /c mklink "$env:USERPROFILE\.claude\settings.json" "<repo>\claude\settings.json"
```

Create Copilot CLI links:

```powershell
cmd /c mklink "$env:USERPROFILE\.copilot\config.json" "<repo>\copilot\config.json"
cmd /c mklink "$env:USERPROFILE\.copilot\mcp-config.json" "<repo>\copilot\mcp-config.json"
```

Create VS Code prompt link after choosing the correct VS Code user directory:

```powershell
cmd /c mklink /D "<VS Code User>\prompts" "<repo>\copilot\prompts"
```

Common VS Code user directories on Windows:

```text
%APPDATA%\Code\User
%APPDATA%\Code - Insiders\User
%APPDATA%\VSCodium\User
```

### Windows permission failure

If `mklink` fails with an operation-not-permitted error:

1. Enable Windows Developer Mode, or
2. Rerun the terminal as Administrator.

## Windows: Git Bash form

When running from Git Bash, use `cmd //c` if `cmd /c` path conversion causes problems:

```bash
cmd //c "mklink /D %USERPROFILE%\.claude\skills <repo>\claude\skills"
cmd //c "mklink %USERPROFILE%\.claude\settings.json <repo>\claude\settings.json"
```

PowerShell is preferred for robust path handling on Windows.

## macOS and Linux

Create parent directories first:

```bash
mkdir -p "$HOME/.claude" "$HOME/.copilot"
```

Create Claude links:

```bash
ln -s "<repo>/claude/skills" "$HOME/.claude/skills"
ln -s "<repo>/claude/settings.json" "$HOME/.claude/settings.json"
```

Create Copilot CLI links:

```bash
ln -s "<repo>/copilot/config.json" "$HOME/.copilot/config.json"
ln -s "<repo>/copilot/mcp-config.json" "$HOME/.copilot/mcp-config.json"
```

Create VS Code prompt link after choosing the correct VS Code user directory:

```bash
ln -s "<repo>/copilot/prompts" "<VS Code User>/prompts"
```

Common VS Code user directories:

```text
macOS stable:   ~/Library/Application Support/Code/User
macOS insiders: ~/Library/Application Support/Code - Insiders/User
Linux stable:   ~/.config/Code/User
Linux insiders: ~/.config/Code - Insiders/User
VSCodium:       ~/.config/VSCodium/User
```

## Verify Links

Use platform-appropriate commands to inspect and resolve symlinks.

macOS/Linux:

```bash
ls -la "$HOME/.claude"
readlink "$HOME/.claude/skills"
readlink "$HOME/.claude/settings.json"
```

PowerShell:

```powershell
Get-Item "$env:USERPROFILE\.claude\skills" | Format-List FullName,LinkType,Target
Get-Item "$env:USERPROFILE\.claude\settings.json" | Format-List FullName,LinkType,Target
```
