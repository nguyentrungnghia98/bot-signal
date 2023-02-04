import axios from "axios";
import { io } from "socket.io-client";

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

const trading_api_host = 'api-demo.fxcm.com';
const trading_api_port = 443;
const trading_api_proto = 'https';

export class FxcmHelpers {
  request_headers: any = {
  };
  socket: any;
  url = `${trading_api_proto}://${trading_api_host}:${trading_api_port}`;

  async authenticate(token: string) {
    return new Promise((resolve, reject) => {
      this.socket = io(this.url, {
        query: {
          access_token: token
        }
      });
      // fired when socket.io connects with no errors
      this.socket.on('connect', () => {
        console.log('Socket.IO session has been opened: ', this.socket.id);
        this.request_headers.Authorization = 'Bearer ' + this.socket.id + token;
        resolve(null);
      });
      // fired when socket.io cannot connect (network errors)
      this.socket.on('connect_error', (error: any) => {
        reject('Socket.IO session connect error: ' + error)
      });
      // fired when socket.io cannot connect (login errors)
      this.socket.on('error', (error: any) => {
        reject('Socket.IO session error: ' +  error);
      });
      // fired when socket.io disconnects from the server
      this.socket.on('disconnect', () => {
        console.log('Socket disconnected, terminating client.');
        process.exit(-1);
      });
    });
  };

  async getInDayPrices(symbol_id: number) {
    if (!this.request_headers.Authorization) {
      throw new Error('Có lỗi xảy ra, không tìm thấy authenticate');
    }

    const num: number = 288;

    const options = {
      method: 'GET',
      url: `${this.url}/candles/${symbol_id}/m5`,
      params: {num, timestamp: new Date().getTime()},
      headers: this.request_headers
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

  async getPreviousHighLowPrice(symbol_id: number) {
    if (!this.request_headers.Authorization) {
      throw new Error('Có lỗi xảy ra, không tìm thấy authenticate');
    }

    const num: number = 2;

    const options = {
      method: 'GET',
      url: `${this.url}/candles/${symbol_id}/d1`,
      params: {num, timestamp: new Date().getTime()},
      headers: this.request_headers
    };
    
    const response = await axios.request(options);
    const previousData = response.data.candles[0];

    return {
      high: previousData[3],
      low: previousData[4]
    };
  }
}