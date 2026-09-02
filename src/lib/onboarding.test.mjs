// Checks for the app-shell launch decision. No test framework in this project —
// run it with:
//   node src/lib/onboarding.test.mjs
import {
  ONBOARDING_KEY, ONBOARDING_VERSION, hasOnboarded, markOnboarded, rootDestination,
} from './onboarding.js'

let failures = 0
const check = (name, cond, extra = '') => {
  if (cond) {
    console.log(`ok    ${name}`)
    return
  }
  failures += 1
  console.log(`FAIL  ${name}${extra ? `\n      ${extra}` : ''}`)
}

/** Stand-in for localStorage, so the checks need no DOM. */
const fakeStore = (initial = {}) => {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    _map: map,
  }
}

// 1. Fresh install: nothing stored yet.
{
  const store = fakeStore()
  check('1 fresh install is not onboarded', hasOnboarded(store) === false)
  markOnboarded(store)
  check('1 marking sticks', hasOnboarded(store) === true)
  check('1 stores the version', store.getItem(ONBOARDING_KEY) === ONBOARDING_VERSION)
}

// 2. A value from an older intro must not count as seen.
{
  const store = fakeStore({ [ONBOARDING_KEY]: 'stale-version' })
  check('2 stale version re-shows the intro', hasOnboarded(store) === false)
}

// 3. Storage unavailable (private mode) must not throw.
{
  const hostile = {
    getItem: () => { throw new Error('denied') },
    setItem: () => { throw new Error('denied') },
  }
  let threw = false
  try {
    check('3 unreadable storage reads as not onboarded', hasOnboarded(hostile) === false)
    markOnboarded(hostile)
  } catch {
    threw = true
  }
  check('3 unwritable storage does not throw', threw === false)
  check('3 missing store is tolerated', hasOnboarded(null) === false)
}

// 4. Launch routing: the only three outcomes.
{
  check('4 first launch shows the intro',
    rootDestination({ hasSession: false, onboarded: false }) === '/onboarding')
  check('4 later launches go to login',
    rootDestination({ hasSession: false, onboarded: true }) === '/login')
  check('4 a signed-in user skips both',
    rootDestination({ hasSession: true, onboarded: false }) === '/app')
  check('4 a signed-in, onboarded user goes to the app',
    rootDestination({ hasSession: true, onboarded: true }) === '/app')
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS')
process.exit(failures ? 1 : 0)
