import {
  APP_LOGO_COLOR_HEX,
  APP_LOGO_EYE_HEX,
  type AppLogoColor,
  DEFAULT_APP_LOGO_COLOR,
} from "@openbot/contracts/ipc";
import { createSignal, onSettled } from "solid-js";
import { appPort } from "./app-port";

/**
 * Sets the release logo color in this window. Only `--openbot-logo-production` changes, so a dev or
 * preview logo keeps the color of its build, as the Dock icon does.
 */
function applyLogoColor(color: AppLogoColor): void {
  document.documentElement.style.setProperty("--openbot-logo-production", APP_LOGO_COLOR_HEX[color]);
  document.documentElement.style.setProperty("--openbot-logo-production-eye", APP_LOGO_EYE_HEX[color]);
}

/**
 * Keeps this window on the saved logo color. Every window runs it, the Dynamic Island too, because
 * the island has no Settings of its own and main broadcasts each change to every window.
 */
export function syncLogoColor(): void {
  void appPort()
    .getAppLogoColorPreference()
    .then((preference) => applyLogoColor(preference.color))
    .catch(() => undefined);
  appPort().onAppLogoColorPreference((preference) => applyLogoColor(preference.color));
}

/** The Settings control state. Set optimistically, and reverted if main refuses the write. */
export function useLogoColorChoice() {
  const [color, setColor] = createSignal<AppLogoColor>(DEFAULT_APP_LOGO_COLOR);
  let confirmed: AppLogoColor = DEFAULT_APP_LOGO_COLOR;
  let latestRequest = 0;
  let pending = 0;

  /** A saved value from main. A choice that is still in flight is newer, so it stays on screen. */
  function confirm(next: AppLogoColor): void {
    confirmed = next;
    if (pending === 0) setColor(next);
  }

  function changeColor(next: AppLogoColor): void {
    const request = ++latestRequest;
    pending += 1;
    setColor(next);
    void appPort()
      .setAppLogoColorPreference({ color: next })
      .then((preference) => {
        confirmed = preference.color;
        if (request === latestRequest) setColor(preference.color);
      })
      .catch(() => {
        if (request === latestRequest) setColor(confirmed);
      })
      .finally(() => {
        pending -= 1;
      });
  }

  onSettled(() => {
    void appPort()
      .getAppLogoColorPreference()
      .then((preference) => confirm(preference.color))
      .catch(() => undefined);
    return appPort().onAppLogoColorPreference((preference) => confirm(preference.color));
  });

  return { color, changeColor };
}
