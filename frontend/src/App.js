import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Debates from './pages/Debates';
import DebateView from './pages/DebateView';

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Debates />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/debates" element={<Debates />} />
        <Route path="/debates/:id" element={<DebateView />} />
      </Routes>
    </Router>
  );
}

export default App;
