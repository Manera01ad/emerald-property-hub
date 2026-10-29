import { useSettings } from "@/lib/data";
import { parseFlag, type FlagKey } from "@/lib/flags";

/** Reads one feature flag. Defaults to off while settings load, so a feature never flashes open. */
export function useFlag(key: FlagKey): boolean {
  const { data } = useSettings();
  return parseFlag(data?.[key]);
}
