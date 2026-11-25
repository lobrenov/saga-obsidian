import { expect, it } from 'vitest'
import { toExcerpt } from '../../src/shared/markdown/excerpt'

it('takes the first block after headings, without list or task markers', () => {
  const text = '---\ntype: location\n---\n# The Shattered Plains\n\nPlateaus split by [[Chasm|chasms]].\nGoods move unseen.\n\n- [!] Flash floods\n- Chasmfiends\n'
  expect(toExcerpt(text, 200)).toBe('Plateaus split by chasms. Goods move unseen.')
  expect(toExcerpt('# Hooks\n\n- [ ] Pay the toll\n1. Find the chart\n', 200)).toBe('Pay the toll Find the chart')
})
