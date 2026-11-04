import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const stylesheet = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8')

describe('DESIGN-01 palette', () => {
  it('defines the approved corporate colors and semantic accessibility tokens', () => {
    expect(stylesheet).toContain('--corporate-plum: #583F44')
    expect(stylesheet).toContain('--corporate-rosy-cream: #D9CBC6')
    expect(stylesheet).toContain('--corporate-charcoal: #221C27')
    expect(stylesheet).toContain('--corporate-mauve-gray: #AB9E9E')
    expect(stylesheet).toContain('--corporate-dusty-mauve: #A17F76')
    expect(stylesheet).toContain('--corporate-terracotta: #A45E43')

    for (const token of ['background', 'foreground', 'surface', 'primary', 'secondary', 'accent', 'muted', 'border', 'focus', 'destructive', 'success', 'warning']) {
      expect(stylesheet).toContain(`--${token}:`)
    }

    expect(stylesheet).toContain('--focus-on-dark:')
    expect(stylesheet).toContain('Terracotta is an accent only and is not used for destructive states.')
  })
})
