import React from 'react';
import { AuthProvider, useAuth } from './app/auth';
import { navigate, usePathname } from './app/router';
import PublicHome from './pages/PublicHome';
import PricingPage from './pages/PricingPage';
import AuthPage from './pages/AuthPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordPages';
import MfaPage from './pages/MfaPage';
import OnboardingPage from './pages/OnboardingPage';
import AppShell from './pages/AppShell';

export default function App() {
  return <AuthProvider><Routes/></AuthProvider>;
}

function Routes() {
  const path = usePathname();
  if (path === '/') return <PublicHome/>;
  if (path === '/pricing') return <PricingPage/>;
  if (path === '/login' || path === '/signup') return <AuthPage/>;
  if (path === '/auth/callback') return <AuthCallbackPage/>;
  if (path === '/forgot-password') return <ForgotPasswordPage/>;
  if (path === '/reset-password') return <ResetPasswordPage/>;
  if (path === '/mfa') return <MfaPage/>;
  if (path === '/onboarding') return <OnboardingPage/>;
  if (path.startsWith('/app')) return <AppShell/>;
  return <NotFound/>;
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-5 text-center">
      <p className="text-sm font-bold text-indigo-600">404</p>
      <h1 className="mt-2 text-4xl font-black">Page not found</h1>
      <button onClick={() => navigate('/')} className="mt-6 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
        Back to Jobryn
      </button>
    </div>
  );
}
