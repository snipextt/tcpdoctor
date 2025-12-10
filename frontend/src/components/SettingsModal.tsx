import React, { useState, useEffect } from 'react';
import './SettingsModal.css';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaveAPIKey: (apiKey: string) => Promise<void>;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    onSaveAPIKey,
}) => {
    const [apiKey, setApiKey] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const savedKey = localStorage.getItem('gemini_api_key') || '';
            setApiKey(savedKey);
            setError(null);
            setSuccess(false);
        }
    }, [isOpen]);

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
                        <p>Key stored locally, data sent to Gemini for analysis.</p>
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
