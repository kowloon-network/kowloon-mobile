// Exact keyboard inset for layouts that must end at the keyboard's top edge.
//
// Was: measure the distance from the keyboard's top (the event's
// `endCoordinates.screenY`) to the bottom of the window (`Dimensions.get
// ("window").height`), on the theory that the span covers the keyboard body
// plus anything beneath it (system nav bar, gesture area). That assumed the
// window resizes to exclude the keyboard (windowSoftInputMode=adjustResize)
// -- true pre-Android-15. Android 15+'s edge-to-edge display (default-on as
// of RN 0.86 / Expo SDK 57) means the window no longer resizes, so
// `Dimensions.get("window").height` stays the full screen height while
// `screenY` is reported relative to a window that didn't actually shrink --
// the subtraction produces a wildly wrong (observed: large enough to push an
// element positioned `bottom: <that value>` off the top of the screen)
// number instead of the real keyboard height. `endCoordinates.height` is the
// keyboard's own reported height, direct from the OS, not derived from a
// window-resize assumption -- safe under edge-to-edge. Prefer it.

import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    function onShow(e) {
      const coords = e?.endCoordinates;
      if (coords && typeof coords.height === "number") {
        setInset(coords.height);
      }
    }
    function onHide() {
      setInset(0);
    }
    const show = Keyboard.addListener("keyboardDidShow", onShow);
    const hide = Keyboard.addListener("keyboardDidHide", onHide);
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return { isKeyboardUp: inset > 0, keyboardInset: inset };
}
