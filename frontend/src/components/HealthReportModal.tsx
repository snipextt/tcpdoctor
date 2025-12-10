import React, { useState, useEffect } from 'react';
import './HealthReportModal.css';

interface HealthReport {
    summary: string;
    highlights: string[];
    concerns: string[];
    suggestions: string[];
    score: number;
}

interface HealthReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    generateReport: () => Promise<HealthReport>;
    isConfigured: boolean;
    onConfigureAPI: () => void;
}

const HealthReportModal: React.FC<HealthReportModalProps> = ({
    isOpen,
    onClose,
    generateReport,
    isConfigured,
    onConfigureAPI,
}) => {
    const [report, setReport] = useState<HealthReport | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && isConfigured && !report) {
            handleGenerate();
        }
    }, [isOpen, isConfigured]);

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await generateReport();
            setReport(result);
        } catch (err) {
            setError(`${err}`);
        } finally {
            setIsLoading(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return '#22c55e';
        if (score >= 60) return '#f59e0b';
        return '#ef4444';
    };

    const getScoreLabel = (score: number) => {
        if (score >= 80) return 'Healthy';
        if (score >= 60) return 'Fair';
        return 'Critical';
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="health-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Network Health</h2>
                    <div className="header-actions">
                        {report && !isLoading && (
                            <button
                                className="refresh-btn"
                                onClick={handleGenerate}
                                title="Refresh report"
                            >
                                ↻
                            </button>
                        )}
                        <button className="close-btn" onClick={onClose}>×</button>
                    </div>
                </div>

                <div className="modal-body">
                    {!isConfigured && (
                        <div className="config-prompt">
                            <p>API key required</p>
                            <button className="btn-primary" onClick={onConfigureAPI}>
                                Configure
                            </button>
                        </div>
                    )}

                    {isLoading && (
                        <div className="loading-state">
                            <div className="spinner-large"></div>
                            <p>Analyzing...</p>
                        </div>
                    )}

                    {error && (
                        <div className="error-state">
                            <p>❌ {error}</p>
                            <button onClick={handleGenerate}>Retry</button>
                        </div>
                    )}

                    {report && !isLoading && (
                        <div className="report-content">
                            {/* Score */}
                            <div className="score-row">
                                <div
                                    className="score-badge"
                                    style={{ background: getScoreColor(report.score) }}
                                >
                                    <span className="score-num">{report.score}</span>
                                </div>
                                <div className="score-info">
                                    <span className="score-status" style={{ color: getScoreColor(report.score) }}>
                                        {getScoreLabel(report.score)}
                                    </span>
                                    <span className="score-desc">{report.summary}</span>
                                </div>
                            </div>

                            {/* Sections */}
                            <div className="report-sections">
                                {report.highlights && report.highlights.length > 0 && (
                                    <div className="report-section good">
                                        <div className="section-header">
                                            <span className="section-icon">✓</span>
                                            <span>Working Well</span>
                                        </div>
                                        <ul>
                                            {report.highlights.map((item, i) => (
                                                <li key={i}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {report.concerns && report.concerns.length > 0 && (
                                    <div className="report-section warn">
                                        <div className="section-header">
                                            <span className="section-icon">!</span>
                                            <span>Concerns</span>
                                        </div>
                                        <ul>
                                            {report.concerns.map((item, i) => (
                                                <li key={i}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {report.suggestions && report.suggestions.length > 0 && (
                                    <div className="report-section info">
                                        <div className="section-header">
                                            <span className="section-icon">→</span>
                                            <span>Suggestions</span>
                                        </div>
                                        <ul>
                                            {report.suggestions.map((item, i) => (
                                                <li key={i}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HealthReportModal;
