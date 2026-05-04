$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

function Test-IsScreenPixel {
	param(
		[System.Drawing.Color]$Pixel
	)

	if ($Pixel.A -lt 10) {
		return $false
	}

	$deltaRg = [Math]::Abs($Pixel.R - $Pixel.G)
	$deltaGb = [Math]::Abs($Pixel.G - $Pixel.B)
	return $deltaRg -le 18 -and $deltaGb -le 18 -and $Pixel.R -ge 70 -and $Pixel.R -le 200
}

function New-TransparentBitmap {
	param(
		[int]$Width,
		[int]$Height
	)

	return New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
}

function Get-AverageColor {
	param(
		[System.Drawing.Bitmap]$Image
	)

	$stepX = [Math]::Max(1, [Math]::Floor($Image.Width / 48))
	$stepY = [Math]::Max(1, [Math]::Floor($Image.Height / 48))
	$sumR = 0.0
	$sumG = 0.0
	$sumB = 0.0
	$count = 0.0

	for ($x = 0; $x -lt $Image.Width; $x += $stepX) {
		for ($y = 0; $y -lt $Image.Height; $y += $stepY) {
			$pixel = $Image.GetPixel($x, $y)
			if ($pixel.A -lt 10) {
				continue
			}

			$sumR += $pixel.R
			$sumG += $pixel.G
			$sumB += $pixel.B
			$count += 1
		}
	}

	if ($count -eq 0) {
		return [System.Drawing.Color]::FromArgb(255, 245, 245, 245)
	}

	$r = [int][Math]::Round($sumR / $count)
	$g = [int][Math]::Round($sumG / $count)
	$b = [int][Math]::Round($sumB / $count)

	return [System.Drawing.Color]::FromArgb(255, $r, $g, $b)
}

function Draw-Cover {
	param(
		[System.Drawing.Graphics]$Graphics,
		[System.Drawing.Bitmap]$Image,
		[System.Drawing.RectangleF]$DestinationRect,
		[double]$FocusX = 0.5,
		[double]$FocusY = 0.0
	)

	$scale = [Math]::Max($DestinationRect.Width / $Image.Width, $DestinationRect.Height / $Image.Height)
	$srcWidth = $DestinationRect.Width / $scale
	$srcHeight = $DestinationRect.Height / $scale
	$maxSrcX = [Math]::Max(0, $Image.Width - $srcWidth)
	$maxSrcY = [Math]::Max(0, $Image.Height - $srcHeight)
	$srcX = $maxSrcX * $FocusX
	$srcY = $maxSrcY * $FocusY
	$srcRect = New-Object System.Drawing.RectangleF([single]$srcX, [single]$srcY, [single]$srcWidth, [single]$srcHeight)
	$Graphics.DrawImage($Image, $DestinationRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
}

function Draw-Contain {
	param(
		[System.Drawing.Graphics]$Graphics,
		[System.Drawing.Bitmap]$Image,
		[System.Drawing.RectangleF]$DestinationRect,
		[System.Drawing.Color]$BackgroundColor,
		[double]$AlignY = 0.04
	)

	$brush = New-Object System.Drawing.SolidBrush($BackgroundColor)
	$Graphics.FillRectangle($brush, $DestinationRect)
	$brush.Dispose()

	$scale = [Math]::Min($DestinationRect.Width / $Image.Width, $DestinationRect.Height / $Image.Height)
	$drawWidth = $Image.Width * $scale
	$drawHeight = $Image.Height * $scale
	$offsetX = ($DestinationRect.Width - $drawWidth) / 2
	$offsetY = ($DestinationRect.Height - $drawHeight) * $AlignY
	$drawRect = New-Object System.Drawing.RectangleF(
		[single]($DestinationRect.X + $offsetX),
		[single]($DestinationRect.Y + $offsetY),
		[single]$drawWidth,
		[single]$drawHeight
	)

	$Graphics.DrawImage($Image, $drawRect)
}

function New-MaskBitmap {
	param(
		[string]$MockPath,
		[hashtable]$Region
	)

	$mock = [System.Drawing.Bitmap]::FromFile($MockPath)
	$mask = New-TransparentBitmap -Width $mock.Width -Height $mock.Height

	for ($x = $Region.x1; $x -le $Region.x2; $x++) {
		for ($y = $Region.y1; $y -le $Region.y2; $y++) {
			$pixel = $mock.GetPixel($x, $y)
			if (Test-IsScreenPixel -Pixel $pixel) {
				$mask.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, 255, 255, 255))
			}
		}
	}

	$mock.Dispose()
	return $mask
}

function Erode-MaskBitmap {
	param(
		[System.Drawing.Bitmap]$SourceMask,
		[hashtable]$Region,
		[int]$Radius
	)

	if ($Radius -le 0) {
		return $SourceMask
	}

	$eroded = New-TransparentBitmap -Width $SourceMask.Width -Height $SourceMask.Height

	for ($x = $Region.x1; $x -le $Region.x2; $x++) {
		for ($y = $Region.y1; $y -le $Region.y2; $y++) {
			if ($SourceMask.GetPixel($x, $y).A -eq 0) {
				continue
			}

			$keepPixel = $true
			for ($offsetX = -$Radius; $offsetX -le $Radius -and $keepPixel; $offsetX++) {
				for ($offsetY = -$Radius; $offsetY -le $Radius; $offsetY++) {
					$checkX = $x + $offsetX
					$checkY = $y + $offsetY
					if ($checkX -lt $Region.x1 -or $checkX -gt $Region.x2 -or $checkY -lt $Region.y1 -or $checkY -gt $Region.y2) {
						$keepPixel = $false
						break
					}

					if ($SourceMask.GetPixel($checkX, $checkY).A -eq 0) {
						$keepPixel = $false
						break
					}
				}
			}

			if ($keepPixel) {
				$eroded.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, 255, 255, 255))
			}
		}
	}

	$SourceMask.Dispose()
	return $eroded
}

function New-ScreenMasks {
	param(
		[string]$MockPath,
		[array]$Regions
	)

	$masks = @{}

	foreach ($region in $Regions) {
		$baseMask = New-MaskBitmap -MockPath $MockPath -Region $region
		$refinedMask = Erode-MaskBitmap -SourceMask $baseMask -Region $region -Radius $region.maskInset
		$masks[$region.key] = @{
			bitmap = $refinedMask
			x1 = $region.x1
			y1 = $region.y1
			x2 = $region.x2
			y2 = $region.y2
		}
	}

	return $masks
}

function New-MockOverlay {
	param(
		[string]$MockPath,
		[hashtable]$ScreenMasks
	)

	$mock = [System.Drawing.Bitmap]::FromFile($MockPath)
	$overlay = New-TransparentBitmap -Width $mock.Width -Height $mock.Height
	$graphics = [System.Drawing.Graphics]::FromImage($overlay)
	$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
	$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
	$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
	$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
	$graphics.DrawImage($mock, 0, 0, $mock.Width, $mock.Height)
	$graphics.Dispose()

	foreach ($maskInfo in $ScreenMasks.Values) {
		$mask = $maskInfo.bitmap
		for ($x = $maskInfo.x1; $x -le $maskInfo.x2; $x++) {
			for ($y = $maskInfo.y1; $y -le $maskInfo.y2; $y++) {
				if ($mask.GetPixel($x, $y).A -eq 0) {
					continue
				}

				$pixel = $overlay.GetPixel($x, $y)
				$overlay.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $pixel.R, $pixel.G, $pixel.B))
			}
		}
	}

	$mock.Dispose()
	return $overlay
}

function Apply-ScreenMask {
	param(
		[System.Drawing.Bitmap]$Layer,
		[hashtable]$MaskInfo
	)

	$mask = $MaskInfo.bitmap
	for ($x = $MaskInfo.x1; $x -le $MaskInfo.x2; $x++) {
		for ($y = $MaskInfo.y1; $y -le $MaskInfo.y2; $y++) {
			if ($mask.GetPixel($x, $y).A -gt 0) {
				continue
			}

			$pixel = $Layer.GetPixel($x, $y)
			if ($pixel.A -eq 0) {
				continue
			}

			$Layer.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $pixel.R, $pixel.G, $pixel.B))
		}
	}
}

function Draw-SoftFit {
	param(
		[System.Drawing.Graphics]$Graphics,
		[System.Drawing.Bitmap]$Image,
		[System.Drawing.RectangleF]$DestinationRect,
		[System.Drawing.Color]$BackgroundColor,
		[double]$Blend = 0.7,
		[double]$FocusX = 0.5,
		[double]$FocusY = 0.03
	)

	$brush = New-Object System.Drawing.SolidBrush($BackgroundColor)
	$Graphics.FillRectangle($brush, $DestinationRect)
	$brush.Dispose()

	$containScale = [Math]::Min($DestinationRect.Width / $Image.Width, $DestinationRect.Height / $Image.Height)
	$coverScale = [Math]::Max($DestinationRect.Width / $Image.Width, $DestinationRect.Height / $Image.Height)
	$scale = $containScale + (($coverScale - $containScale) * $Blend)
	$drawWidth = $Image.Width * $scale
	$drawHeight = $Image.Height * $scale
	$overflowX = [Math]::Max(0, $drawWidth - $DestinationRect.Width)
	$overflowY = [Math]::Max(0, $drawHeight - $DestinationRect.Height)
	$offsetX = -($overflowX * $FocusX)
	$offsetY = -($overflowY * $FocusY)

	$drawRect = New-Object System.Drawing.RectangleF(
		[single]($DestinationRect.X + $offsetX),
		[single]($DestinationRect.Y + $offsetY),
		[single]$drawWidth,
		[single]$drawHeight
	)

	$graphicsState = $Graphics.Save()
	$Graphics.SetClip($DestinationRect)
	$Graphics.DrawImage($Image, $drawRect)
	$Graphics.Restore($graphicsState)
}

$root = Split-Path -Parent $PSScriptRoot
$mockPath = Join-Path $root 'img/mock-main.png'

$transparentRegions = @(
	@{ key = 'laptop'; x1 = 175; y1 = 345; x2 = 830; y2 = 730; maskInset = 1 }
	@{ key = 'tablet'; x1 = 880; y1 = 350; x2 = 1210; y2 = 845; maskInset = 3 }
	@{ key = 'phone'; x1 = 1245; y1 = 520; x2 = 1405; y2 = 848; maskInset = 4 }
)

$screenMasks = New-ScreenMasks -MockPath $mockPath -Regions $transparentRegions
$overlay = New-MockOverlay -MockPath $mockPath -ScreenMasks $screenMasks

$screenDefinitions = @(
	@{
		key = 'laptop'
		rect = New-Object System.Drawing.RectangleF(191, 361, 630, 360)
		mode = 'cover'
		focusX = 0.5
		focusY = 0.0
	}
	@{
		key = 'tablet'
		rect = New-Object System.Drawing.RectangleF(889, 360, 316, 481)
		mode = 'softfit'
		blend = 0.68
		focusX = 0.5
		focusY = 0.02
	}
	@{
		key = 'phone'
		rect = New-Object System.Drawing.RectangleF(1253, 527, 149, 318)
		mode = 'softfit'
		blend = 0.76
		focusX = 0.5
		focusY = 0.02
	}
)

$projects = @(
	@{ folder = 'dashboard'; images = @('main.jpeg', 'screen-1.jpeg', 'screen-2.jpeg') }
	@{ folder = 'showfm'; images = @('main.jpeg', 'screen-1.jpeg', 'screen-2.jpeg') }
	@{ folder = 'lisieckidev'; images = @('main.png', 'Zrzut ekranu 2026-04-21 o 14.41.22.png', 'Zrzut ekranu 2026-04-21 o 14.41.34.png') }
	@{ folder = 'minimal_port'; images = @('main_minimal.png', 'Zrzut ekranu 2026-04-21 o 16.04.19.png', 'Zrzut ekranu 2026-04-21 o 16.04.31.png') }
	@{ folder = 'resume'; images = @('main.jpeg', 'screen-1.jpeg', 'screen-2.jpeg') }
	@{ folder = 'designin'; images = @('main.png', 'Zrzut ekranu 2026-04-21 o 14.36.22.png', 'Zrzut ekranu 2026-04-21 o 14.38.38.png') }
	@{ folder = 'dgm-company'; images = @('main.jpeg', 'screen-1.jpeg', 'screen-2.jpeg') }
	@{ folder = 'folkshop'; images = @('main.jpeg', 'screen-1.jpeg', 'screen-2.jpeg') }
	@{ folder = 'tropical-paradise'; images = @('main.jpeg', 'screen-1.jpeg', 'screen-2.jpeg') }
)

foreach ($project in $projects) {
	$canvas = New-TransparentBitmap -Width $overlay.Width -Height $overlay.Height
	$graphics = [System.Drawing.Graphics]::FromImage($canvas)
	$graphics.Clear([System.Drawing.Color]::Transparent)
	$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
	$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
	$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
	$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

	for ($index = 0; $index -lt $screenDefinitions.Count; $index++) {
		$screen = $screenDefinitions[$index]
		$imagePath = Join-Path (Join-Path $root ('img/site/' + $project.folder)) $project.images[$index]
		$image = [System.Drawing.Bitmap]::FromFile($imagePath)
		$screenLayer = New-TransparentBitmap -Width $overlay.Width -Height $overlay.Height
		$screenGraphics = [System.Drawing.Graphics]::FromImage($screenLayer)
		$screenGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
		$screenGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
		$screenGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
		$screenGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

		if ($screen.mode -eq 'cover') {
			Draw-Cover -Graphics $screenGraphics -Image $image -DestinationRect $screen.rect -FocusX $screen.focusX -FocusY $screen.focusY
		}
		elseif ($screen.mode -eq 'softfit') {
			$averageColor = Get-AverageColor -Image $image
			Draw-SoftFit -Graphics $screenGraphics -Image $image -DestinationRect $screen.rect -BackgroundColor $averageColor -Blend $screen.blend -FocusX $screen.focusX -FocusY $screen.focusY
		}
		else {
			$averageColor = Get-AverageColor -Image $image
			Draw-Contain -Graphics $screenGraphics -Image $image -DestinationRect $screen.rect -BackgroundColor $averageColor -AlignY $screen.alignY
		}

		$screenGraphics.Dispose()
		Apply-ScreenMask -Layer $screenLayer -MaskInfo $screenMasks[$screen.key]
		$graphics.DrawImage($screenLayer, 0, 0, $screenLayer.Width, $screenLayer.Height)
		$screenLayer.Dispose()
		$image.Dispose()
	}

	$graphics.DrawImage($overlay, 0, 0, $overlay.Width, $overlay.Height)
	$graphics.Dispose()

	$outputPath = Join-Path (Join-Path $root ('img/site/' + $project.folder)) 'portfolio-mock-main.png'
	$canvas.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
	$canvas.Dispose()
	Write-Output $outputPath
}

$overlay.Dispose()

foreach ($maskInfo in $screenMasks.Values) {
	$maskInfo.bitmap.Dispose()
}
