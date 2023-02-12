import type { ComponentMeta } from '@storybook/react'

import VolatilityIndexPage from './VolatilityIndexPage'

export const generated = () => {
  return <VolatilityIndexPage />
}

export default {
  title: 'Pages/VolatilityIndexPage',
  component: VolatilityIndexPage,
} as ComponentMeta<typeof VolatilityIndexPage>
