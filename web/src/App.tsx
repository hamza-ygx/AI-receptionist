import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import { Loading } from "./components/ui";
import { Layout } from "./components/Layout";
import { AcceptInvitePage, ForgotPasswordPage, LoginPage, MfaEnrollPage, MfaVerifyPage, ResetPasswordPage } from "./pages/Auth";
import { CallDetailPage, CallsPage } from "./pages/Calls";
import { MessagesPage } from "./pages/Messages";
import { KnowledgePage } from "./pages/Knowledge";
import { UsersPage } from "./pages/Users";
import { AccountPage } from "./pages/Account";

const AnalyticsPage = lazy(() => import("./pages/Analytics").then((m) => ({ default: m.AnalyticsPage })));

function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Loading />;
  if (!me) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (!me.mfa.passed) return <Navigate to={me.mfa.enabled ? "/mfa" : "/mfa/enroll"} replace />;
  if (admin && me.user.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequirePending({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <Loading />;
  if (!me) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route path="/mfa" element={<RequirePending><MfaVerifyPage /></RequirePending>} />
      <Route path="/mfa/enroll" element={<RequirePending><MfaEnrollPage /></RequirePending>} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="/calls" replace />} />
        <Route path="/calls" element={<CallsPage />} />
        <Route path="/calls/:id" element={<CallDetailPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/analytics" element={<Suspense fallback={<Loading />}><AnalyticsPage /></Suspense>} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/users" element={<RequireAuth admin><UsersPage /></RequireAuth>} />
        <Route path="/account" element={<AccountPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
