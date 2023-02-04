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

export async function writeRejectionData(pair: string, date: Date, text: string) {
  await set(ref(database, `rejections/${pair}/` + date.toString()), {
    text
  });
}

export async function getRejections(pair: string): Promise<{
  [date: string]: {
    text: string;
  };
}> {
  const snapshot = await get(child(dbRef, `rejections/${pair}`));
  if (snapshot.exists()) {
    return snapshot.val();
  } else {
    return {};
  }
}


