import { mergeConfigs } from 'unocss'

import { sharedUnoConfig } from '../../uno.config'

export default mergeConfigs([
  sharedUnoConfig(),
  {
    shortcuts: [
      ['text-primary', 'text-neutral-400 hover:text-neutral-500 dark:text-neutral-500 hover:dark:text-neutral-400'],
    ],
    rules: [
      ['transition-colors-none', {
        'transition-property': 'color, background-color, border-color, text-color',
        'transition-duration': '0s',
      }],
    ],
  },
])
