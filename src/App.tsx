import { useRef, useState } from "react";
import "./App.css";
import { TelegramHelpers } from "./utils/telegram";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { HistoryPrice, HistoryPricesHelpers } from "./utils/history-prices";
import { getRejections, writeRejectionData } from "./firebase";
import { defaultOfferIds, offersIds } from "./mock/offers-ids";
import Input from "./components/input";
import { MultiSelect } from "react-multi-select-component";

function checkRejectionBreakCase(
  candle: HistoryPrice,
  yesterdayLowPrice: number,
  yesterdayHighPrice: number
) {
  const isCurrentCandleGreen = candle.open < candle.close;
  if (isCurrentCandleGreen) {
    return candle.high >= yesterdayLowPrice && candle.low <= yesterdayLowPrice;
  } else {
    return (
      candle.high >= yesterdayHighPrice && candle.low <= yesterdayHighPrice
    );
  }
}

function checkRejectionCandle(
  yesterdayLowPrice: number,
  yesterdayHighPrice: number,
  currentCandle: HistoryPrice,
  previousCandle: HistoryPrice
) {
  const isCurrentCandleGreen = currentCandle.open < currentCandle.close;
  const isPreviousCandleGreen = previousCandle.open < previousCandle.close;

  let check = false;
  if (isCurrentCandleGreen) {
    const isBreakLowPrice =
      currentCandle.high >= yesterdayLowPrice &&
      currentCandle.low <= yesterdayLowPrice;
    if (isBreakLowPrice) {
      check = true;
    } else {
      const isPreviousCandleBreakLowPrice =
        previousCandle.high >= yesterdayLowPrice &&
        previousCandle.low <= yesterdayLowPrice;
      const isCurrentCandleInDva =
        currentCandle.low > yesterdayLowPrice &&
        currentCandle.low < yesterdayHighPrice;
      if (
        !isPreviousCandleGreen &&
        isPreviousCandleBreakLowPrice &&
        isCurrentCandleInDva
      ) {
        check = true;
      }
    }
  } else {
    const isBreakLowPrice =
      currentCandle.high >= yesterdayHighPrice &&
      currentCandle.low <= yesterdayHighPrice;
    if (isBreakLowPrice) {
      check = true;
    } else {
      const isPreviousCandleBreakLowPrice =
        previousCandle.high >= yesterdayHighPrice &&
        previousCandle.low <= yesterdayHighPrice;
      const isCurrentCandleInDva =
        currentCandle.high > yesterdayLowPrice &&
        currentCandle.high < yesterdayHighPrice;
      if (
        isPreviousCandleGreen &&
        isPreviousCandleBreakLowPrice &&
        isCurrentCandleInDva
      ) {
        check = true;
      }
    }
  }

  return check;
}

function formatDate(date: Date) {
  return (
    ("0" + date.getDate()).slice(-2) +
    "-" +
    ("0" + (date.getMonth() + 1)).slice(-2) +
    "-" +
    date.getFullYear() +
    " " +
    ("0" + date.getHours()).slice(-2) +
    ":" +
    ("0" + date.getMinutes()).slice(-2)
  );
}

function checkRejection(
  yesterdayLowPrice: number,
  yesterdayHighPrice: number,
  currentCandle: HistoryPrice,
  previousCandle: HistoryPrice,
  previousPreviousCandle?: HistoryPrice,
  previousPreviousPreviousCandle?: HistoryPrice
) {
  const isCurrentCandleHasRejection = checkRejectionCandle(
    yesterdayLowPrice,
    yesterdayHighPrice,
    currentCandle,
    previousCandle
  );
  if (isCurrentCandleHasRejection) {
    // nếu cây nến phía trước đã là rejection thì không thông báo
    if (previousPreviousCandle) {
      if (
        checkRejectionCandle(
          yesterdayLowPrice,
          yesterdayHighPrice,
          previousCandle,
          previousPreviousCandle
        )
      )
        return false;

      // nếu cây nến phía trước phía trướC nữa đã là rejection thì không thông báo
      if (previousPreviousPreviousCandle) {
        if (
          checkRejectionCandle(
            yesterdayLowPrice,
            yesterdayHighPrice,
            previousPreviousCandle,
            previousPreviousPreviousCandle
          )
        )
          return false;
      } else {
        if (
          checkRejectionBreakCase(
            previousPreviousCandle,
            yesterdayLowPrice,
            yesterdayHighPrice
          )
        )
          return false;
      }
    } else {
      if (
        checkRejectionBreakCase(
          previousCandle,
          yesterdayLowPrice,
          yesterdayHighPrice
        )
      )
        return false;
    }

    return true;
  }
  return false;
}

const botToken = "6183612978:AAH3mQUitR7jYfbmdf4KPF9q8Ge-iWhWIcc";
const channelChatId = "-1001677896163";

interface PreviousData {
  [pair: string]: {
    low: number;
    high: number;
  };
}

interface HistoryPrices {
  [pair: string]: HistoryPrice[];
}

interface Pair {
  label: string;
  value: number;
}

const getLocalStorage = (key: string) => {
  try {
    const value = localStorage.getItem(key);
    if (!value) return undefined;
    return JSON.parse(value);
  } catch (error) {
    return undefined;
  }
};

function App() {
  // const [historyPrices, setHistoryPrices] = useState<HistoryPrice[]>(prices.map(price => ({...price, date: new Date(price.date)})));
  const [historyPrices, setHistoryPrices] = useState<HistoryPrices>({});
  const [previousData, setPreviousData] = useState<PreviousData>({});
  const [isStart, setIsStart] = useState(false);
  const intervalRef = useRef<any>();
  const [pairs, setPairs] = useState<Pair[]>(
    getLocalStorage("watchlist_selected") || defaultOfferIds
  );
  const [accessToken, setAccessToken] = useState<string>(
    localStorage.getItem("accessToken") || ""
  );
  const [options, setOptions] = useState<
    {
      label: string;
      value: number;
    }[]
  >(getLocalStorage("watchlist_options") || offersIds);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [newOptionValue, setNewOptionValue] = useState("");

  const init = async (
    pairs: Pair[],
    access_token: string
  ): Promise<{
    newPreviousData?: PreviousData;
    newHistoryPrices?: HistoryPrices;
  }> => {
    const newPreviousData: PreviousData = {};
    const newHistoryPrices: HistoryPrices = {};
    try {
      await Promise.all(
        pairs.map(async ({ label, value }) => {
          newPreviousData[label] =
            await HistoryPricesHelpers.getPreviousHighLowPrice({
              symbol_id: value,
              access_token,
            });
          newHistoryPrices[label] = await HistoryPricesHelpers.getInDayPrices({
            symbol_id: value,
            access_token,
          });
        })
      );

      setPreviousData(newPreviousData);
      setHistoryPrices(newHistoryPrices);

      return {
        newPreviousData,
        newHistoryPrices,
      };
    } catch (error) {
      console.log("error", error);
      toast.error("Lấy dữ liệu thất bại!");
      return {};
    }
  };

  const sendNotify = async (pair: string, candle: HistoryPrice) => {
    const isCurrentCandleGreen = candle.open < candle.close;

    const utc = new Date(candle.date);
    utc.setHours(utc.getHours() - 7);
    const text = `<b>${pair}</b> - Rejection ${
      isCurrentCandleGreen ? "Buy" : "Sell"
    } Signal\n${formatDate(candle.date)} - UTC+7\n${formatDate(utc)} - UTC+0`;

    try {
      await writeRejectionData(pair, candle.date, text);
      await TelegramHelpers.sendMessage({
        botToken,
        chatId: channelChatId,
        text,
      });
    } catch (error) {
      console.log("error", error);
      toast.error("Gửi tin nhắn thông báo tới telegram thất bại!");
    }
  };

  const handleRun = async () => {
    if (!accessToken) {
      return toast.error("Vui lòng nhập AccessToken!");
    }
    if (!pairs.length) {
      return toast.error("Vui lòng chọn Pairs muốn theo dõi!");
    }

    setIsStart(true);

    const { newPreviousData, newHistoryPrices } = await init(
      pairs,
      accessToken
    );

    if (!newPreviousData || !Object.keys(newPreviousData).length) {
      return toast.error("Có lỗi xảy ra khi đọc dữ liệu giá của ngày hôm qua!");
    }

    if (!newHistoryPrices || !Object.keys(newHistoryPrices).length) {
      return toast.error("Có lỗi xảy ra khi đọc dữ liệu giá của ngày hôm nay!");
    }

    intervalRef.current = setInterval(async () => {
      console.log("Query prices");
      await Promise.all(
        pairs.map(async ({ label, value }) => {
          const previousDataPair = previousData[label];
          const newHistoryPricesPair =
            await HistoryPricesHelpers.getInDayPrices({
              symbol_id: value,
              access_token: accessToken,
            });
          if (!newHistoryPricesPair.length) {
            return toast.error(
              "Có lỗi xảy ra khi lấy dữ liệu giá, có thể là do access_token đã hết hạn1"
            );
          }
          setHistoryPrices((oldValue) => ({
            ...oldValue,
            [label]: newHistoryPricesPair,
          }));

          const length = newHistoryPricesPair.length;
          const current = newHistoryPricesPair[length - 1];

          const currentPrice = newHistoryPricesPair.length
            ? newHistoryPricesPair[newHistoryPricesPair.length - 1]
            : undefined;
          console.log({ current, currentPrice });
          if (
            !currentPrice ||
            current.date.getTime() !== currentPrice.date.getTime()
          ) {
            console.log("Check new candle");
            const previous =
              length - 2 >= 0 ? newHistoryPricesPair[length - 2] : undefined;
            const previousPrevious =
              length - 3 >= 0 ? newHistoryPricesPair[length - 3] : undefined;
            const previousPreviousPrevious =
              length - 4 >= 0 ? newHistoryPricesPair[length - 4] : undefined;
            let checked = false;
            if (previous) {
              if (
                checkRejection(
                  previousDataPair.low,
                  previousDataPair.high,
                  current,
                  previous,
                  previousPrevious,
                  previousPreviousPrevious
                )
              ) {
                checked = true;
              }
            } else {
              if (
                checkRejectionBreakCase(
                  current,
                  previousDataPair.low,
                  previousDataPair.high
                )
              ) {
                checked = true;
              }
            }

            const existNotifies = await getRejections(label);
            if (checked && !existNotifies[current.date.toString() as any]) {
              await sendNotify(label, current);
            }
          }
        })
      );
    }, 60 * 1000);

    await Promise.all(
      pairs.map(async ({ label }) => {
        const newHistoryPricesPair = newHistoryPrices[label];
        const newPreviousDataPair = newPreviousData[label];
        console.log("newHistoryPricesPair", {
          newHistoryPricesPair,
          newPreviousDataPair,
        });
        for (let i = 1; i < newHistoryPricesPair.length; i++) {
          const current = newHistoryPricesPair[i];
          const previous = newHistoryPricesPair[i - 1];
          const previousPrevious =
            i - 2 >= 0 ? newHistoryPricesPair[i - 2] : undefined;
          const previousPreviousPrevious =
            i - 3 >= 0 ? newHistoryPricesPair[i - 3] : undefined;
          if (
            checkRejection(
              newPreviousDataPair.low,
              newPreviousDataPair.high,
              current,
              previous,
              previousPrevious,
              previousPreviousPrevious
            )
          ) {
            const existNotifies = await getRejections(label);
            console.log("existNotifies", existNotifies);
            if (!existNotifies[current.date.toString() as any]) {
              await sendNotify(label, current);
            }
          }
        }
      })
    );
  };

  const handleStop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setIsStart(false);
  };

  const handleAddOption = () => {
    if (!newOptionLabel) return toast.error("Vui lòng nhập Label!");
    if (!newOptionValue) return toast.error("Vui lòng nhập Value!");
    if (isNaN(Number(newOptionValue)))
      return toast.error("Value không hợp lệ, vui lòng nhập số!");

    const findExistLabel = options.find(
      (option) => option.label === newOptionLabel
    );
    if (findExistLabel) return toast.error("Label này đã tồn tại!");
    const findExistValue = options.find(
      (option) => option.value === Number(newOptionValue)
    );
    if (findExistValue)
      return toast.error(`Value này đã tồn tại - ${findExistValue.label}!`);

    const newOption = {
      label: newOptionLabel,
      value: Number(newOptionValue),
    };
    const newOptions = [...options, newOption];
    const newPairs = [...pairs, newOption];
    setOptions(newOptions);
    setPairs(newPairs);
    localStorage.setItem("watchlist_selected", JSON.stringify(newPairs));
    localStorage.setItem("watchlist_options", JSON.stringify(newOptions));
  };

  const handleChangeSelect = (pairs: Pair[]) => {
    setPairs(pairs);
    localStorage.setItem("watchlist_selected", JSON.stringify(pairs));
  };

  const handleAccessTokenChange = (newToken: string) => {
    setAccessToken(newToken);
    localStorage.setItem("accessToken", newToken);
  };

  const renderPairs = () => {
    return pairs.map((pair) => {
      const historyPricesPair = historyPrices[pair.label] || [];
      const currentPrice = historyPricesPair.length
        ? historyPricesPair[historyPricesPair.length - 1]
        : undefined;
      return (
        <div className="mt-4" key={pair.label}>
          <div>
            <b>{pair.label}</b>
          </div>
          <div>Đỉnh hôm qua: {previousData[pair.label]?.high}</div>
          <div>Đáy hôm qua: {previousData[pair.label]?.low}</div>
          <div>Nến m5 hiện tại: {currentPrice?.date.toLocaleString()}</div>
          <div>Đỉnh nến m5 hiện tại: {currentPrice?.high}</div>
          <div>Đáy nến m5 hiện tại: {currentPrice?.low}</div>
        </div>
      );
    });
  };

  return (
    <div className="container">
      <div className="mt-4">
        <Input
          value={accessToken}
          label="Access Token"
          placeholder="Enter access token"
          onChange={handleAccessTokenChange}
        />
      </div>
      <div
        style={{
          border: "1px solid #ccc",
          padding: "12px",
          borderRadius: "4px",
          marginTop: "16px",
        }}
      >
        <div>Danh sách theo dõi</div>
        <MultiSelect
          className="mt-4"
          options={options}
          value={pairs}
          onChange={handleChangeSelect}
          labelledBy={"Select"}
          isCreatable={false}
        />
        <div className="mt-4">
          <div>Thêm vào danh sách</div>
          <div className="mt-4" />
          <Input
            value={newOptionLabel}
            label="Label"
            placeholder="Label"
            onChange={setNewOptionLabel}
          />
          <div className="mt-4" />
          <Input
            value={newOptionValue}
            label="Value"
            placeholder="Value"
            onChange={setNewOptionValue}
          />
          <div className="mt-4" />
          <button onClick={handleAddOption}>Add</button>
        </div>
      </div>
      <button
        className="mt-4"
        onClick={() => (isStart ? handleStop() : handleRun())}
      >
        {isStart ? "Stop" : "Start"}
      </button>
      {renderPairs()}
      <ToastContainer />
    </div>
  );
}

export default App;
