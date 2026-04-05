import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Nav from './components/Nav'
import Dashboard from './pages/Dashboard'
import FoodLog from './pages/FoodLog'
import MealLibrary from './pages/MealLibrary'
import Training from './pages/Training'
import Progress from './pages/Progress'
import Profile from './pages/Profile'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Nav />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/log" element={<FoodLog />} />
            <Route path="/meals" element={<MealLibrary />} />
            <Route path="/training" element={<Training />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
