/**
 * Writes one app icon for each logo color in `build/logo-colors/`, from the release icons.
 *
 * macOS has no alternate app icon API (`setAlternateIconName` is UIKit only), so the app sets the
 * Dock icon from one of these files while it runs. The files are committed: a designer can replace
 * one by hand, and this script is only the first draft of each color.
 *
 * Each pixel is placed on the line from the eye color to the lavender body color, and the new pixel
 * takes the same place on the line from the new eye color to the new body color. The eyes and the
 * antialiased edges keep their shape, and only the body and eye colors change.
 *
 * Run with `bun scripts/generate-logo-color-icons.ts`.
 */
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  APP_LOGO_COLOR_HEX,
  APP_LOGO_COLORS,
  APP_LOGO_EYE_HEX,
  DEFAULT_APP_LOGO_COLOR,
  DEFAULT_APP_LOGO_EYE_HEX,
} from "@openbot/contracts/app-logo-color";
import { createOpenBotLogger } from "@openbot/logging";
import sharp from "sharp";

type Rgb = readonly [number, number, number];

const SOURCES = ["icon-production.png", "icon-production-macos-safe-area.png"] as const;
const BUILD = resolve(import.meta.dirname, "../build");
const OUTPUT = join(BUILD, "logo-colors");
const logger = createOpenBotLogger("generate-logo-color-icons");
/** The logo eyes in `build/icon-production*.png`, `--openbot-logo-eye`. */
const ICON_EYE = hexToRgb(DEFAULT_APP_LOGO_EYE_HEX);

function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function recolor(pixels: Buffer, source: Rgb, target: Rgb, targetEye: Rgb): Buffer {
  const result = Buffer.from(pixels);
  const axis = [0, 1, 2].map((channel) => (source[channel] ?? 0) - (ICON_EYE[channel] ?? 0));
  const axisLength = axis.reduce((sum, value) => sum + value ** 2, 0);
  for (let offset = 0; offset + 3 < result.length; offset += 4) {
    if (result[offset + 3] === 0) continue;
    let along = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      along += ((result[offset + channel] ?? 0) - (ICON_EYE[channel] ?? 0)) * (axis[channel] ?? 0);
    }
    const position = Math.min(1, Math.max(0, along / axisLength));
    for (let channel = 0; channel < 3; channel += 1) {
      const eye = targetEye[channel] ?? 0;
      result[offset + channel] = Math.round(eye + position * ((target[channel] ?? 0) - eye));
    }
  }
  return result;
}

await mkdir(OUTPUT, { recursive: true });
const source = hexToRgb(APP_LOGO_COLOR_HEX[DEFAULT_APP_LOGO_COLOR]);
for (const file of SOURCES) {
  const { data, info } = await sharp(join(BUILD, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const color of APP_LOGO_COLORS) {
    if (color === DEFAULT_APP_LOGO_COLOR) continue;
    const name = file.replace("production", color);
    await sharp(recolor(data, source, hexToRgb(APP_LOGO_COLOR_HEX[color]), hexToRgb(APP_LOGO_EYE_HEX[color])), {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png({ compressionLevel: 9 })
      .toFile(join(OUTPUT, name));
    logger.info(`Wrote build/logo-colors/${name}`);
  }
}
