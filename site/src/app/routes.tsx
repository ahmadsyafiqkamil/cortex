/* eslint-disable react-refresh/only-export-components */
import { createHashRouter, useRouteError } from "react-router";
import { Layout } from "./components/Layout";
import { Landing } from "./pages/Landing";
import { Home } from "./pages/Home";
import { PageDetail } from "./pages/PageDetail";
import { GraphView } from "./pages/GraphView";
import { SourcesScreen } from "./pages/SourcesScreen";
import { AskCortex } from "./pages/AskCortex";

function ErrorBoundary() {
  const error = useRouteError() as Error | undefined;
  return (
    <div style={{ padding: 20, color: 'red', backgroundColor: 'black', minHeight: '100vh', fontFamily: 'monospace' }}>
      <h2>Application Error</h2>
      <pre>{error?.message || String(error)}</pre>
      <pre>{error?.stack}</pre>
    </div>
  );
}

export const router = createHashRouter([
  {
    path: "/",
    Component: Landing,
    ErrorBoundary,
  },
  {
    path: "/app",
    Component: Layout,
    ErrorBoundary,
    children: [
      { index: true, Component: Home },
      { path: "wiki/:slug", Component: PageDetail },
      { path: "graph", Component: GraphView },
      { path: "sources", Component: SourcesScreen },
      { path: "ask", Component: AskCortex },
    ],
  },
  {
    path: "*",
    Component: Landing,
  }
]);
