import axios from "axios";

export interface RapidApiHeader {
  key: string;
  host: string;
}

export interface HistoryPrice {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

export class HistoryPricesHelpers {
  static async getInDayPrices(payload: {
    symbol_id: number;
    access_token: string
  }) {
    const num: number = 288;

    const options = {
      method: 'GET',
      url: `https://tradingstation3-demo.fxcm.com/candles/${payload.symbol_id}/m5`,
      params: {range: 0, access_token: payload.access_token, num, timestamp: new Date().getTime()},
    };
    
    const response = await axios.request(options);
    const result: HistoryPrice[] = response.data.candles.map((value: any) => ({
      date: new Date(value[0] * 1000),
      open: value[1],
      close: value[2],
      high: value[3],
      low: value[4]
    }));

    const now = new Date();
    const startTime = new Date(now);
    if (now.getHours() < 5) {
      // Vẫn là phiên ngày trước
      startTime.setDate(startTime.getDate() - 1);
    }
    startTime.setHours(5);
    startTime.setMinutes(0);
    startTime.setSeconds(0);

    return result.filter(value => value.date.getTime() >= startTime.getTime());
  }

  static async getPreviousHighLowPrice(payload: {
    symbol_id: number;
    access_token: string
  }) {
    const num: number = 2;

    const options = {
      method: 'GET',
      url: `https://tradingstation3-demo.fxcm.com/candles/${payload.symbol_id}/d1`,
      params: {range: 0, access_token: payload.access_token, num, timestamp: new Date().getTime()},
    };
    
    const response = await axios.request(options);
    const previousData = response.data.candles[0];

    return {
      high: previousData[3],
      low: previousData[4]
    };
  }
  // static async getInDayPrices(payload: {
  //   symbol: string;
  //   header: RapidApiHeader
  // }) {
  //   const now = Date.now();
  //   const startTime = new Date();
  //   startTime.setHours(0);
  //   startTime.setMinutes(0);
  //   startTime.setSeconds(0);

  //   const outputsize: number = Math.floor((now - startTime.getTime()) / 1000);

  //   const options = {
  //     method: 'GET',
  //     url: 'https://twelve-data1.p.rapidapi.com/time_series',
  //     params: {symbol: payload.symbol, interval: '5min', outputsize, format: 'json'},
  //     headers: {
  //       'X-RapidAPI-Key': payload.header.key,
  //       'X-RapidAPI-Host': payload.header.host
  //     }
  //   };
    
  //   const response = await axios.request(options);
  //   return response.data.values as HistoryPrice[];
  // }
}