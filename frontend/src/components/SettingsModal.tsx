import React, { useState, useEffect } from 'react';
import './SettingsModal.css';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaveAPIKey: (apiKey: string) => Promise<void>;
    refreshRate: number;
    onRefreshRateChange: (rate: number) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    onSaveAPIKey,
    refreshRate,
    onRefreshRateChange,
}) => {
    const [apiKey, setApiKey] = useState('');
    const [rateInput, setRateInput] = useState(refreshRate.toString());
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const savedKey = localStorage.getItem('gemini_api_key') || '';
            setApiKey(savedKey);
            setRateInput(refreshRate.toString());
            setError(null);
            setSuccess(false);
        }
    }, [isOpen, refreshRate]);

    const handleSave = async () => {
        if (!apiKey.trim()) {
            setError('API key required');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            await onSaveAPIKey(apiKey);
            localStorage.setItem('gemini_api_key', apiKey);
            setSuccess(true);
            setTimeout(onClose, 800);
        } catch (err) {
            setError(`${err}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRateChange = (value: string) => {
        setRateInput(value);
        const rate = parseInt(value, 10);
        if (!isNaN(rate) && rate >= 100) {
            onRefreshRateChange(rate);
            localStorage.setItem('refresh_rate', rate.toString());
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>⚙️ Settings</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    {/* Refresh Rate */}
                    <div className="setting-group">
                        <label>Refresh Rate (ms)</label>
                        <div className="input-group">
                            <input
                                type="number"
                                value={rateInput}
                                onChange={(e) => handleRateChange(e.target.value)}
                                min="100"
                                step="100"
                                placeholder="1000"
                            />
                        </div>
                        <p className="setting-description">Minimum 100ms</p>
                    </div>

                    {/* API Key */}
                    <div className="setting-group">
                        <label>Gemini API Key</label>
                        <p className="setting-description">
                            Get from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">AI Studio</a>
                        </p>
                        <div className="input-group">
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Enter API key..."
                                className={error ? 'error' : success ? 'success' : ''}
                            />
                        </div>
                        {error && <div className="error-message">{error}</div>}
                        {success && <div className="success-message">✓ Saved</div>}
                    </div>

                    <div className="info-box">
                        <h4>🔒 Privacy</h4>
                        <p>Settings stored locally. Connection data sent to Gemini for AI analysis.</p>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        className="btn-primary"
                        onClick={handleSave}
                        disabled={isSaving || !apiKey.trim()}
                    >
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
