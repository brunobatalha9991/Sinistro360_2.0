import { useCallback, useEffect, useState } from "react";

function parseHash() {
  const h = location.hash.replace(/^#\//, "").split("/");
  return { route: h[0] || "dashboard", param: h[1] || null };
}

export function useHashRoute() {
  const [state, setState] = useState(parseHash);

  useEffect(() => {
    function onHashChange() { setState(parseHash()); }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((route, param) => {
    location.hash = "#/" + route + (param ? "/" + param : "");
    setState({ route, param: param || null });
  }, []);

  return { route: state.route, param: state.param, navigate };
}
