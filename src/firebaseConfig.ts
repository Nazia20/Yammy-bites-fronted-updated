import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyB39iQaEioGD3SRqv8hyX_d5bIoi_R1iqI",
  authDomain: "food-junction-43c8d.firebaseapp.com",
  projectId: "food-junction-43c8d",
  storageBucket: "food-junction-43c8d.firebasestorage.app",
  messagingSenderId: "418364839391",
  appId: "1:418364839391:web:99c64b3c1fbc3f5976606a"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});