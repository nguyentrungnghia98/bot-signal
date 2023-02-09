import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, child } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAHSBhbw55_tDL_5_FJxWvvlGfee2hRV2c",
  authDomain: "bot-signal-2a454.firebaseapp.com",
  projectId: "bot-signal-2a454",
  storageBucket: "bot-signal-2a454.appspot.com",
  messagingSenderId: "939658687269",
  appId: "1:939658687269:web:dfad5067f4d7ae6a6660cc",
  databaseURL: "https://bot-signal-2a454-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const dbRef = ref(database);

export async function cleanOldData() {
  const snapshot = await get(child(dbRef, `rejections`));
  if (snapshot.exists()) {
    const pairs = snapshot.val();
    const newPairs: {
      [pair: string]: ExistRejections;
    } = {};
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - 2);
    Object.entries<ExistRejections>(pairs).forEach(([pair, rejections]) => {
      const newRejections: ExistRejections = {};
      const validRejections = Object.keys(rejections).filter((date) => {
        const validDates = date.split('-');
        if (validDates.length >= 2) {
          const tmp = validDates[0];
          validDates[0] = validDates[1];
          validDates[1] = tmp;
        }

        return new Date(validDates.join('-')).getTime() > startTime.getTime();
      });

      validRejections.forEach(date => {
        newRejections[date] = rejections[date];
      });

      if (Object.keys(newRejections).length) {
        newPairs[pair] = newRejections;
      }
    });
    await set(ref(database, `rejections`), newPairs);
  }
}

export interface ExistRejections {
  [date: string]: {
    text: string;
  };
}

function formatPairName(pair: string) {
  return pair.split('/').join('-');
}

export async function getRejections(pair: string): Promise<ExistRejections> {
  const snapshot = await get(child(dbRef, `rejections/${formatPairName(pair)}`));
  if (snapshot.exists()) {
    return snapshot.val();
  } else {
    return {};
  }
}

export async function writeRejectionData(pair: string, date: string, text: string) {
  await set(ref(database, `rejections/${formatPairName(pair)}/` + date), {
    text
  });
}

export async function writeRejectionPair(pair: string, data: {
  [date: string]: {
    text: string
  }
}) {
  await set(ref(database, `rejections/${formatPairName(pair)}`), data);
}


