import { transform, type Targets } from 'lightningcss'
import type { Plugin } from 'vite'

// Tailwind v4 emits CSS that only parses on Chrome 111+ / Safari 16.4+: cascade
// layers, oklch() colours and color-mix(). Anything older skips the whole
// `@layer { … }` block as an unknown at-rule, which drops *every* utility class —
// the app renders as unstyled HTML rather than degrading gracefully.
//
// That is not hypothetical: a Pixel XL on Android 10 ships Android System WebView
// 92 (2021) unless the user has updated it, and WebView is what Capacitor renders
// into. The whole app was unstyled there.
//
// Fix in two steps:
//   1. Unwrap the @layer blocks, keeping source order. Tailwind already emits
//      theme → base → components → utilities in cascade order, so flattening
//      preserves the intended precedence for our usage.
//   2. Run Lightning CSS at an old target so it lowers oklch() to rgb() and emits
//      plain rgba() fallbacks ahead of each color-mix() @supports override.

const LEGACY_TARGETS: Targets = {
  chrome: 87 << 16,
  android: 87 << 16,
  safari: (14 << 16) | (0 << 8),
  firefox: 78 << 16,
  edge: 87 << 16
}

// Layers can nest, so recurse rather than trying to match with one regex.
export function flattenCascadeLayers(css: string): string {
  css = css.replace(/@layer[^;{]*;/g, '') // the `@layer theme, base, …;` ordering statement
  let out = ''
  let i = 0
  while (i < css.length) {
    const opener = /@layer\s*[^{]*\{/g
    opener.lastIndex = i
    const hit = opener.exec(css)
    if (!hit) {
      out += css.slice(i)
      break
    }
    out += css.slice(i, hit.index)
    let depth = 1
    let j = opener.lastIndex
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++
      else if (css[j] === '}') depth--
      j++
    }
    out += flattenCascadeLayers(css.slice(opener.lastIndex, j - 1))
    i = j
  }
  return out
}

export function legacyCss(): Plugin {
  return {
    name: 'pressgo-legacy-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type !== 'asset' || !fileName.endsWith('.css')) continue
        const original =
          typeof asset.source === 'string' ? asset.source : Buffer.from(asset.source).toString('utf8')
        const { code } = transform({
          filename: fileName,
          code: Buffer.from(flattenCascadeLayers(original)),
          minify: true,
          targets: LEGACY_TARGETS
        })
        asset.source = code.toString()
      }
    }
  }
}
