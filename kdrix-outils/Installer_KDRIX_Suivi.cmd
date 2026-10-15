@echo off
setlocal
title KDRIX - Ouvrir le suivi depuis le portail
echo.
echo =============================================
echo  KDRIX - Raccourci vers votre suivi local
echo =============================================
echo.
echo Ce programme configure un lien entre le portail
echo KDRIX et votre fichier HTML deja present sur ce PC.
echo.
echo Aucun fichier ni aucune donnee client n'est envoye sur Internet.
echo Cette operation ne demande pas de droits administrateur.
echo.
echo Une fenetre va s'ouvrir : choisissez le fichier HTML
echo correspondant a votre favori Suivi KDRIX.
echo.
powershell.exe -NoProfile -STA -Command "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.OpenFileDialog; $d.Title='KDRIX - Choisissez le fichier Suivi_KDRIX.html'; $d.Filter='Applications HTML (*.html;*.htm)|*.html;*.htm'; $d.InitialDirectory=(Join-Path $env:USERPROFILE 'Downloads'); $g=Join-Path $env:USERPROFILE 'Downloads\Suivi_KDRIX (1).html'; if(Test-Path -LiteralPath $g){$d.FileName=$g}; if($d.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK){ Write-Host 'Selection annulee.'; exit 2 }; $uri=([uri]$d.FileName).AbsoluteUri; $roots=@($env:ProgramFiles,[Environment]::GetEnvironmentVariable('ProgramFiles(x86)'),$env:LOCALAPPDATA)|Where-Object{$_}; $c=@(); foreach($rt in $roots){$c+=(Join-Path $rt 'Google\Chrome\Application\chrome.exe')}; foreach($rt in $roots){$c+=(Join-Path $rt 'Microsoft\Edge\Application\msedge.exe')}; $browser=$c|Where-Object{Test-Path -LiteralPath $_ -PathType Leaf}|Select-Object -First 1; if(-not $browser){throw 'Google Chrome ou Microsoft Edge introuvable.'}; $key='HKCU:\Software\Classes\kdrix-suivi'; New-Item -Path $key -Force|Out-Null; Set-Item -Path $key -Value 'URL:KDRIX Suivi local'; New-ItemProperty -Path $key -Name 'URL Protocol' -Value '' -PropertyType String -Force|Out-Null; $commandKey=Join-Path $key 'shell\open\command'; New-Item -Path $commandKey -Force|Out-Null; $q=[char]34; $command=$q+$browser+$q+' --new-tab '+$q+$uri+$q; Set-Item -Path $commandKey -Value $command; Write-Host 'CONFIGURATION TERMINEE !' -ForegroundColor Green; Write-Host 'Retournez au portail KDRIX et cliquez sur Ouvrir mon suivi.';"
if errorlevel 1 (
  echo.
  echo Le raccourci n'a pas ete installe. Consultez le message ci-dessus.
) else (
  echo.
  echo Votre suivi reste sur ce PC : aucune donnee n'a ete deplacee.
  echo Lors du premier clic depuis KDRIX, autorisez l'ouverture du navigateur.
)
echo.
pause
