import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { Register } from "./routes/Register";
import { RegisterVerify } from "./routes/RegisterVerify";
import { Login } from "./routes/Login";
import { Profile } from "./routes/Profile";
import { Learn } from "./routes/Learn";
import { LearnTopic } from "./routes/LearnTopic";
import { AdminUsers } from "./routes/AdminUsers";
import { ExamNew } from "./routes/ExamNew";
import { ExamInProgress } from "./routes/ExamInProgress";
import { ExamResults } from "./routes/ExamResults";
import { QuestionsManage } from "./routes/QuestionsManage";
import { QuestionsReview } from "./routes/QuestionsReview";

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
          <Route
            path="/exam/new"
            element={
              <RequireAuth>
                <ExamNew />
              </RequireAuth>
            }
          />
          <Route
            path="/exam/:id"
            element={
              <RequireAuth>
                <ExamInProgress />
              </RequireAuth>
            }
          />
          <Route
            path="/exam/:id/results"
            element={
              <RequireAuth>
                <ExamResults />
              </RequireAuth>
            }
          />
          <Route
            path="/questions/manage"
            element={
              <RequireAuth>
                <QuestionsManage />
              </RequireAuth>
            }
          />
          <Route
            path="/questions/manage/review"
            element={
              <RequireAuth>
                <QuestionsReview />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
