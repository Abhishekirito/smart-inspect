// Where the app shell should land on launch, and whether the intro has been
// seen. Kept free of React and of `window` at import time so the decision can
// be checked by `node src/lib/onboarding.test.mjs`.

export const ONBOARDING_KEY = 'si.onboarded'

// Bump when the intro's content changes enough to be worth showing again.
export const ONBOARDING_VERSION = '1'

function defaultStore() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null // storage disabled: treat every launch as a first launch
  }
}

/** Has this install already been through (or skipped) the intro? */
export function hasOnboarded(store = defaultStore()) {
  try {
    return store?.getItem(ONBOARDING_KEY) === ONBOARDING_VERSION
  } catch {
    return false
  }
}

/** Remember that the intro is done — finishing it and skipping it both count. */
export function markOnboarded(store = defaultStore()) {
  try {
    store?.setItem(ONBOARDING_KEY, ONBOARDING_VERSION)
  } catch {
    /* not worth failing a navigation over */
  }
}

/**
 * The one place that decides what "/" means in the app shell. A signed-in user
 * never sees the intro again; a fresh install sees it before the login form.
 */
export function rootDestination({ hasSession, onboarded }) {
  if (hasSession) return '/app'
  return onboarded ? '/login' : '/onboarding'
}
