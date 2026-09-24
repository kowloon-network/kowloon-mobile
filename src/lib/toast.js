// toast -- call-from-anywhere helper for the toast notification system.
// Same API shape as web's app/toast.js (kowloon-design/components/Toast.md) --
// use this for single-message, no-decision feedback ("Copied," "Added to
// Discovery," "Couldn't save"). Alert.alert stays for real confirm-or-cancel
// decisions (deletes, deactivations) -- that's the correct tool for those.
//
// Usage:
//   import { toast } from '../../lib/toast'
//   toast.success('Added to circle', { action: { label: 'View', onPress: () => router.push(...) } })
//   toast.error("Couldn't save", { detail: err.message })
//   toast.info('Copied')
//   toast.dismiss(id)
//
// Options:
//   detail        secondary text below the message (e.g. err.message)
//   action        { label, onPress }
//   durationMs    override the default auto-dismiss (success/info: 4s, error: 8s; 0 = sticky)

import { store } from "../state/store.js";
import { pushToast, dismissToast, clearToasts } from "../state/toastSlice.js";

const DEFAULT_DURATION = {
  success: 4000,
  info: 4000,
  error: 8000,
};

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function push(kind, message, opts = {}) {
  const item = {
    id: makeId(),
    kind,
    message,
    detail: opts.detail,
    action: opts.action,
    durationMs: opts.durationMs ?? DEFAULT_DURATION[kind] ?? 4000,
  };
  store.dispatch(pushToast(item));
  return item.id;
}

export const toast = {
  success: (message, opts) => push("success", message, opts),
  error: (message, opts) => push("error", message, opts),
  info: (message, opts) => push("info", message, opts),
  dismiss: (id) => store.dispatch(dismissToast(id)),
  clear: () => store.dispatch(clearToasts()),
};
