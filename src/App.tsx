import { useMemo, useRef, useState } from "react";
import "./App.css";
import { TelegramHelpers } from "./utils/telegram";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { HistoryPrice, FxcmHelpers } from "./utils/history-prices";
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
    ("0" + date.getUTCDate()).slice(-2) +
    "-" +
    ("0" + (date.getUTCMonth() + 1)).slice(-2) +
    "-" +
    date.getUTCFullYear() +
    " " +
    ("0" + date.getUTCHours()).slice(-2) +
    ":" +
    ("0" + date.getUTCMinutes()).slice(-2)
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
  const [loadingAccessToken, setLoadingAccessToken] = useState(false);
  const [isValidAccessToken, setIsValidAccessToken] = useState(false);

  const fxcmHelpers = useMemo(() => {
    const value = new FxcmHelpers();
    const token = localStorage.getItem('accessToken');
    if (token) {
      setLoadingAccessToken(true);
      value.authenticate(token).then(() => {
        setLoadingAccessToken(false);
        setIsValidAccessToken(true);
      }).catch(error => {
        console.log('error', error);
        toast.error('Có lỗi xảy ra khi authenticate!');
        setLoadingAccessToken(false);
        setIsValidAccessToken(false);
      });
    }
    return value;
  }, []);

  const init = async (
    pairs: Pair[],
  ): Promise<{
    newPreviousData?: PreviousData;
    newHistoryPrices?: HistoryPrices;
  }> => {
    const newPreviousData: PreviousData = {};
    const newHistoryPrices: HistoryPrices = {};
    try {
      await Promise.all(
        pairs.map(async ({ label, value }) => {
          try {
            newPreviousData[label] =
              await fxcmHelpers.getPreviousHighLowPrice(value);
            newHistoryPrices[label] = await fxcmHelpers.getInDayPrices(value);
          } catch (error) {
            console.log('error', error);
            toast.error(`Có lỗi xảy ra khi lấy dữ liệu ${label}. Lý do: chưa subscribe ở fxcm hoặc giá trị value bị sai!`)
          }
        })
      );

      setPreviousData(newPreviousData);
      setHistoryPrices(newHistoryPrices);

      console.log('a', newHistoryPrices);

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
    const vn = new Date(utc);
    vn.setHours(utc.getHours() + 7);
    const est = new Date(utc);
    est.setHours(utc.getHours() - 5);

    const text = `<b>${pair}</b> - Rejection ${
      isCurrentCandleGreen ? "Buy" : "Sell"
    } Signal\n${formatDate(vn)} - UTC+7 (Việt Nam)\n${formatDate(utc)} - UTC+0 (UTC)\n${formatDate(est)} - UTC-5 (EST)`;

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
    );

    if (!newPreviousData || !Object.keys(newPreviousData).length) {
      return toast.error("Có lỗi xảy ra khi đọc dữ liệu giá của ngày hôm qua!");
    }

    if (!newHistoryPrices || !Object.keys(newHistoryPrices).length) {
      return toast.error("Có lỗi xảy ra khi đọc dữ liệu giá của ngày hôm nay!");
    }

    intervalRef.current = setInterval(async () => {
      console.log("Query prices");
      const validPairs = pairs.filter(({label}) => {
        return previousData[label];
      });
      await Promise.all(
        validPairs.map(async ({ label, value }) => {
          const previousDataPair = previousData[label];
          const newHistoryPricesPair =
            await fxcmHelpers.getInDayPrices(value);
          if (!newHistoryPricesPair.length) {
            return toast.error(
              "Có lỗi xảy ra khi lấy dữ liệu giá, có thể là do thứ 7, chủ nhật fxcm không hoạt động!"
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
          if (
            !currentPrice ||
            current.date.getTime() !== currentPrice.date.getTime()
          ) {
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

    for (let pair of pairs) {
      const {label} = pair;
      const newHistoryPricesPair = newHistoryPrices[label];
      const newPreviousDataPair = newPreviousData[label];
      if (!newHistoryPrices || !newPreviousDataPair) {
        continue;
      }
      const existNotifies = await getRejections(label);
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
          if (!existNotifies[current.date.toString() as any]) {
            await sendNotify(label, current);
          }
        }
      }
    }
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

    handleStop();
  };

  const handleRemoveOption = (selected: any) => {
    const newOptions = options.filter((option) => option.label !== selected.label);
    const newPairs = pairs.filter((pair) => pair.label !== selected.label);
    setOptions(newOptions);
    setPairs(newPairs);
    localStorage.setItem("watchlist_selected", JSON.stringify(newPairs));
    localStorage.setItem("watchlist_options", JSON.stringify(newOptions));

    handleStop();
  };

  const handleChangeSelect = (pairs: Pair[]) => {
    const newPairs = options.filter(option => {
      const findExist = pairs.find(pair => pair.value === option.value);
      return findExist;
    });
    setPairs(newPairs);
    localStorage.setItem("watchlist_selected", JSON.stringify(newPairs));

    handleStop();
  };

  const handleAccessTokenChange = async (newToken: string) => {
    setLoadingAccessToken(true);
    setAccessToken(newToken);
    localStorage.setItem("accessToken", newToken);
    try {
      await fxcmHelpers.authenticate(newToken);
      setIsValidAccessToken(true);
    } catch (error) {
      console.log('error', error);
      setIsValidAccessToken(false);
      toast.error('Có lỗi xảy ra khi authenticate!');
    } finally {
      setLoadingAccessToken(false);
    }
    handleStop();
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
          options={options.map(option => ({
            label: <div style={{display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center'}}>
              <div>{option.label}</div>
              <button style={{marginLeft: 'auto'}} onClick={() => handleRemoveOption(option)}>Xoá</button>
            </div>,
            value: option.value
          })) as any}
          value={pairs}
          onChange={handleChangeSelect}
          labelledBy={"Select"}
          isCreatable={false}
          filterOptions={(_, filter) => options.filter(({label}) => label.toLocaleLowerCase().includes(filter.toLocaleLowerCase()))}
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
        disabled={loadingAccessToken || !isValidAccessToken}
        onClick={() => (isStart ? handleStop() : handleRun())}
      >
        {loadingAccessToken? 'Loading...': (isStart ? "Stop" : "Start")}
      </button>
      {renderPairs()}
      <ToastContainer />
    </div>
  );
}

export default App;
