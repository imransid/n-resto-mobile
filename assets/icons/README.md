# App Icons

## Color palette

- **Background:** `#FFFFFF` (white — matches Gmail/Chrome style, high contrast)
- **N mark:** `#0D9488` (teal, app primary)

## Android (API 26+)

Uses **adaptive icons** so the launcher shows a **navy background** (`#0f172a`) instead of a white circle, with a **large vector “N”** in the foreground:

- `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`
- `android/app/src/main/res/drawable/ic_launcher_foreground.xml` — edit paths here to tweak the mark
- `android/app/src/main/res/values/colors.xml` — `ic_launcher_background`

Pre–API 26 uses `ic_launcher.png` / `ic_launcher_round.png` in each `mipmap-*` folder.

## Master raster (iOS + legacy Android)

`icon-1024.png` — regenerate mipmaps / iOS with the commands below.

```bash
ICON="assets/icons/icon-1024.png"

# Android legacy mipmaps only
for size in 48 72 96 144 192; do
  case $size in 48) d=mipmap-mdpi;; 72) d=mipmap-hdpi;; 96) d=mipmap-xhdpi;; 144) d=mipmap-xxhdpi;; 192) d=mipmap-xxxhdpi;; esac
  sips -z $size $size "$ICON" --out "android/app/src/main/res/$d/ic_launcher.png"
  sips -z $size $size "$ICON" --out "android/app/src/main/res/$d/ic_launcher_round.png"
done

# iOS (unchanged)
IOS="ios/NRestoMobile/Images.xcassets/AppIcon.appiconset"
sips -z 40 40 "$ICON" --out "$IOS/Icon-20@2x.png"
sips -z 60 60 "$ICON" --out "$IOS/Icon-20@3x.png"
sips -z 58 58 "$ICON" --out "$IOS/Icon-29@2x.png"
sips -z 87 87 "$ICON" --out "$IOS/Icon-29@3x.png"
sips -z 80 80 "$ICON" --out "$IOS/Icon-40@2x.png"
sips -z 120 120 "$ICON" --out "$IOS/Icon-40@3x.png"
sips -z 120 120 "$ICON" --out "$IOS/Icon-60@2x.png"
sips -z 180 180 "$ICON" --out "$IOS/Icon-60@3x.png"
cp "$ICON" "$IOS/Icon-1024.png"
```
