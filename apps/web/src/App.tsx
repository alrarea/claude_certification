import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { Register } from "./routes/Register";
import { RegisterVerify } from "./routes/RegisterVerify";
import { Login } from "./routes/Login";
import { Profile } from "./routes/Profile";
import { Learn } from "./routes/Learn";
import { LearnTopic } from "./routes/LearnTopic";
import { AdminUsers } from "./routes/AdminUsers";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/register/verify" element={<RegisterVerify />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
          <Route
            path="/learn/:cert"
            element={
              <RequireAuth>
                <Learn />
              </RequireAuth>
            }
          />
          <Route
            path="/learn/:cert/:topicId"
            element={
              <RequireAuth>
                <LearnTopic />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RequireAuth>
                <AdminUsers />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
