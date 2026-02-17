import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import ReportPage from './pages/ReportPage';
import SharedReportPage from './pages/SharedReportPage';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/report" element={<ReportPage />} />
                <Route path="/shared/:id" element={<SharedReportPage />} />
            </Routes>
        </Router>
    );
}

export default App;
