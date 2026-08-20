import { useEffect, useState } from "react";
import { listFilter, subscribeListFilter } from "../state/listFilter";

// Faz o componente re-renderizar sempre que a store listFilter mudar
// (inclusive quando o Dashboard escreve nela via dashGoToSinistros).
export function useListFilter() {
  const [, force] = useState(0);
  useEffect(() => subscribeListFilter(() => force((n) => n + 1)), []);
  return listFilter;
}
