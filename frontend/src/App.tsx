/**
 * GitNexus v3.1.0 - Main Application
 * 
 * React Router setup and global providers.
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './store';
import { ToastProvider } from './components/ui/Toast';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';
import Layout from './components/Layout';
import Home from './pages/Home';
import Discovery from './pages/Discovery';
import Watchlist from './pages/Watchlist';
import WatchlistDetail from './pages/WatchlistDetail';
import Replay from './pages/Replay';
import Settings from './pages/Settings';
import './index.css';

export default function App() {
  return (
    <GlobalErrorBoundary>
      <AppProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="discovery" element={<Discovery />} />
                <Route path="watchlist" element={<Watchlist />} />
                <Route path="watchlist/:id" element={<WatchlistDetail />} />
                <Route path="replay" element={<Replay />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AppProvider>
    </GlobalErrorBoundary>
  );
}

