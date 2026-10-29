import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyOtp from './pages/VerifyOtp'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Chat from './pages/Chat'
import Advocates from './pages/Advocates'
import AdvocateLogin from './pages/AdvocateLogin'
import AdvocateSignup from './pages/AdvocateSignup'
import Admin from './pages/Admin'
import LegalAid from './pages/LegalAid'
import Plans from './pages/Plans'
import AdvocateDashboard from './pages/AdvocateDashboard'
import { Navigate } from 'react-router-dom'
import Policy from './pages/Policy'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return <Routes><Route element={<Layout/>}>
    <Route path="/" element={<Home/>}/>
    {/* Citizen / User Routes */}
    <Route path="/login" element={<Login/>}/>
    <Route path="/register" element={<Register/>}/>
    <Route path="/signup" element={<Register/>}/>
    <Route path="/verify-email" element={<VerifyOtp/>}/>
    <Route path="/verify" element={<VerifyOtp/>}/>
    <Route path="/forgot-password" element={<ForgotPassword/>}/>
    <Route path="/reset-password" element={<ResetPassword/>}/>
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard/></ProtectedRoute>}/>
    <Route path="/chat" element={<Chat/>}/>

    {/* Dedicated Advocate Routes */}
    <Route path="/advocate/login" element={<AdvocateLogin/>}/>
    <Route path="/advocate/signup" element={<AdvocateSignup/>}/>
    <Route path="/advocate/register" element={<AdvocateSignup/>}/>
    <Route path="/advocate/join" element={<AdvocateSignup/>}/>
    <Route path="/advocate/dashboard" element={<ProtectedRoute requiredRole="advocate"><AdvocateDashboard/></ProtectedRoute>}/>
    <Route path="/case-draft" element={<Navigate to="/advocate/dashboard" replace/>}/>
    <Route path="/advocates" element={<Advocates/>}/>

    {/* Admin, Plans & General Pages */}
    <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><Admin/></ProtectedRoute>}/>
    <Route path="/legal-aid" element={<LegalAid/>}/>
    <Route path="/plans" element={<Plans/>}/>
    <Route path="/privacy" element={<Policy kind="privacy"/>}/>
    <Route path="/terms" element={<Policy kind="terms"/>}/>
    <Route path="/disclaimer" element={<Policy kind="disclaimer"/>}/>
    <Route path="*" element={<div className="section container"><h1>Page not found</h1><p>The page you requested does not exist.</p></div>}/>
  </Route></Routes>
}
