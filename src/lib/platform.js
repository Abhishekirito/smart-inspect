// Which shell the same bundle is running in.
//
// One codebase ships twice: as the website (marketing hero at "/", browser
// history URLs) and as the Android app (onboarding carousel at "/", hash URLs
// because a WebView serves from https://localhost with no server to rewrite
// deep paths). Everything platform-conditional reads from here so the checks
// stay in one place.
import { Capacitor } from '@capacitor/core'

/** Inside the Capacitor container — never true in a normal browser tab. */
export const isNative = Capacitor.isNativePlatform()

/** 'android' | 'ios' | 'web' */
export const platform = Capacitor.getPlatform()

const SHELL_KEY = 'si.appShell'

// A browser can opt into the app shell with ?appShell=1 (and back out with
// ?appShell=0) so the onboarding flow can be reviewed without building an APK.
// The choice sticks, because the query string is lost on the first navigation.
function shellOverride() {
  try {
    const q = new URLSearchParams(window.location.search).get('appShell')
    if (q === '1' || q === '0') {
      localStorage.setItem(SHELL_KEY, q)
      return q === '1'
    }
    return localStorage.getItem(SHELL_KEY) === '1'
  } catch {
    return false // private mode / storage disabled: fall back to the website
  }
}

/**
 * True when the UI should behave like an installed app: onboarding instead of
 * the hero page, no "back to home" links, hardware-back handling.
 */
export const isAppShell = isNative || shellOverride()
