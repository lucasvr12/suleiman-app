# Servidor HTTP Backend en PowerShell nativo para Allianz Optimaxx Plus NL
# Escucha en http://localhost:8080/

$port = 8080
$url = "http://localhost:$port/"
$dataFolder = Join-Path $PSScriptRoot "data"
$leadsFile = Join-Path $dataFolder "leads_calificados.json"
$bloqueosFile = Join-Path $dataFolder "bloqueos_calendario.json"
$GoogleCalendarWebhookUrl = "https://script.google.com/macros/s/AKfycbw3Q-EpcVn886IOacW83le0PZFmkP86AyONFH6uYFceT8rmf8pcUvyotHQuFtibtUmhEg/exec"

# Asegurar directorios y archivos
if (-not (Test-Path $dataFolder)) {
    New-Item -ItemType Directory -Path $dataFolder -Force | Out-Null
}
if (-not (Test-Path $leadsFile)) {
    Set-Content -Path $leadsFile -Value "[]" -Encoding UTF8
}
if (-not (Test-Path $bloqueosFile)) {
    Set-Content -Path $bloqueosFile -Value "[]" -Encoding UTF8
}

# Funciones de base de datos
function ConvertTo-JsonArray ($array) {
    if ($null -eq $array) {
        return "[]"
    }
    [array]$arr = $array
    if ($arr.Count -eq 0) {
        return "[]"
    }
    $json = ConvertTo-Json $arr -Depth 100
    if ($arr.Count -eq 1 -and -not $json.StartsWith("[")) {
        return "[$json]"
    }
    return $json
}

function Get-Leads {
    try {
        $content = Get-Content -Raw -Path $leadsFile -ErrorAction Stop
        if ([string]::IsNullOrWhiteSpace($content)) { return ,@() }
        $parsed = ConvertFrom-Json $content
        if ($null -eq $parsed) { return ,@() }
        if ($parsed -isnot [array]) { return ,@($parsed) }
        return ,$parsed
    } catch {
        Write-Host "Error al leer leads: $_" -ForegroundColor Red
        return ,@()
    }
}

function Save-Leads ($leads) {
    try {
        $json = ConvertTo-JsonArray $leads
        Set-Content -Path $leadsFile -Value $json -Encoding UTF8 -Force
    } catch {
        Write-Host "Error al guardar leads: $_" -ForegroundColor Red
    }
}

function Get-Bloqueos {
    try {
        $content = Get-Content -Raw -Path $bloqueosFile -ErrorAction Stop
        if ([string]::IsNullOrWhiteSpace($content)) { return ,@() }
        $parsed = ConvertFrom-Json $content
        if ($null -eq $parsed) { return ,@() }
        if ($parsed -isnot [array]) { return ,@($parsed) }
        return ,$parsed
    } catch {
        Write-Host "Error al leer bloqueos: $_" -ForegroundColor Red
        return ,@()
    }
}

function Save-Bloqueos ($bloqueos) {
    try {
        $json = ConvertTo-JsonArray $bloqueos
        Set-Content -Path $bloqueosFile -Value $json -Encoding UTF8 -Force
    } catch {
        Write-Host "Error al guardar bloqueos: $_" -ForegroundColor Red
    }
}

function Send-GoogleCalendarEvent ($leadObject) {
    if ([string]::IsNullOrWhiteSpace($GoogleCalendarWebhookUrl)) {
        Write-Host "Google Calendar Webhook no configurado. Omitiendo sincronización." -ForegroundColor Yellow
        return
    }

    Write-Host "Iniciando sincronización asíncrona con Google Calendar..." -ForegroundColor Cyan
    
    $payload = ConvertTo-Json $leadObject -Depth 100
    
    # Ejecutar en segundo plano mediante un Job nativo para no bloquear la respuesta HTTP
    Start-Job -ScriptBlock {
        param($url, $jsonBody)
        try {
            $ProgressPreference = 'SilentlyContinue'
            $response = Invoke-RestMethod -Uri $url -Method Post -Body $jsonBody -ContentType "application/json; charset=utf-8"
            return $response
        } catch {
            return "Error: $_"
        }
    } -ArgumentList $GoogleCalendarWebhookUrl, $payload | Out-Null
}

# Iniciar Listener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)

try {
    $listener.Start()
    Write-Host "==========================================================" -ForegroundColor Yellow
    Write-Host " SERVIDOR BACKEND ALLIANZ OPTIMAXX PLUS INICIADO" -ForegroundColor Yellow
    Write-Host " Escuchando en: $url" -ForegroundColor Green
    Write-Host " Directorio de datos: $dataFolder" -ForegroundColor Cyan
    Write-Host " Presione Ctrl+C en esta consola para detener el servidor" -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Yellow
} catch {
    Write-Host "Error al iniciar el servidor HTTP en el puerto $port : $_" -ForegroundColor Red
    Write-Host "Por favor asegúrese de que el puerto $port no esté en uso." -ForegroundColor Yellow
    Exit 1
}

# Función para enviar respuestas HTTP
function Send-Response ($context, $statusCode, $contentType, $contentBytes) {
    $response = $context.Response
    $response.StatusCode = $statusCode
    $response.ContentType = $contentType
    
    # Cabeceras CORS
    $response.Headers.Add("Access-Control-Allow-Origin", "*")
    $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")
    
    try {
        $response.ContentLength64 = $contentBytes.Length
        $output = $response.OutputStream
        $output.Write($contentBytes, 0, $contentBytes.Length)
        $output.Close()
    } catch {
        Write-Host "Error al enviar respuesta: $_" -ForegroundColor Red
    }
}

function Send-StringResponse ($context, $statusCode, $contentType, $stringContent) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($stringContent)
    Send-Response $context $statusCode $contentType $bytes
}

# Servir archivos estáticos
function Serve-StaticFile ($context, $relativePath, $contentType) {
    $filePath = Join-Path $PSScriptRoot $relativePath
    if (Test-Path $filePath) {
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        Send-Response $context 200 $contentType $bytes
    } else {
        Send-StringResponse $context 404 "text/plain; charset=utf-8" "Archivo no encontrado: $relativePath"
    }
}

# Loop principal
while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $path = $request.Url.AbsolutePath
        $method = $request.HttpMethod

        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $method $path" -ForegroundColor Gray

        # Preflight CORS
        if ($method -eq "OPTIONS") {
            Send-StringResponse $context 200 "text/plain" ""
            continue
        }

        # Enrutamiento de archivos estáticos
        if ($path -eq "/" -or $path -eq "/index.html") {
            Serve-StaticFile $context "index.html" "text/html; charset=utf-8"
        }
        elseif ($path -eq "/style.css") {
            Serve-StaticFile $context "style.css" "text/css; charset=utf-8"
        }
        elseif ($path -eq "/app.js") {
            Serve-StaticFile $context "app.js" "application/javascript; charset=utf-8"
        }
        
        # Enrutamiento de API
        elseif ($path -eq "/api/bloqueos" -and $method -eq "GET") {
            $bloqueos = Get-Bloqueos
            $json = ConvertTo-JsonArray $bloqueos
            Send-StringResponse $context 200 "application/json; charset=utf-8" $json
        }
        
        elseif ($path -eq "/api/leads" -and $method -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $body = $reader.ReadToEnd()
            $reader.Close()

            if ([string]::IsNullOrWhiteSpace($body)) {
                Send-StringResponse $context 400 "application/json" '{"error":"Cuerpo de solicitud vacío"}'
                continue
            }

            try {
                $newLead = ConvertFrom-Json $body
            } catch {
                Send-StringResponse $context 400 "application/json" '{"error":"JSON inválido en el cuerpo"}'
                continue
            }

            # Validar campos obligatorios
            if ([string]::IsNullOrWhiteSpace($newLead.nombre) -or [string]::IsNullOrWhiteSpace($newLead.whatsapp)) {
                Send-StringResponse $context 400 "application/json" '{"error":"Nombre y WhatsApp son obligatorios"}'
                continue
            }

            # Leer bases de datos actuales
            [array]$leads = Get-Leads
            [array]$bloqueos = Get-Bloqueos

            # Calcular ID autoincrementable
            $nextLeadId = 1
            if ($leads.Count -gt 0) {
                $ids = $leads | ForEach-Object { [int]$_.id }
                $nextLeadId = ($ids | Measure-Object -Maximum).Maximum + 1
            }

            # Determinar Estatus e inicializar campos por defecto
            $estatus = "Agendada"
            if ($newLead.capacidad_ahorro -eq "Menos de `$2,000") {
                $estatus = "No Califica"
            }

            $fechaCita = $null
            if ($null -ne $newLead.fecha_cita -and -not [string]::IsNullOrWhiteSpace($newLead.fecha_cita)) {
                $fechaCita = $newLead.fecha_cita
            }

            # Crear objeto Lead calificado estructurado
            $leadObject = [PSCustomObject]@{
                id = $nextLeadId
                nombre = $newLead.nombre
                whatsapp = $newLead.whatsapp
                profesion = $newLead.profesion
                capacidad_ahorro = $newLead.capacidad_ahorro
                declara_impuestos = $newLead.declara_impuestos
                fecha_cita = $fechaCita
                estatus = $estatus
                fecha_creacion = (Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz")
            }

            # Si califica y seleccionó cita, insertar bloqueo
            if ($estatus -eq "Agendada" -and $null -ne $fechaCita) {
                # Validar duplicados de bloqueo
                $existeBloqueo = $bloqueos | Where-Object { $_.fecha_hora_bloqueada -eq $fechaCita }
                if ($null -ne $existeBloqueo) {
                    Send-StringResponse $context 409 "application/json" '{"error":"El horario ya se encuentra ocupado."}'
                    continue
                }

                # Generar ID de bloqueo autoincrementable
                $nextBlockId = 1
                if ($bloqueos.Count -gt 0) {
                    $blockIds = $bloqueos | ForEach-Object { [int]$_.id }
                    $nextBlockId = ($blockIds | Measure-Object -Maximum).Maximum + 1
                }

                $newBlock = [PSCustomObject]@{
                    id = $nextBlockId
                    fecha_hora_bloqueada = $fechaCita
                }

                $bloqueos += $newBlock
                Save-Bloqueos $bloqueos
                Write-Host "Horario bloqueado: $fechaCita" -ForegroundColor Yellow
            }

            # Agregar lead y guardar
            $leads += $leadObject
            Save-Leads $leads

            # Sincronizar con Google Calendar si la cita está agendada
            if ($estatus -eq "Agendada") {
                Send-GoogleCalendarEvent $leadObject
            }

            Write-Host "Lead guardado con éxito. ID: $($leadObject.id), Nombre: $($leadObject.nombre), Califica: $($estatus)" -ForegroundColor Green

            $responseJson = ConvertTo-Json $leadObject -Depth 100
            Send-StringResponse $context 201 "application/json; charset=utf-8" $responseJson
        }
        
        elseif ($path -eq "/api/bloqueos" -and $method -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
            $body = $reader.ReadToEnd()
            $reader.Close()

            if ([string]::IsNullOrWhiteSpace($body)) {
                Send-StringResponse $context 400 "application/json" '{"error":"Cuerpo de solicitud vacío"}'
                continue
            }

            $newBlockInput = ConvertFrom-Json $body
            if ([string]::IsNullOrWhiteSpace($newBlockInput.fecha_hora_bloqueada)) {
                Send-StringResponse $context 400 "application/json" '{"error":"fecha_hora_bloqueada es obligatoria"}'
                continue
            }

            [array]$bloqueos = Get-Bloqueos
            
            # Evitar duplicados
            $existe = $bloqueos | Where-Object { $_.fecha_hora_bloqueada -eq $newBlockInput.fecha_hora_bloqueada }
            if ($null -ne $existe) {
                Send-StringResponse $context 409 "application/json" '{"error":"Horario ya bloqueado"}'
                continue
            }

            $nextBlockId = 1
            if ($bloqueos.Count -gt 0) {
                $blockIds = $bloqueos | ForEach-Object { [int]$_.id }
                $nextBlockId = ($blockIds | Measure-Object -Maximum).Maximum + 1
            }

            $blockObject = [PSCustomObject]@{
                id = $nextBlockId
                fecha_hora_bloqueada = $newBlockInput.fecha_hora_bloqueada
            }

            $bloqueos += $blockObject
            Save-Bloqueos $bloqueos

            Write-Host "Bloqueo manual creado: $($blockObject.fecha_hora_bloqueada)" -ForegroundColor Yellow
            $responseJson = ConvertTo-Json $blockObject -Depth 100
            Send-StringResponse $context 201 "application/json; charset=utf-8" $responseJson
        }
        
        # Ruta no encontrada
        else {
            Send-StringResponse $context 404 "text/plain; charset=utf-8" "Ruta no encontrada"
        }
    } catch {
        Write-Host "Error en el ciclo del listener: $_" -ForegroundColor Red
        if ($null -ne $context) {
            try {
                Send-StringResponse $context 500 "application/json" '{"error":"Error interno del servidor"}'
            } catch {}
        }
    }
}
