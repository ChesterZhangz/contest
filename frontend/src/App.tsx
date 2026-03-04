import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { AuthLayout } from './components/layout/AuthLayout'

// Pages
import LoginPage from './pages/auth/LoginPage'
import VerifyPage from './pages/auth/VerifyPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import BanksPage from './pages/banks/BanksPage'
import BankDetailPage from './pages/banks/BankDetailPage'
import ContestsPage from './pages/contests/ContestsPage'
import ContestFormPage from './pages/contests/ContestFormPage'
import UsersPage from './pages/users/UsersPage'
import SettingsPage from './pages/settings/SettingsPage'

// Session pages (full-page, no sidebar)
import HostPanel from './pages/session/HostPanel'
import JudgePanel from './pages/session/JudgePanel'
import AudienceView from './pages/session/AudienceView'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/verify" element={<VerifyPage />} />
        </Route>

        {/* Session routes (full-page, no sidebar) */}
        <Route path="/session/:sessionId/host" element={<HostPanel />} />
        <Route path="/session/:sessionId/judge" element={<JudgePanel />} />
        <Route path="/session/:sessionId/audience" element={<AudienceView />} />

        {/* Main app routes */}
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/banks" element={<BanksPage />} />
          <Route path="/banks/:bankId" element={<BankDetailPage />} />
          <Route path="/contests" element={<ContestsPage />} />
          <Route path="/contests/new" element={<ContestFormPage />} />
          <Route path="/contests/:contestId/edit" element={<ContestFormPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
