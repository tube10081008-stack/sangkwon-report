import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AccessDenied from './pages/AccessDenied';
import Landing from './pages/Landing';
import ReportPage from './pages/ReportPage';
import SharedReportPage from './pages/SharedReportPage';
import AgentDashboard from './pages/AgentDashboard';
import CoraChat from './pages/CoraChat';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/chat" element={<CoraChat />} />
                <Route path="/report" element={<ReportPage />} />
                <Route path="/shared/:id" element={<SharedReportPage />} />
                <Route path="/agent-hub" element={<AgentDashboard />} />
            </Routes>
        </Router>
    );
}

export default App;
