import { createBrowserRouter, useRouteError } from "react-router";
import { Layout } from "./components/Layout";
import { Landing } from "./pages/Landing";
import { Home } from "./pages/Home";
import { PageDetail } from "./pages/PageDetail";
import { GraphView } from "./pages/GraphView";

function ErrorBoundary() {
  const error = useRouteError() as any;
  return (
    <div style={{ padding: 20, color: 'red', backgroundColor: 'black', minHeight: '100vh', fontFamily: 'monospace' }}>
      <h2>Application Error</h2>
      <pre>{error?.message || String(error)}</pre>
      <pre>{error?.stack}</pre>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Landing,
    ErrorBoundary: ErrorBoundary,
  },
  {
    path: "/app",
    Component: Layout,
    ErrorBoundary: ErrorBoundary,
    children: [
      { index: true, Component: Home },
      { path: "wiki/:id", Component: PageDetail },
      { path: "graph", Component: GraphView },
    ],
  },
  {
    path: "*",
    Component: Landing,
  }
]);
