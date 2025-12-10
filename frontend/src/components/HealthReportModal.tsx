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
        return 'Needs Attention';
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="health-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📊 Network Health Report</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    {!isConfigured && (
                        <div className="config-prompt">
                            <p>AI features require a Gemini API key.</p>
                            <button className="btn-primary" onClick={onConfigureAPI}>
                                Configure API Key
                            </button>
                        </div>
                    )}

                    {isLoading && (
                        <div className="loading-state">
                            <div className="spinner-large"></div>
                            <p>Analyzing network health...</p>
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
                            {/* Score Circle */}
                            <div className="score-section">
                                <div
                                    className="score-circle"
                                    style={{ borderColor: getScoreColor(report.score) }}
                                >
                                    <span className="score-value" style={{ color: getScoreColor(report.score) }}>
                                        {report.score}
                                    </span>
                                    <span className="score-label">{getScoreLabel(report.score)}</span>
                                </div>
                            </div>

                            {/* Summary */}
                            <div className="summary-section">
                                <p>{report.summary}</p>
                            </div>

                            {/* Details Grid */}
                            <div className="details-grid">
                                {report.highlights && report.highlights.length > 0 && (
                                    <div className="detail-card highlights">
                                        <h4>✅ Highlights</h4>
                                        <ul>
                                            {report.highlights.map((item, i) => (
                                                <li key={i}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {report.concerns && report.concerns.length > 0 && (
                                    <div className="detail-card concerns">
                                        <h4>⚠️ Concerns</h4>
                                        <ul>
                                            {report.concerns.map((item, i) => (
                                                <li key={i}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {report.suggestions && report.suggestions.length > 0 && (
                                    <div className="detail-card suggestions">
                                        <h4>💡 Suggestions</h4>
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

                <div className="modal-footer">
                    {report && (
                        <button className="btn-secondary" onClick={handleGenerate} disabled={isLoading}>
                            🔄 Refresh
                        </button>
                    )}
                    <button className="btn-primary" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HealthReportModal;
