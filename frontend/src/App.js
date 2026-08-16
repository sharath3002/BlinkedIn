import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import "@/App.css";

import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";

import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Jobs from "@/pages/Jobs";
import JobDetail from "@/pages/JobDetail";
import ReferralSubmit from "@/pages/ReferralSubmit";
import Pricing from "@/pages/Pricing";
import { PaymentSuccess, PaymentCancel } from "@/pages/Payment";
import Contact from "@/pages/Contact";
import Technology from "@/pages/Technology";
import ReferATalent from "@/pages/ReferATalent";
import EmployeeDashboard from "@/pages/EmployeeDashboard";
import Profile from "@/pages/Profile";
import Admin from "@/pages/Admin";
import AIAgent from "@/pages/AIAgent";
import VerifyEmail from "@/pages/VerifyEmail";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";

function Shell({ children }) {
  const { pathname } = useLocation();
  const hideChrome = pathname === "/login"
    || pathname.startsWith("/payment")
    || pathname.startsWith("/verify-email/") || pathname === "/forgot-password" || pathname.startsWith("/reset-password/");
  return (
    <div className="App min-h-screen flex flex-col">
      {!hideChrome && <Navbar />}
      <main className="flex-1">{children}</main>
      {!hideChrome && <Footer />}
      {!hideChrome && <CookieBanner />}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Shell>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/jobs/:id" element={<JobDetail />} />
              <Route path="/referral/:jobId" element={<ReferralSubmit />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/payment/success" element={<PaymentSuccess />} />
              <Route path="/payment/cancel" element={<PaymentCancel />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/technology" element={<Technology />} />
              <Route path="/refer-a-talent" element={<ReferATalent />} />
              <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/ai-agent" element={<AIAgent />} />
              <Route path="/verify-email/:token" element={<VerifyEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
            </Routes>
          </Shell>
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
