/**
 * Type definitions for Metro bundler
 */

/**
 * AsyncRequire type definition for Metro bundler
 * https://github.com/react-native-community/discussions-and-proposals/blob/main/proposals/0605-lazy-bundling.md#__loadbundleasync-in-metro
 */
type AsyncRequire = (path: string) => Promise<void>;

/** Create an `loadBundleAsync` function in the expected shape for Metro bundler. */
export function buildAsyncRequire(): AsyncRequire;