import { configureStore } from "@reduxjs/toolkit";
import accounts from "./accountsSlice.js";
import toasts from "./toastSlice.js";

export const store = configureStore({
  reducer: {
    accounts,
    toasts,
  },
});
