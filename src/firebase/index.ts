import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, child } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDmnd3vuK0UvcL0_PgaNv7yMBGw3OrYzNQ",
  authDomain: "signal-75cc1.firebaseapp.com",
  projectId: "signal-75cc1",
  storageBucket: "signal-75cc1.appspot.com",
  messagingSenderId: "688491341894",
  appId: "1:688491341894:web:3cc7d52a64ffeda4ad4247",
  databaseURL: "https://signal-75cc1-default-rtdb.firebaseio.com/"
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


