// Native-container integration: everything that only means something inside the
// Capacitor WebView. All of it is a no-op on the website.
//
// The plugin modules are imported dynamically so Rollup keeps them out of the
// entry chunk — a browser visitor never downloads code it cannot use.
import { useEffect, useRef } from 'react'
import { isNative } from './platform.js'

/**
 * Fired on the window when Android's hardware/gesture back is pressed.
 * Cancelable: a screen that has its own idea of "back" (an open drawer, an
 * onboarding slide) calls preventDefault() and nothing else happens.
 */
export const BACK_EVENT = 'si:back'

// Top-level screens. Back from one of these exits the app, the way Android
// users expect — rather than walking backwards into the login form.
const ROOT_PATHS = new Set(['/', '/app', '/login', '/onboarding'])

// The app shell runs on a HashRouter, so the route lives in location.hash.
function currentPath() {
  const hash = window.location.hash
  if (!hash.startsWith('#')) return window.location.pathname
  return hash.slice(1).split('?')[0] || '/'
}

let splashHidden = false

/** Dismiss the launch splash. Idempotent, and safe to call on the web. */
export async function hideSplash() {
  if (splashHidden || !isNative) return
  splashHidden = true
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch {
    /* Plugin unavailable — launchAutoHide takes it down anyway. */
  }
}

/**
 * Drop the soft keyboard. Android leaves it up after a form submit, where it
 * would cover the reply that is streaming in behind it.
 */
export async function hideKeyboard() {
  if (!isNative) return
  try {
    const { Keyboard } = await import('@capacitor/keyboard')
    await Keyboard.hide()
  } catch {
    /* Nothing to hide, or the plugin is missing — not worth surfacing. */
  }
}

async function wireBackButton() {
  const { App: CapApp } = await import('@capacitor/app')
  CapApp.addListener('backButton', () => {
    const consumed = !window.dispatchEvent(new CustomEvent(BACK_EVENT, { cancelable: true }))
    if (consumed) return
    if (!ROOT_PATHS.has(currentPath()) && window.history.length > 1) {
      window.history.back()
      return
    }
    CapApp.exitApp()
  })
}

/**
 * Call once, before React renders. Does nothing in a browser.
 *
 * The status bar and the keyboard insets are left to Capacitor's built-in
 * SystemBars plugin, configured in capacitor.config.json — it runs before any
 * JavaScript, so the bar never flashes the wrong glyph colour on launch.
 */
export function initNative() {
  if (!isNative) return
  wireBackButton()
}

/**
 * Handle Android back inside a component. Return true from `handler` to say
 * "I dealt with it" and stop the default navigation. The handler is read
 * through a ref, so passing an inline arrow does not re-subscribe.
 */
export function useAppBack(handler, enabled = true) {
  const latest = useRef(handler)
  useEffect(() => { latest.current = handler })

  useEffect(() => {
    if (!enabled) return
    const onBack = (e) => {
      if (latest.current?.() === true) e.preventDefault()
    }
    window.addEventListener(BACK_EVENT, onBack)
    return () => window.removeEventListener(BACK_EVENT, onBack)
  }, [enabled])
}
