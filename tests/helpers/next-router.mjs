import { createElement, useSyncExternalStore } from "react";
import appRouterContext from "next/dist/shared/lib/app-router-context.shared-runtime.js";
import navigationContexts from "next/dist/shared/lib/hooks-client-context.shared-runtime.js";
import linkRouterContext from "next/dist/shared/lib/router-context.shared-runtime.js";

const { AppRouterContext } = appRouterContext;
const { SearchParamsContext, PathnameContext, PathParamsContext } = navigationContexts;
const { RouterContext } = linkRouterContext;

// Actual Next navigation hooks and Link run against their official contexts.
// Only the framework's network/history driver is replaced in isolated DOM tests.
export function createTestRouter(initialHref = "/") {
  let location = new URL(initialHref, "http://localhost:3001");
  const listeners = new Set();
  const publish = (href) => {
    location = new URL(href, location);
    if (globalThis.window) window.history.replaceState({}, "", `${location.pathname}${location.search}${location.hash}`);
    for (const listener of listeners) listener();
  };
  const router = {
    push: publish, replace: publish, refresh() {}, prefetch() { return Promise.resolve(); }, back() {}, forward() {},
    get location() { return location; },
    get pathname() { return location.pathname; },
    get asPath() { return `${location.pathname}${location.search}${location.hash}`; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot() { return location.href; },
  };
  return router;
}

export function NextRouterProvider({ router, children }) {
  useSyncExternalStore(router.subscribe, router.getSnapshot, router.getSnapshot);
  const { pathname, search } = router.location;
  const params = pathname.startsWith("/movies/") ? { movieId: pathname.split("/")[2] } : {};
  // Node resolves Next's unbundled Link export; Next's app compiler supplies the
  // App Router Link alias. Provide its public context too, using the same driver.
  return createElement(RouterContext.Provider, { value: router },
    createElement(AppRouterContext.Provider, { value: router },
    createElement(PathnameContext.Provider, { value: pathname },
      createElement(SearchParamsContext.Provider, { value: new URLSearchParams(search) },
        createElement(PathParamsContext.Provider, { value: params }, children)))));
}

export function TestRouteView({ router, routes, guard: Guard, observer: Observer }) {
  useSyncExternalStore(router.subscribe, router.getSnapshot, router.getSnapshot);
  const route = routes.find(([pathname]) => pathname === router.location.pathname);
  const page = route ? createElement(route[1]) : createElement("h1", null, "페이지 없음");
  const content = Guard && router.location.pathname.startsWith("/mypage")
    ? createElement(Guard, null, page) : page;
  return createElement(NextRouterProvider, { router },
    Observer ? createElement(Observer) : null, content);
}
