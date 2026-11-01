/**
 * Layout classes that must not regress, kept here so a test can assert on them.
 *
 * jsdom cannot compute layout, so a real overflow test is impossible in the unit
 * suite. These constants guard the two things that actually caused the 375px
 * overflow on /explore: an `auto`-sized grid track whose content cannot shrink,
 * and native selects that default to `min-width: auto`.
 */

/**
 * Location filters on /explore. Two equal columns below `sm`, then the wide
 * three-column arrangement. The third select spans both columns on mobile
 * because it is the widest of the three.
 */
export const LOCATION_FILTER_GRID = "mt-1 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1.4fr_auto]";

/** Native selects need an explicit `min-w-0` or their intrinsic width forces overflow. */
export const SHRINKABLE_SELECT = "h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm";
