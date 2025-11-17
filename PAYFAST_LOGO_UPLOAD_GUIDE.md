# PayFast Logo Upload Guide

## ✅ READY TO USE - Logos Under 50KB

You already have perfect logos in your project! Here are your best options:

### Recommended Logos (in order of preference):

1. **`assets/branding/png/icon-1024.png`** - 48KB ✅ BEST CHOICE
   - High quality
   - Perfect size for PayFast
   - Square format (ideal for payment pages)

2. **`assets/branding/png/icon-512.png`** - 41KB ✅ GOOD
   - Medium quality
   - Still looks great
   - Faster loading

3. **`assets/branding/png/icon-192.png`** - 17KB ✅ SMALLEST
   - Smaller file
   - Very fast loading
   - Good for mobile

4. **`assets/branding/png/logo-monochrome-1024w.png`** - 2.7KB ✅ TINIEST
   - Monochrome version
   - Ultra-fast loading
   - Clean professional look

## 📤 How to Upload to PayFast

### Step 1: Choose Your Logo
I recommend using **`icon-1024.png`** (48KB) for the best quality.

### Step 2: Upload to PayFast
1. Go to https://my.payfast.io/settings/display-settings
2. Scroll to "Logo" section
3. Click "+ Add File"
4. Navigate to your project folder:
   ```
   /home/king/Desktop/edudashpro/assets/branding/png/
   ```
5. Select **icon-1024.png**
6. Click "Save"

### Step 3: Verify
After uploading, test your integration to see how the logo appears on the PayFast payment page.

## 🎨 Logo Locations in Your Project

```
edudashpro/
├── assets/
│   └── branding/
│       ├── png/
│       │   ├── icon-1024.png        ← 48KB ✅ USE THIS
│       │   ├── icon-512.png         ← 41KB ✅ OR THIS
│       │   ├── icon-192.png         ← 17KB ✅ OR THIS
│       │   └── logo-monochrome-1024w.png  ← 2.7KB ✅ MONOCHROME VERSION
│       └── svg/
│           └── logo-icon-only.svg   ← Vector (can be converted)
```

## 🔄 Alternative: Convert SVG to PNG

If you want a custom size:

1. Open `assets/branding/svg/logo-icon-only.svg` in a browser
2. Right-click → "Inspect Element"
3. In console, run:
   ```javascript
   // Take screenshot or use this to download as PNG
   document.querySelector('svg').toDataURL('image/png')
   ```
4. Or use online tool: https://cloudconvert.com/svg-to-png
5. Set output size to 200x200px
6. Download and upload to PayFast

## ✅ No Need to Create New Logo!

You already have professional branding assets. Just upload one of the existing PNGs from the branding folder.

**Recommended:** Use `assets/branding/png/icon-1024.png` (48KB)
