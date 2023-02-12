import { render } from '@redwoodjs/testing/web'

import VolatilityIndexPage from './VolatilityIndexPage'

//   Improve this test with help from the Redwood Testing Doc:
//   https://redwoodjs.com/docs/testing#testing-pages-layouts

describe('VolatilityIndexPage', () => {
  it('renders successfully', () => {
    expect(() => {
      render(<VolatilityIndexPage />)
    }).not.toThrow()
  })
})
