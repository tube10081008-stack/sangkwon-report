import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AccessDenied from './pages/AccessDenied';
import Landing from './pages/Landing';
import ReportPage from './pages/ReportPage';
import SharedReportPage from './pages/SharedReportPage';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<AccessDenied />} />
                <Route path="/start-analysis" element={<Landing />} />
                <Route path="/report" element={<ReportPage />} />
                <Route path="/shared/:id" element={<SharedReportPage />} />
            </Routes>
        </Router>
    );
}

export default App;
