# PayFast Logo - Compression Needed

## Current Situation
Your active logo (`assets/icon.png` and `web/public/icon-512.png`) is **1.1MB** - too large for PayFast (max 50KB).

## ✅ Quick Solution: Compress Your Existing Logo

### Option 1: Online Compression (Easiest)
1. Go to https://tinypng.com
2. Upload `assets/icon.png` OR `web/public/icon-512.png`
3. Download the compressed version
4. Rename it to `payfast-logo.png`
5. Upload to PayFast (should be under 50KB after compression)

### Option 2: Use ImageMagick (Command Line)
```bash
# Install ImageMagick if not installed
sudo apt-get install imagemagick

# Compress the logo
convert assets/icon.png -resize 512x512 -quality 85 payfast-logo.png

# Check size
ls -lh payfast-logo.png
```

### Option 3: Use GIMP (GUI)
1. Open `assets/icon.png` in GIMP
2. Image → Scale Image → Set to 512x512px
3. File → Export As → PNG
4. In export dialog, set compression to 9
5. Save as `payfast-logo.png`

## Small Icons Available (Already Under 50KB)
These are TOO SMALL for PayFast display, but they work:
- `assets/favicon-64x64.png` (8KB) - 64x64px ⚠️ Too small
- `assets/notification-icon.png` (4KB) - Very small ⚠️ Too small

## Recommended Size for PayFast
- Minimum: 200x200px
- Recommended: 512x512px
- File size: Under 50KB
- Format: PNG or JPG

## After Compression
1. Upload to PayFast: https://my.payfast.io/settings/display-settings
2. Click "+ Add File"
3. Select your compressed `payfast-logo.png`
4. Save

The compressed version should maintain quality while being under 50KB.
