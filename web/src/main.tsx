import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./i18n";
import i18n from "./i18n";
import "./styles.css";
import { AuthProvider } from "./auth";
import { App } from "./App";
import { applyTheme } from "./pages/Account";

document.documentElement.lang = i18n.language;
try {
  const theme = localStorage.getItem("rkjh.theme");
  if (theme === "light" || theme === "dark") applyTheme(theme);
} catch { /* storage unavailable */ }

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: (count, err) => count < 2 && !(err instanceof Error && /^(unauthenticated|mfa_required|forbidden|not_found)$/.test(err.message)), staleTime: 15_000, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
