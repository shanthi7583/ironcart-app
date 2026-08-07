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

// Tailwind writes gradients as `--tw-gradient-position: to right in oklab` and then
// `background-image: linear-gradient(var(--tw-gradient-stops))`. The `in <colorspace>`
// interpolation hint is Chrome 111+, so anything older fails to parse the whole
// declaration and the element ends up with no background at all — the flash-offer
// banner became white text on nothing. Lightning CSS can't rescue this because the
// colour space is behind a var(), invisible to static analysis.
//
// Dropping the hint leaves the gradient interpolating in sRGB. For the two- and
// three-stop brand gradients here that's visually indistinguishable, and it parses
// everywhere. Scoped to the gradient custom property so it can't touch the
// color-mix(in oklab, …) declarations, which already have proper rgba() fallbacks.
export function stripGradientColorSpace(css: string): string {
  return css.replace(
    /(--tw-gradient-position:\s*[^;}]*?)\s+in\s+(oklab|oklch|srgb|srgb-linear|lab|lch|hsl|hwb)\b/gi,
    '$1'
  )
}

// Tailwind v4 positions things with the standalone `rotate`, `scale` and `translate`
// properties rather than composing one `transform`. Those are Chrome 104+, so on
// anything older every transform utility is silently ignored — including
// `-translate-x-1/2`, which is load-bearing for centring, so this misplaces elements
// rather than merely dropping polish.
//
// `rotate` is emitted as a literal (`rotate:45deg`) with no custom property to read
// back, so mirror it into one first. Then a single @supports block rebuilds the whole
// thing as a classic `transform`. The guard means browsers that understand the modern
// properties never see it, so they can't apply the movement twice.
export function addTransformFallback(css: string): string {
  const mirrored = css.replace(
    /(^|[;{])rotate:\s*([^;}]+)/g,
    (_m, lead, value) => `${lead}--tw-rotate:${value};rotate:${value}`
  )
  return (
    mirrored +
    '@supports not (translate:0px){' +
    '[class*="translate-"],[class*="rotate-"],[class*="scale-"]{' +
    'transform:translate(var(--tw-translate-x,0),var(--tw-translate-y,0)) ' +
    'rotate(var(--tw-rotate,0deg)) ' +
    'scaleX(var(--tw-scale-x,1)) scaleY(var(--tw-scale-y,1))}}'
  )
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
          code: Buffer.from(addTransformFallback(stripGradientColorSpace(flattenCascadeLayers(original)))),
          minify: true,
          targets: LEGACY_TARGETS
        })
        asset.source = code.toString()
      }
    }
  }
}
