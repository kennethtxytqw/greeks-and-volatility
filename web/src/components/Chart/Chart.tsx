import React, { useEffect, useRef } from 'react'

import { Button, Card } from '@chakra-ui/react'
import {
  ColorType,
  IChartApi,
  UTCTimestamp,
  createChart,
} from 'lightweight-charts'
import _ from 'lodash'
import moment from 'moment'

type PriceIndexDataType = {
  params: {
    channel: string
    data: {
      index_name: string
      price: number
      timestamp: number
    }
  }
}

const numberOfDaysToCalculateVolatilityFor = 30

type SeedData = {
  result: [number, number][] // [timestamp, price]
}

const seedDataId = 'seed'
function isSeedData(data: any): data is SeedData {
  return data?.id === seedDataId
}

function isPriceIndexData(data: any): data is PriceIndexDataType {
  return data?.params?.channel === 'deribit_price_index.btc_usd'
}

function millisecondsToUtcTimestamp(valueInMs: number, toNearestInMs = 1) {
  const ans = ((_.ceil(valueInMs / toNearestInMs) * toNearestInMs) /
    1000) as UTCTimestamp
  return ans
}

type DataPoint = {
  time: UTCTimestamp
  value: number
}

/**
 * Reference: https://github.com/nestedsoftware/iterative_stats/blob/master/IterativeStatsWithWindow.js
 */
class CircularBuffer {
  readonly buffer: number[] = []
  cursor = -1
  readonly _bufferSize: number
  constructor(readonly bufferSize: number) {
    if (bufferSize <= 0 || _.isNaN(bufferSize)) {
      throw new Error('bufferSize must be greater than 0')
    }
    this._bufferSize = bufferSize
  }

  get isMaxedOut() {
    return this.length === this._bufferSize
  }

  incrementCursor() {
    this.cursor = this.nextCursorIndex()
  }

  previousCursorIndex() {
    return (this.cursor - 1 + this._bufferSize) % this._bufferSize
  }

  nextCursorIndex() {
    return (this.cursor + 1) % this._bufferSize
  }

  append(datapoint: DataPoint, replaceTop = false): number | null {
    if (!replaceTop) {
      this.incrementCursor()
    }
    const poppedValue = this.buffer[this.cursor] ?? null
    this.buffer[this.cursor] = datapoint.value

    return poppedValue
  }

  get length() {
    return this.buffer.length
  }

  items() {
    return this.buffer
  }
}

/**
 * Reference: https://github.com/nestedsoftware/iterative_stats/blob/master/IterativeStatsWithWindow.js
 */
class RunningStatsCalculator {
  private circularBuffer: CircularBuffer
  private _mean: number
  private _dSquared: number

  private lastLockedInDataPoint: DataPoint | null = null
  private lastEnteredDataPoint: DataPoint | null = null

  isVolatilityDataReady = false

  constructor(bufferSize) {
    this.circularBuffer = new CircularBuffer(bufferSize)
    this._mean = 0
    this._dSquared = 0
  }

  get count() {
    return this.circularBuffer.length
  }

  transform(dataPoint: DataPoint) {
    if (this.lastLockedInDataPoint == null) {
      return {
        value: 0,
        time: dataPoint.time,
      }
    }
    return {
      value:
        Math.log(dataPoint.value) - Math.log(this.lastLockedInDataPoint.value),
      time: dataPoint.time,
    }
  }

  update(dataPoint: DataPoint) {
    const shouldReplaceTop = this.shouldReplaceTop(dataPoint)
    if (!shouldReplaceTop) {
      this.lastLockedInDataPoint = this.lastEnteredDataPoint
    }
    this.lastEnteredDataPoint = dataPoint

    const transformedDataPoint = this.transform(dataPoint)
    const poppedValue = this.circularBuffer.append(
      transformedDataPoint,
      shouldReplaceTop
    )

    if (!shouldReplaceTop && this.count === this.circularBuffer._bufferSize) {
      this.isVolatilityDataReady = true
    }

    if (this.count == 1 && poppedValue == null) {
      // initialize when the first value is added
      this._mean = transformedDataPoint.value
      this._dSquared = 0
    } else if (poppedValue == null) {
      // if the buffer is not full yet, use standard Welford method
      const meanIncrement =
        (transformedDataPoint.value - this._mean) / this.count
      const newMean = this._mean + meanIncrement

      const dSquaredIncrement =
        (transformedDataPoint.value - newMean) *
        (transformedDataPoint.value - this._mean)
      const newDSquared = this._dSquared + dSquaredIncrement

      this._mean = newMean
      this._dSquared = newDSquared
    } else {
      // once the buffer is full, adjust Welford Method for window size
      const meanIncrement =
        (transformedDataPoint.value - poppedValue) / this.count
      const newMean = this._mean + meanIncrement

      const dSquaredIncrement =
        (transformedDataPoint.value - poppedValue) *
        (transformedDataPoint.value - newMean + poppedValue - this._mean)
      const newDSquared = this._dSquared + dSquaredIncrement

      this._mean = newMean
      this._dSquared = newDSquared
    }
  }

  shouldReplaceTop(newValue: DataPoint): boolean {
    if (this.lastEnteredDataPoint == null) {
      return false
    }
    return newValue.time === this.lastEnteredDataPoint.time
  }

  get mean() {
    return this._mean
  }

  get dSquared() {
    return this._dSquared
  }

  get populationVariance() {
    return this.dSquared / this.count
  }

  get populationStdev() {
    return Math.sqrt(this.populationVariance)
  }

  get sampleVariance() {
    return this.count > 1 ? this.dSquared / (this.count - 1) : 0
  }

  get sampleStdev() {
    return Math.sqrt(this.sampleVariance)
  }

  volatility(intervalInMs: number) {
    if (!this.isVolatilityDataReady) {
      return null
    }
    return (
      this.populationStdev *
      Math.sqrt((365 * 24 * 60 * 60 * 1000) / intervalInMs)
    )
  }

  summary() {
    return {
      mean: this.mean,
      dSquared: this.dSquared,
      populationVariance: this.populationVariance,
      sampleVariance: this.sampleVariance,
      populationStdev: this.populationStdev,
      sampleStdev: this.sampleStdev,
    }
  }
}
const Chart = (props) => {
  const {
    colors: {
      backgroundColor = 'white',
      priceLineColor = '#2962FF',
      volatilityLineColor = '#FF6D00',
      textColor = 'black',
    } = {},
  } = props

  const chartContainerRef = useRef()
  let chart: IChartApi
  useEffect(() => {
    const handleResize = () => {
      chart.applyOptions({
        width: chartContainerRef?.current.clientWidth,
      })
    }

    chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor,
      },
      width: chartContainerRef?.current?.clientWidth,
      height: 300,
    })
    chart.applyOptions({
      rightPriceScale: {
        visible: true,
      },
      leftPriceScale: {
        visible: true,
      },
    })
    const timeScale = chart.timeScale()
    timeScale.applyOptions({
      timeVisible: true,
    })
    timeScale.fitContent()

    const leftSeries = chart.addLineSeries({
      color: priceLineColor,
      priceScaleId: 'left',
    })

    const rightSeries = chart.addLineSeries({
      color: volatilityLineColor,
      priceScaleId: 'right',
    })

    window.addEventListener('resize', handleResize)
    const msg = {
      jsonrpc: '2.0',
      id: 1,
      method: 'public/subscribe',
      params: {
        channels: ['deribit_price_index.btc_usd'],
      },
    }
    let intervalInMs = 1000
    let runningStatsCalculator: RunningStatsCalculator
    const addDataPoint = (dataPoint: DataPoint) => {
      runningStatsCalculator.update(dataPoint)
      const vol = runningStatsCalculator.volatility(intervalInMs)
      if (vol !== null) {
        const volDataPoint = {
          time: dataPoint.time,
          value: runningStatsCalculator.volatility(intervalInMs),
        }
        rightSeries.update(volDataPoint)
      }
      leftSeries.update(dataPoint)
    }
    const msgToGetSeedData = {
      jsonrpc: '2.0',
      id: seedDataId,
      method: 'public/get_index_chart_data',
      params: {
        index_name: 'btc_usd',
        range: '1y',
      },
    }
    const ws = new WebSocket('wss://www.deribit.com/ws/api/v2')
    ws.onopen = function () {
      ws.send(JSON.stringify(msgToGetSeedData))
    }

    ws.onmessage = function (e) {
      // do something with the response...
      const data = JSON.parse(e.data)
      if (isSeedData(data)) {
        intervalInMs = data.result[1][0] - data.result[0][0]
        runningStatsCalculator = new RunningStatsCalculator(
          moment
            .duration(numberOfDaysToCalculateVolatilityFor, 'days')
            .asMilliseconds() / intervalInMs
        )
        const indexPriceSeedData = data.result
          .slice(0, data.result.length - 1)
          .map((item) => ({
            time: millisecondsToUtcTimestamp(item[0]),
            value: item[1],
          }))

        indexPriceSeedData.forEach((item) => {
          addDataPoint(item)
        })
        ws.send(JSON.stringify(msg))
      } else if (isPriceIndexData(data)) {
        addDataPoint({
          time: millisecondsToUtcTimestamp(
            data.params.data.timestamp,
            intervalInMs
          ),
          value: data.params.data.price,
        })
      }
    }
    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  return (
    <Card>
      <div ref={chartContainerRef} />
      <Button
        variant="contained"
        onClick={() => {
          chart.timeScale().resetTimeScale()
        }}
      >
        Reset Timescale
      </Button>
      <Button
        variant="contained"
        onClick={() => {
          chart.timeScale().scrollToRealTime()
        }}
      >
        Scroll to Real Time
      </Button>
    </Card>
  )
}

export default Chart
