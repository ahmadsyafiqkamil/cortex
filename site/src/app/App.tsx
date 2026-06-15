import { RouterProvider } from "react-router";
import { router } from "./routes";
import { useRouteError } from "react-router";

function GlobalErrorBoundary() {
  const error = useRouteError() as any;
  return (
    <div style={{ padding: 20, color: 'red', backgroundColor: 'black', minHeight: '100vh', fontFamily: 'monospace' }}>
      <h2>Application Error</h2>
      <pre>{error?.message || String(error)}</pre>
      <pre>{error?.stack}</pre>
    </div>
  );
}

export default function App() {
  return <RouterProvider router={router} />;
}
