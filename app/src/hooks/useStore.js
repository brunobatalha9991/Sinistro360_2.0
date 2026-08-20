import { useEffect, useState } from "react";

// Hook genérico pra "assinar" uma store criada com createStore().
export function useStore(store) {
  const [, force] = useState(0);
  useEffect(() => store.subscribe(() => force((n) => n + 1)), [store]);
  return store.state;
}
