@echo off
setlocal DisableDelayedExpansion
title KDRIX - Reparateur du lien vers le suivi
echo.
echo =========================================================
echo  KDRIX - Installation / reparation du lien vers le suivi
echo =========================================================
echo.
echo Cette operation configure un raccourci local sur ce PC.
echo Les dossiers, clients et factures ne sont pas modifies.
echo Aucun document de suivi ne sera envoye sur Internet.
echo.
echo Choisissez le meme fichier HTML que votre favori habituel.
echo.
powershell.exe -NoProfile -STA -Command "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.OpenFileDialog; $d.Title='KDRIX - Selectionnez votre fichier de suivi habituel'; $d.Filter='Applications HTML (*.html;*.htm)|*.html;*.htm'; $d.InitialDirectory=(Join-Path $env:USERPROFILE 'Downloads'); $guess=(Join-Path $env:USERPROFILE 'Downloads\Suivi_KDRIX (1).html'); if([IO.File]::Exists($guess)){$d.FileName=$guess}; if($d.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK){Write-Host 'Selection annulee.';exit 2}; $target=[IO.Path]::GetFullPath($d.FileName); if(-not [IO.File]::Exists($target)){throw 'Fichier HTML introuvable.'}; $root=Join-Path $env:LOCALAPPDATA 'KDRIX'; [void](New-Item -ItemType Directory -Path $root -Force); $cible=Join-Path $root 'suivi-cible.txt'; [IO.File]::WriteAllText($cible,$target,(New-Object System.Text.UTF8Encoding($false))); $handler=Join-Path $root 'ouvrir-suivi.ps1'; $scriptLines=@('$ErrorActionPreference = ''Stop''','try {','  $folder = Join-Path $env:LOCALAPPDATA ''KDRIX''','  $file = Join-Path $folder ''suivi-cible.txt''','  $target = [IO.File]::ReadAllText($file, [Text.Encoding]::UTF8).Trim()','  if (-not [IO.File]::Exists($target)) { throw ''Le fichier de suivi est introuvable. Relancez le programme d installation depuis KDRIX.'' }','  $extension = [IO.Path]::GetExtension($target).ToLowerInvariant()','  if ($extension -ne ''.html'' -and $extension -ne ''.htm'') { throw ''Le fichier selectionne n est pas une application HTML.'' }','  Start-Process -FilePath $target','} catch {','  Add-Type -AssemblyName System.Windows.Forms','  [void][System.Windows.Forms.MessageBox]::Show($_.Exception.Message, ''KDRIX - Suivi des dossiers'')','}'); [IO.File]::WriteAllText($handler,($scriptLines -join [Environment]::NewLine),(New-Object System.Text.UTF8Encoding($true))); $key='HKCU:\Software\Classes\kdrix-suivi'; [void](New-Item -Path $key -Force); Set-Item -Path $key -Value 'URL:KDRIX Suivi local'; [void](New-ItemProperty -Path $key -Name 'URL Protocol' -Value '' -PropertyType String -Force); $cmdKey=Join-Path $key 'shell\open\command'; [void](New-Item -Path $cmdKey -Force); $exe=Join-Path $PSHOME 'powershell.exe'; $qq=[char]34; $placeholder=[char]37+'1'; $command=$qq+$exe+$qq+' -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File '+$qq+$handler+$qq+' '+$qq+$placeholder+$qq; Set-Item -Path $cmdKey -Value $command; Write-Host 'Lien local repare avec succes.' -ForegroundColor Green; Write-Host ('Fichier utilise : '+$target); Write-Host 'Ouverture du fichier pour verifier que vous retrouvez bien vos donnees...'; Start-Process -FilePath $target; Write-Host 'Vous pouvez maintenant revenir sur KDRIX et cliquer sur Ouvrir mon suivi.'"
if errorlevel 1 (
  echo.
  echo La configuration n a pas abouti. Prenez une photo du message d erreur.
) else (
  echo.
  echo Le fichier devrait etre ouvert dans le navigateur par defaut.
  echo Verifiez vos donnees, puis retournez sur le portail KDRIX.
)
echo.
pause
