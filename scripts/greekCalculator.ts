import NormalDistribution from 'normal-distribution'

const normal = new NormalDistribution()
interface Option {
  underlyingAssetPrice: number
  strikePrice: number
  riskFreeRate: number
  volatility: number
  timeToExpiration: number
  optionType: 'call' | 'put'
}

function calculateGamma({
  d1,
  underlyingAssetPrice,
  volatility,
  timeToExpiration,
}: {
  d1: number
  underlyingAssetPrice: number
  volatility: number
  timeToExpiration: number
}) {
  return (
    normal.pdf(d1) /
    (underlyingAssetPrice * volatility * Math.sqrt(timeToExpiration))
  )
}

function calculateDelta({
  d1,
  optionType,
}: {
  d1: number
  optionType: 'call' | 'put'
}) {
  if (optionType === 'call') {
    return normal.cdf(d1)
  } else if (optionType === 'put') {
    return -normal.cdf(-d1)
  }
}

function calculateTheta({
  d1,
  d2,
  underlyingAssetPrice,
  strikePrice,
  riskFreeRate,
  volatility,
  timeToExpiration,
  optionType,
}: {
  d1: number
  d2: number
  underlyingAssetPrice: number
  strikePrice: number
  riskFreeRate: number
  volatility: number
  timeToExpiration: number
  optionType: 'call' | 'put'
}) {
  if (optionType === 'call') {
    return (
      -(underlyingAssetPrice * volatility * normal.pdf(d1)) /
        (2 * Math.sqrt(timeToExpiration)) -
      riskFreeRate *
        strikePrice *
        Math.exp(-riskFreeRate * timeToExpiration) *
        normal.cdf(d2)
    )
  } else if (optionType === 'put') {
    return (
      -(underlyingAssetPrice * volatility * normal.pdf(d1)) /
        (2 * Math.sqrt(timeToExpiration)) +
      riskFreeRate *
        strikePrice *
        Math.exp(-riskFreeRate * timeToExpiration) *
        normal.cdf(-d2)
    )
  }
}

function calculateVega({
  d1,
  underlyingAssetPrice,
  timeToExpiration,
}: {
  d1: number
  underlyingAssetPrice: number
  timeToExpiration: number
}) {
  return underlyingAssetPrice * Math.sqrt(timeToExpiration) * normal.pdf(d1)
}

function calculatePortfolioGreeks(options: Option[]): {
  delta: number
  gamma: number
  theta: number
  vega: number
} {
  let delta = 0
  let gamma = 0
  let theta = 0
  let vega = 0

  for (const option of options) {
    const d1 =
      (Math.log(option.underlyingAssetPrice / option.strikePrice) +
        (option.riskFreeRate + 0.5 * option.volatility ** 2) *
          option.timeToExpiration) /
      (option.volatility * Math.sqrt(option.timeToExpiration))
    const d2 = d1 - option.volatility * Math.sqrt(option.timeToExpiration)
    delta += calculateDelta({
      d1,
      optionType: option.optionType,
    })

    gamma += calculateGamma({
      d1,
      underlyingAssetPrice: option.underlyingAssetPrice,
      volatility: option.volatility,
      timeToExpiration: option.timeToExpiration,
    })
    theta += calculateTheta({
      d1,
      d2,
      underlyingAssetPrice: option.underlyingAssetPrice,
      strikePrice: option.strikePrice,
      riskFreeRate: option.riskFreeRate,
      volatility: option.volatility,
      timeToExpiration: option.timeToExpiration,
      optionType: option.optionType,
    })
    vega += calculateVega({
      d1,
      underlyingAssetPrice: option.underlyingAssetPrice,
      timeToExpiration: option.timeToExpiration,
    })
  }

  return { delta, gamma, theta, vega }
}

export default async ({ args }) => {
  // Your script here...
  console.log(':: Executing script with args ::')
  console.log(args)

  const options: Option[] = [
    {
      underlyingAssetPrice: 100,
      strikePrice: 100,
      riskFreeRate: 0.05,
      volatility: 0.2,
      timeToExpiration: 0.5,
      optionType: 'call',
    },
    {
      underlyingAssetPrice: 100,
      strikePrice: 100,
      riskFreeRate: 0.05,
      volatility: 0.2,
      timeToExpiration: 0.5,
      optionType: 'put',
    },
  ]

  const greeks = calculatePortfolioGreeks(options)
  console.log(greeks)
}
