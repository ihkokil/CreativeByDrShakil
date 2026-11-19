import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SOURCE_LOGO = path.join(ROOT, 'public', 'web-app-manifest-512x512.png');
const RES_DIR = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const STORE_DIR = path.join(ROOT, 'store-assets', 'android');

const BG_COLOR = '#0a0a0c';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * First, extract the crimson heart logo onto a transparent background
 * by keying out the white background pixels in web-app-manifest-512x512.png.
 */
async function getTransparentLogoBuffer() {
  const { data, info } = await sharp(SOURCE_LOGO)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Buffer.from(data);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    // White / near-white background pixels become transparent; smooth anti-aliased edges
    const minChannel = Math.min(r, g, b);
    if (r > 240 && g > 240 && b > 240) {
      pixels[i + 3] = 0;
    } else if (minChannel > 180 && r > g) {
      // Soft edge blending based on non-red brightness
      const alpha = Math.max(0, Math.min(255, Math.round(((255 - g) / (255 - 30)) * 255)));
      pixels[i + 3] = alpha;
    }
  }

  return sharp(pixels, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

async function generateAssets() {
  console.log('Extracting transparent brand logo...');
  const transparentLogo = await getTransparentLogoBuffer();

  // 1. Adaptive Icon Foregrounds (108dp canvas; logo centered inside 62% safe zone)
  const adaptiveBuckets = [
    { folder: 'mipmap-mdpi', size: 108 },
    { folder: 'mipmap-hdpi', size: 162 },
    { folder: 'mipmap-xhdpi', size: 216 },
    { folder: 'mipmap-xxhdpi', size: 324 },
    { folder: 'mipmap-xxxhdpi', size: 432 },
  ];

  for (const { folder, size } of adaptiveBuckets) {
    const outDir = path.join(RES_DIR, folder);
    ensureDir(outDir);
    const logoSize = Math.round(size * 0.56);
    const resizedLogo = await sharp(transparentLogo)
      .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: resizedLogo, gravity: 'center' }])
      .png()
      .toFile(path.join(outDir, 'ic_launcher_foreground.png'));
  }

  // 2. Legacy Square & Round Launcher Icons (48dp canvas)
  const launcherBuckets = [
    { folder: 'mipmap-mdpi', size: 48 },
    { folder: 'mipmap-hdpi', size: 72 },
    { folder: 'mipmap-xhdpi', size: 96 },
    { folder: 'mipmap-xxhdpi', size: 144 },
    { folder: 'mipmap-xxxhdpi', size: 192 },
  ];

  for (const { folder, size } of launcherBuckets) {
    const outDir = path.join(RES_DIR, folder);
    ensureDir(outDir);
    const logoSize = Math.round(size * 0.68);
    const resizedLogo = await sharp(transparentLogo)
      .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    const radius = Math.round(size * 0.22);
    const squareBgSvg = Buffer.from(`
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="g" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stop-color="#221015"/>
            <stop offset="100%" stop-color="${BG_COLOR}"/>
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="url(#g)" />
        <rect x="0.5" y="0.5" width="${size - 1}" height="${size - 1}" rx="${radius}" ry="${radius}" fill="none" stroke="#ED1C28" stroke-opacity="0.28" stroke-width="1"/>
      </svg>
    `);

    await sharp(squareBgSvg)
      .composite([{ input: resizedLogo, gravity: 'center' }])
      .png()
      .toFile(path.join(outDir, 'ic_launcher.png'));

    const roundBgSvg = Buffer.from(`
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="rg" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stop-color="#221015"/>
            <stop offset="100%" stop-color="${BG_COLOR}"/>
          </radialGradient>
        </defs>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="url(#rg)" />
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 0.5}" fill="none" stroke="#ED1C28" stroke-opacity="0.28" stroke-width="1"/>
      </svg>
    `);

    await sharp(roundBgSvg)
      .composite([{ input: resizedLogo, gravity: 'center' }])
      .png()
      .toFile(path.join(outDir, 'ic_launcher_round.png'));
  }

  // 3. Android 12+ Splash Screen Icon (288dp canvas, inner 160dp logo) & Legacy Splash Logo
  const splashBuckets = [
    { folder: 'drawable-mdpi', size: 288 },
    { folder: 'drawable-hdpi', size: 432 },
    { folder: 'drawable-xhdpi', size: 576 },
    { folder: 'drawable-xxhdpi', size: 864 },
    { folder: 'drawable-xxxhdpi', size: 1152 },
  ];

  for (const { folder, size } of splashBuckets) {
    const outDir = path.join(RES_DIR, folder);
    ensureDir(outDir);
    const logoSize = Math.round(size * 0.52);
    const resizedLogo = await sharp(transparentLogo)
      .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: resizedLogo, gravity: 'center' }])
      .png()
      .toFile(path.join(outDir, 'splash_icon.png'));
  }

  // Also put default splash_icon.png in drawable/
  const defaultDrawableDir = path.join(RES_DIR, 'drawable');
  ensureDir(defaultDrawableDir);
  fs.copyFileSync(
    path.join(RES_DIR, 'drawable-xhdpi', 'splash_icon.png'),
    path.join(defaultDrawableDir, 'splash_icon.png')
  );

  // 4. Google Play Store Hi-Res Icon (512x512, 32-bit PNG, full-bleed no alpha corners as required by Google Play)
  ensureDir(STORE_DIR);
  const playIconLogo = await sharp(transparentLogo)
    .resize(360, 360, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const playIconBgSvg = Buffer.from(`
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="pg" cx="50%" cy="42%" r="70%">
          <stop offset="0%" stop-color="#281016"/>
          <stop offset="55%" stop-color="#110d12"/>
          <stop offset="100%" stop-color="#0a0a0c"/>
        </radialGradient>
      </defs>
      <rect width="512" height="512" fill="url(#pg)"/>
      <circle cx="256" cy="256" r="220" fill="none" stroke="#ED1C28" stroke-opacity="0.14" stroke-width="2"/>
    </svg>
  `);

  await sharp(playIconBgSvg)
    .composite([{ input: playIconLogo, gravity: 'center' }])
    .png()
    .toFile(path.join(STORE_DIR, 'play-store-icon-512x512.png'));

  // 5. Google Play Store Feature Graphic (1024x500 PNG)
  const featureLogo = await sharp(transparentLogo)
    .resize(210, 210, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const featureBgSvg = Buffer.from(`
    <svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0a0a0c"/>
          <stop offset="50%" stop-color="#150d12"/>
          <stop offset="100%" stop-color="#0a0a0c"/>
        </linearGradient>
        <radialGradient id="glowLeft" cx="22%" cy="50%" r="45%">
          <stop offset="0%" stop-color="#ED1C28" stop-opacity="0.24"/>
          <stop offset="100%" stop-color="#ED1C28" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="glowRight" cx="85%" cy="20%" r="40%">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1024" height="500" fill="url(#bgGrad)"/>
      <rect width="1024" height="500" fill="url(#glowLeft)"/>
      <rect width="1024" height="500" fill="url(#glowRight)"/>

      <!-- Subtle ECG Grid Lines -->
      <g stroke="#ffffff" stroke-opacity="0.03" stroke-width="1">
        <line x1="0" y1="100" x2="1024" y2="100"/>
        <line x1="0" y1="200" x2="1024" y2="200"/>
        <line x1="0" y1="300" x2="1024" y2="300"/>
        <line x1="0" y1="400" x2="1024" y2="400"/>
        <line x1="200" y1="0" x2="200" y2="500"/>
        <line x1="400" y1="0" x2="400" y2="500"/>
        <line x1="600" y1="0" x2="600" y2="500"/>
        <line x1="800" y1="0" x2="800" y2="500"/>
      </g>

      <!-- Logo Glass Container -->
      <rect x="88" y="115" width="270" height="270" rx="56" fill="#14141a" fill-opacity="0.85" stroke="#ED1C28" stroke-opacity="0.35" stroke-width="2"/>

      <!-- Typography -->
      <rect x="405" y="132" width="215" height="32" rx="16" fill="#ED1C28" fill-opacity="0.16" stroke="#ED1C28" stroke-opacity="0.4" stroke-width="1"/>
      <text x="512" y="153" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="700" fill="#ff4d58" text-anchor="middle" letter-spacing="1.5">MEDICAL EDUCATION</text>

      <text x="405" y="222" font-family="Segoe UI, Arial, sans-serif" font-size="48" font-weight="800" fill="#ffffff">Creative By</text>
      <text x="405" y="280" font-family="Segoe UI, Arial, sans-serif" font-size="48" font-weight="800" fill="#ED1C28">Dr. Shakil</text>

      <text x="405" y="328" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="500" fill="#a1a1aa">Medical Education Simplified for Doctors</text>

      <!-- Feature Pills -->
      <rect x="405" y="356" width="160" height="36" rx="10" fill="#1c1c24" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1"/>
      <text x="485" y="379" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="600" fill="#e4e4e7" text-anchor="middle">HD Video Lectures</text>

      <rect x="579" y="356" width="165" height="36" rx="10" fill="#1c1c24" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1"/>
      <text x="661" y="379" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="600" fill="#e4e4e7" text-anchor="middle">SBA &amp; T/F Quizzes</text>

      <rect x="758" y="356" width="175" height="36" rx="10" fill="#1c1c24" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1"/>
      <text x="845" y="379" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="600" fill="#e4e4e7" text-anchor="middle">Study Notes &amp; PDFs</text>
    </svg>
  `);

  await sharp(featureBgSvg)
    .composite([{ input: featureLogo, left: 118, top: 145 }])
    .png()
    .toFile(path.join(STORE_DIR, 'feature-graphic-1024x500.png'));

  console.log('Successfully generated all Android adaptive icons, splash screens, and Play Store graphics!');
}

generateAssets().catch((err) => {
  console.error(err);
  process.exit(1);
});
