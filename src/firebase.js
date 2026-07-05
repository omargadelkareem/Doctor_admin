import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

    const firebaseConfig = {
      apiKey: "AIzaSyBY4Q5FTybQnrQvTeltcUv5kf5ECdL8PLU",
      authDomain: "sulmtak.firebaseapp.com",
      databaseURL: "https://sulmtak-default-rtdb.firebaseio.com",
      projectId: "sulmtak",
      storageBucket: "sulmtak.firebasestorage.app",
      messagingSenderId: "181292718652",
      appId: "1:181292718652:web:e8b01125af08a5008b0139",
      measurementId: "G-49GWH7H8T5"
    };
    
    // Initialize Firebase
    
    const app = initializeApp(firebaseConfig);
    

    export const db = getDatabase(app);
    