// toastSlice -- transient on-screen notifications (success/error/info).
// Mirrors web's app/toastSlice.js exactly (kowloon-design/components/Toast.md).
//
// Push toasts via the helper module at lib/toast.js -- callers should not
// dispatch these actions directly. Auto-dismiss timers live in <ToastStack />.
//
// Each item: {
//   id:           string          // crypto.randomUUID()
//   kind:         'success'|'error'|'info'
//   message:      string          // primary one-liner
//   detail?:      string          // optional secondary line (e.g. error.message)
//   action?:      { label, onPress }
//   durationMs:   number          // 0 = sticky (manual dismiss only)
// }

import { createSlice } from "@reduxjs/toolkit";

const MAX_VISIBLE = 5;

const toastSlice = createSlice({
  name: "toasts",
  initialState: { items: [] },
  reducers: {
    pushToast(state, action) {
      state.items.push(action.payload);
      if (state.items.length > MAX_VISIBLE) {
        state.items.splice(0, state.items.length - MAX_VISIBLE);
      }
    },
    dismissToast(state, action) {
      state.items = state.items.filter((t) => t.id !== action.payload);
    },
    clearToasts(state) {
      state.items = [];
    },
  },
});

export const { pushToast, dismissToast, clearToasts } = toastSlice.actions;
export default toastSlice.reducer;
