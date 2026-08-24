import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { getGlobalStartContext } from "@tanstack/react-start";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // The CSP middleware generates a per-request nonce (src/start.ts) and
    // passes it through the request context; forwarding it here makes the
    // framework stamp every inline script/style it renders with the matching
    // attribute.
    ssr: { nonce: getGlobalStartContext()?.nonce },
  });

  return router;
};
