import React, { useState } from 'react';
import './DiagnosisPanel.css';

interface DiagnosticResult {
    summary: string;
    issues: string[];
    possibleCauses: string[];
    recommendations: string[];
    severity: string;
}

interface DiagnosisPanelProps {
    onDiagnose: () => Promise<DiagnosticResult | null>;
    isConfigured: boolean;
    onConfigureAPI: () => void;
}

const DiagnosisPanel: React.FC<DiagnosisPanelProps> = ({
    onDiagnose,
    isConfigured,
    onConfigureAPI,
}) => {
    const [diagnosis, setDiagnosis] = useState<DiagnosticResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(true);

    const handleDiagnose = async () => {
        if (!isConfigured) {
            onConfigureAPI();
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await onDiagnose();
            setDiagnosis(result);
        } catch (err) {
            setError(`${err}`);
        } finally {
            setIsLoading(false);
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'healthy': return '✅';
            case 'warning': return '⚠️';
            case 'critical': return '❌';
            default: return '🔍';
        }
    };

    const getSeverityClass = (severity: string) => {
        switch (severity) {
            case 'healthy': return 'severity-healthy';
            case 'warning': return 'severity-warning';
            case 'critical': return 'severity-critical';
            default: return '';
        }
    };

    return (
        <div className="diagnosis-panel">
            <div className="diagnosis-header">
                <button
                    className={`diagnose-btn ${isLoading ? 'loading' : ''}`}
                    onClick={handleDiagnose}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <span className="spinner"></span>
                            Analyzing...
                        </>
                    ) : (
                        <>
                            🔍 {isConfigured ? 'AI Diagnose' : 'Setup AI'}
                        </>
                    )}
                </button>
            </div>

            {error && (
                <div className="diagnosis-error">
                    ❌ {error}
                </div>
            )}

            {diagnosis && (
                <div className={`diagnosis-result ${getSeverityClass(diagnosis.severity)}`}>
                    <div
                        className="diagnosis-summary"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        <span className="severity-icon">{getSeverityIcon(diagnosis.severity)}</span>
                        <span className="summary-text">{diagnosis.summary}</span>
                        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
                    </div>

                    {isExpanded && (
                        <div className="diagnosis-details">
                            {diagnosis.issues && diagnosis.issues.length > 0 && (
                                <div className="detail-section">
                                    <h4>Issues Detected</h4>
                                    <ul>
                                        {diagnosis.issues.map((issue, i) => (
                                            <li key={i}>{issue}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {diagnosis.possibleCauses && diagnosis.possibleCauses.length > 0 && (
                                <div className="detail-section">
                                    <h4>Possible Causes</h4>
                                    <ul>
                                        {diagnosis.possibleCauses.map((cause, i) => (
                                            <li key={i}>{cause}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {diagnosis.recommendations && diagnosis.recommendations.length > 0 && (
                                <div className="detail-section">
                                    <h4>Recommendations</h4>
                                    <ul>
                                        {diagnosis.recommendations.map((rec, i) => (
                                            <li key={i}>{rec}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DiagnosisPanel;
