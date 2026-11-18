# Deterministic conversion of the supplied logo; no drawing or AI generation.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path $PSScriptRoot -Parent
$sourcePath = Join-Path $projectRoot 'assets/nandanails-logo-original.jpg'
$iconDirectory = Join-Path $projectRoot 'assets/icons/n-v1'
[System.IO.Directory]::CreateDirectory($iconDirectory) | Out-Null
$sourceImage = [System.Drawing.Bitmap]::new($sourcePath)

function New-IconPng([int]$size) {
    $bitmap = [System.Drawing.Bitmap]::new($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $stream = [System.IO.MemoryStream]::new()
    try {
        # Contain the entire artwork, centered, without clipping or stretching N.
        $graphics.Clear($sourceImage.GetPixel(0, 0))
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $scale = [Math]::Min($size / $sourceImage.Width, $size / $sourceImage.Height)
        $width = [single]($sourceImage.Width * $scale)
        $height = [single]($sourceImage.Height * $scale)
        $destination = [System.Drawing.RectangleF]::new(($size - $width) / 2, ($size - $height) / 2, $width, $height)
        $sourceRectangle = [System.Drawing.RectangleF]::new(0, 0, $sourceImage.Width, $sourceImage.Height)
        $graphics.DrawImage($sourceImage, $destination, $sourceRectangle, [System.Drawing.GraphicsUnit]::Pixel)
        $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
        return ,$stream.ToArray()
    } finally { $stream.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
}

try {
    foreach ($variant in @(
        @{Name='favicon-16x16.png'; Size=16},
        @{Name='favicon-32x32.png'; Size=32},
        @{Name='apple-touch-icon.png'; Size=180},
        @{Name='icon-192.png'; Size=192},
        @{Name='icon-512.png'; Size=512}
    )) {
        [System.IO.File]::WriteAllBytes((Join-Path $iconDirectory $variant.Name), (New-IconPng $variant.Size))
    }
    # ICO with three PNG-backed entries: 16, 32 and 48 px.
    $sizes = @(16, 32, 48)
    $payloads = @($sizes | ForEach-Object { ,(New-IconPng $_) })
    $icoStream = [System.IO.MemoryStream]::new()
    $writer = [System.IO.BinaryWriter]::new($icoStream)
    try {
        $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
        $offset = 6 + 16 * $sizes.Count
        for ($i = 0; $i -lt $sizes.Count; $i++) {
            $writer.Write([byte]$sizes[$i]); $writer.Write([byte]$sizes[$i])
            $writer.Write([byte]0); $writer.Write([byte]0)
            $writer.Write([uint16]1); $writer.Write([uint16]32)
            $writer.Write([uint32]$payloads[$i].Length); $writer.Write([uint32]$offset)
            $offset += $payloads[$i].Length
        }
        foreach ($payload in $payloads) { $writer.Write([byte[]]$payload) }
        $writer.Flush()
        [System.IO.File]::WriteAllBytes((Join-Path $iconDirectory 'favicon.ico'), $icoStream.ToArray())
    } finally { $writer.Dispose(); $icoStream.Dispose() }
} finally { $sourceImage.Dispose() }
Write-Output 'Favicons generated in assets/icons/n-v1; original image preserved.'
