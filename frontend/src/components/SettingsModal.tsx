import React, { useState, useEffect } from 'react';
import './SettingsModal.css';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaveAPIKey: (apiKey: string) => Promise<void>;
    currentAPIKey?: string;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    onSaveAPIKey,
    currentAPIKey,
}) => {
    const [apiKey, setApiKey] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        // Load from localStorage on mount
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) {
            setApiKey(savedKey);
        }
    }, [isOpen]);

    const handleSave = async () => {
        if (!apiKey.trim()) {
            setError('Please enter an API key');
            return;
        }

        setIsSaving(true);
        setError(null);
        setSuccess(false);

        try {
            await onSaveAPIKey(apiKey);
            localStorage.setItem('gemini_api_key', apiKey);
            setSuccess(true);
            setTimeout(() => {
                onClose();
            }, 1000);
        } catch (err) {
            setError(`Failed to configure API: ${err}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleClear = () => {
        setApiKey('');
        localStorage.removeItem('gemini_api_key');
        setSuccess(false);
        setError(null);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>⚙️ AI Settings</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    <div className="setting-group">
                        <label htmlFor="api-key">Gemini API Key</label>
                        <p className="setting-description">
                            Get your API key from{' '}
                            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                                Google AI Studio
                            </a>
                        </p>
                        <div className="input-group">
                            <input
                                id="api-key"
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Enter your Gemini API key..."
                                className={error ? 'error' : success ? 'success' : ''}
                            />
                            {apiKey && (
                                <button className="clear-btn" onClick={handleClear} title="Clear">
                                    ×
                                </button>
                            )}
                        </div>
                        {error && <div className="error-message">{error}</div>}
                        {success && <div className="success-message">✓ API key saved successfully!</div>}
                    </div>

                    <div className="info-box">
                        <h4>🔒 Privacy</h4>
                        <p>Your API key is stored locally in your browser and only used to communicate with Google's Gemini API. Your connection data is sent to Gemini for analysis.</p>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="btn-primary"
                        onClick={handleSave}
                        disabled={isSaving || !apiKey.trim()}
                    >
                        {isSaving ? 'Saving...' : 'Save & Enable AI'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
