# devbox-snapshot.ps1
#
# Reference implementation of the mechanical portion of the devbox-monitor skill
# (Steps 2-5 in SKILL.md). The agent is expected to handle initial config setup
# (Step 1) and the optional intelligent companion report (Step 6).
#
# Usage:
#   pwsh devbox-snapshot.ps1           # loop forever, sleeping intervalSeconds between cycles
#   pwsh devbox-snapshot.ps1 -Once     # take a single snapshot and exit
#
# Reads config from ~/.copilot/devbox-monitor-config.json by default. For Claude
# or other hosts, change $cfgPath below per Step 1 of SKILL.md.

param(
  [switch]$Once
)

$ErrorActionPreference = 'Continue'
$cfgPath = "$env:USERPROFILE\.copilot\devbox-monitor-config.json"
if (-not (Test-Path -LiteralPath $cfgPath)) {
  Write-Error "Config file not found at $cfgPath. Run the devbox-monitor skill through the agent to create it, or write one manually per SKILL.md Step 1."
  exit 2
}
try {
  $cfg = Get-Content -Raw -LiteralPath $cfgPath | ConvertFrom-Json
} catch {
  Write-Error "Failed to parse config at ${cfgPath}: $($_.Exception.Message)"
  exit 2
}

function Get-RepoSnapshot {
  param([string]$RepoPath)

  $snap = [ordered]@{
    name = Split-Path $RepoPath -Leaf
    path = $RepoPath
    error = $null
    git = $null
    pullRequests = @()
    aiSessions = @()
  }

  if (-not (Test-Path -LiteralPath $RepoPath)) {
    $snap.error = "path does not exist"
    return $snap
  }
  if (-not (Test-Path -LiteralPath (Join-Path $RepoPath '.git'))) {
    $snap.error = "not a git repo"
    return $snap
  }

  try {
    $branch = (git -C $RepoPath branch --show-current 2>$null).Trim()
    $logLine = git -C $RepoPath log -1 --pretty=format:"%H|%h|%s|%an|%ar|%aI" 2>$null
    $hashFull=$null;$hashShort=$null;$msg=$null;$author=$null;$relAge=$null;$ts=$null
    if ($logLine) {
      $parts = $logLine -split '\|', 6
      $hashFull,$hashShort,$msg,$author,$relAge,$ts = $parts
    }

    $statusRaw = git -C $RepoPath status --porcelain 2>$null
    $staged=0; $unstaged=0; $untracked=0
    if ($statusRaw) {
      foreach ($line in $statusRaw -split "`n") {
        if ($line.Length -lt 2) { continue }
        $x = $line.Substring(0,1); $y = $line.Substring(1,1)
        if ($line.StartsWith('??')) { $untracked++ }
        else {
          if ($x -ne ' ' -and $x -ne '?') { $staged++ }
          if ($y -ne ' ' -and $y -ne '?') { $unstaged++ }
        }
      }
    }

    $stashCount = (git -C $RepoPath stash list 2>$null | Measure-Object -Line).Lines

    $ahead=0; $behind=0
    $rev = git -C $RepoPath rev-list --count --left-right HEAD...'@{u}' 2>$null
    if ($rev) {
      $nums = ($rev.Trim() -split '\s+')
      if ($nums.Count -ge 2) { $ahead = [int]$nums[0]; $behind = [int]$nums[1] }
    }

    $remote = (git -C $RepoPath remote get-url origin 2>$null).Trim()
    if (-not $remote) { $remote = $null }

    $modFile = $null; $modTime = $null
    $modList = git -C $RepoPath ls-files --modified 2>$null
    if ($modList) {
      $newest = $null
      foreach ($f in ($modList -split "`n")) {
        $f = $f.Trim(); if (-not $f) { continue }
        $full = Join-Path $RepoPath $f
        if (Test-Path -LiteralPath $full) {
          $i = Get-Item -LiteralPath $full -Force
          if (-not $newest -or $i.LastWriteTime -gt $newest.LastWriteTime) { $newest = $i }
        }
      }
      if ($newest) {
        $modFile = $newest.FullName.Substring($RepoPath.Length).TrimStart('\','/').Replace('\','/')
        $modTime = $newest.LastWriteTime.ToUniversalTime().ToString('o')
      }
    }

    $snap.git = [ordered]@{
      branch = $branch
      remoteUrl = $remote
      lastCommit = if ($hashFull) {
        [ordered]@{
          hashFull = $hashFull; hashShort = $hashShort; message = $msg
          author = $author; relativeAge = $relAge; timestamp = $ts
        }
      } else { $null }
      remote = [ordered]@{ ahead = $ahead; behind = $behind }
      changes = [ordered]@{ staged = $staged; unstaged = $unstaged; untracked = $untracked }
      stashCount = [int]$stashCount
      mostRecentlyModifiedFile = [ordered]@{ path = $modFile; lastModified = $modTime }
    }

    if ($remote -and (Get-Command gh -ErrorAction SilentlyContinue)) {
      $originRepo = $remote -replace '\.git$','' -replace '^.*github\.com[:/]',''
      try {
        $prJson = gh pr list --repo $originRepo --head $branch --json number,title,state,isDraft 2>$null
        if ($prJson) { $snap.pullRequests = ($prJson | ConvertFrom-Json) }
      } catch {}
    }

    $branches = @()
    $branchRaw = git -C $RepoPath for-each-ref `
      --sort=-committerdate `
      --format='%(refname:short)|%(objectname)|%(objectname:short)|%(committerdate:iso-strict)|%(committerdate:relative)|%(authorname)|%(subject)' `
      refs/heads/ 2>$null
    if ($branchRaw) {
      foreach ($line in $branchRaw -split "`n") {
        $line = $line.Trim()
        if (-not $line) { continue }
        $p = $line -split '\|', 7
        if ($p.Count -lt 7) { continue }
        $branches += [ordered]@{
          name         = $p[0]
          isCurrent    = ($p[0] -eq $branch)
          hashFull     = $p[1]
          hashShort    = $p[2]
          committed    = $p[3]
          relativeAge  = $p[4]
          author       = $p[5]
          subject      = $p[6]
        }
        if ($branches.Count -ge 50) { break }
      }
    }
    $snap.git.branches = $branches
  } catch {
    $snap.error = "snapshot failed: $($_.Exception.Message)"
  }

  return $snap
}

function Get-AiSessions {
  $sessions = New-Object System.Collections.Generic.List[object]
  $sessRoot = "$env:USERPROFILE\.copilot\session-state"
  if (-not (Test-Path $sessRoot)) { return ,@() }

  Get-ChildItem $sessRoot -Recurse -Force -File -Filter 'inuse.*.lock' -ErrorAction SilentlyContinue | ForEach-Object {
    $lock = $_
    $sessionDir = $lock.Directory
    $sessionId  = $sessionDir.Name

    $pid_ = $null
    if ($lock.Name -match '^inuse\.(\d+)\.lock$') { $pid_ = [int]$matches[1] }

    $proc = if ($pid_) { Get-Process -Id $pid_ -ErrorAction SilentlyContinue } else { $null }
    $alive = [bool]$proc
    $procName = if ($proc) { $proc.Name } else { $null }
    $startTime = $null
    if ($proc) { try { $startTime = $proc.StartTime.ToUniversalTime().ToString('o') } catch {} }

    $cwd = $null; $gitRoot = $null; $branch = $null; $summary = $null; $repository = $null
    $w = Join-Path $sessionDir.FullName 'workspace.yaml'
    if (Test-Path -LiteralPath $w) {
      foreach ($line in Get-Content -LiteralPath $w) {
        switch -regex ($line) {
          '^cwd:\s*(.+)$'        { $cwd        = $matches[1].Trim() }
          '^git_root:\s*(.+)$'   { $gitRoot    = $matches[1].Trim() }
          '^branch:\s*(.+)$'     { $branch     = $matches[1].Trim() }
          '^summary:\s*(.+)$'    { $summary    = $matches[1].Trim() }
          '^repository:\s*(.+)$' { $repository = $matches[1].Trim() }
        }
      }
    }

    $sessions.Add([ordered]@{
      source          = 'inuse-lock'
      state           = if ($alive) { 'live' } else { 'stale' }
      processName     = $procName
      pid             = $pid_
      startTime       = $startTime
      lockTime        = $lock.LastWriteTime.ToUniversalTime().ToString('o')
      sessionId       = $sessionId
      sessionStateDir = $sessionDir.FullName
      workingDir      = $cwd
      gitRoot         = $gitRoot
      branch          = $branch
      repository      = $repository
      description     = $summary
    })
  }

  return ,$sessions.ToArray()
}

function Take-Snapshot {
  $repoSnaps = @()
  foreach ($r in $cfg.repos) { $repoSnaps += Get-RepoSnapshot -RepoPath $r }

  $sessions = Get-AiSessions
  $matchedIds = @{}
  $repoSnapsByLength = $repoSnaps | Sort-Object { if ($_.path) { $_.path.Length } else { 0 } } -Descending
  foreach ($snap in $repoSnapsByLength) {
    $matched = @()
    foreach ($s in $sessions) {
      if (-not $s.sessionId -or $matchedIds.ContainsKey($s.sessionId)) { continue }
      $sessionRepo = if ($s.gitRoot) { $s.gitRoot } else { $s.workingDir }
      if (-not $sessionRepo -or -not $snap.path) { continue }
      $repoPath = $snap.path.TrimEnd('\','/').Replace('/', '\')
      $sessionRepoNorm = $sessionRepo.TrimEnd('\','/').Replace('/', '\')
      if ($sessionRepoNorm.Equals($repoPath, [StringComparison]::OrdinalIgnoreCase) -or
          $sessionRepoNorm.StartsWith("$repoPath\", [StringComparison]::OrdinalIgnoreCase)) {
        $matched += $s
        $matchedIds[$s.sessionId] = $true
      }
    }
    $snap.aiSessions = $matched
  }
  $orphanedSessions = @($sessions | Where-Object { $_.sessionId -and -not $matchedIds.ContainsKey($_.sessionId) })

  $payload = [ordered]@{
    schemaVersion = '1.0'
    hostname = $cfg.hostname
    capturedAt = (Get-Date).ToUniversalTime().ToString('o')
    repos = $repoSnaps
    orphanedAiSessions = $orphanedSessions
  }

  $sp = $cfg.syncPath
  if (-not (Test-Path -LiteralPath $sp)) { New-Item -ItemType Directory -Path $sp -Force | Out-Null }
  $latest = Join-Path $sp ("{0}-latest.json" -f $cfg.hostname)
  $tsForFile = $payload.capturedAt -replace ':','-'
  $archive = Join-Path $sp ("{0}-{1}.json" -f $cfg.hostname, $tsForFile)

  $json = $payload | ConvertTo-Json -Depth 10
  $json | Set-Content -Encoding utf8 -LiteralPath $latest
  $json | Set-Content -Encoding utf8 -LiteralPath $archive

  $liveSessions = @($repoSnaps | ForEach-Object { $_.aiSessions } | Where-Object { $_.state -eq 'live' }).Count
  $staleInRepos = @($repoSnaps | ForEach-Object { $_.aiSessions } | Where-Object { $_.state -eq 'stale' }).Count
  $orphanCount = @($orphanedSessions).Count
  $staleSessions = $staleInRepos + @($orphanedSessions | Where-Object { $_.state -eq 'stale' }).Count
  $reposWithChanges = @($repoSnaps | Where-Object { $_.git -and (($_.git.changes.staged + $_.git.changes.unstaged + $_.git.changes.untracked) -gt 0) }).Count
  $totalBranches = ($repoSnaps | ForEach-Object { if ($_.git) { $_.git.branches.Count } else { 0 } } | Measure-Object -Sum).Sum
  $now = Get-Date -Format 'HH:mm:ss'
  Write-Host ("[{0}] OK {1} repos | {2} branches | {3} live sessions ({4} stale, {5} orphaned) | {6} repos w/ changes -> {7} | next in {8}s" -f `
    $now, $repoSnaps.Count, $totalBranches, $liveSessions, $staleSessions, $orphanCount, $reposWithChanges, $sp, $cfg.intervalSeconds)
}

Take-Snapshot
if ($Once) { return }
while ($true) {
  Start-Sleep -Seconds $cfg.intervalSeconds
  Take-Snapshot
}
