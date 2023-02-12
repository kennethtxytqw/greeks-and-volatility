import { Box } from '@chakra-ui/react'

import { MetaTags } from '@redwoodjs/web'

import Chart from 'src/components/Chart/Chart'
const VolatilityIndexPage = () => {
  return (
    <>
      <MetaTags title="VolatilityIndex" description="VolatilityIndex page" />
      <p>
        This is a real time chart. It will update as new data comes in. It will
        also update the volatility index as new data comes in.
      </p>
      <p>
        Historical index price data on deribit are in 6 hours intervals, the
        chart will only move the timescale every 6 hours.
      </p>
      <p>
        If you zoom into the latest price data, the chart is actually updating
        its latest price in real time via websocket.
      </p>
      <p>Orange is volatility index, blue is price index.</p>
      <Box w="100%" h="500px">
        <Chart />
      </Box>
    </>
  )
}

export default VolatilityIndexPage
