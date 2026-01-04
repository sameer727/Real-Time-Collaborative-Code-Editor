param(
  [string]$token,
  [int]$attempts = 30,
  [int]$delay = 10
)

$url = "https://api.github.com/repos/sameer727/Real-Time-Collaborative-Code-Editor/actions/runs?branch=ci/e2e&per_page=1"
$headers = @{ Authorization = "token $token"; Accept = 'application/vnd.github.v3+json' }

for ($i = 0; $i -lt $attempts; $i++) {
  $r = Invoke-RestMethod -Uri $url -Headers $headers
  $run = $r.workflow_runs[0]
  if (-not $run) {
    Write-Host "No runs yet"
    Start-Sleep -Seconds $delay
    continue
  }
  Write-Host ("[{0}] status={1} conclusion={2} url={3}" -f (Get-Date -Format o), $run.status, $run.conclusion, $run.html_url)
  if ($run.status -ne 'in_progress' -and $run.status -ne 'queued') { exit 0 }
  Start-Sleep -Seconds $delay
}
Write-Host "Timeout waiting for run to complete"
exit 2
