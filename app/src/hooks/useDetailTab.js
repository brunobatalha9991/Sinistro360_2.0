import { useEffect, useState } from "react";
import { getDetailTab, setDetailTab, subscribeDetailTab } from "../state/detailTab";

export function useDetailTab() {
  const [, force] = useState(0);
  useEffect(() => subscribeDetailTab(() => force((n) => n + 1)), []);
  return [getDetailTab(), setDetailTab];
}
