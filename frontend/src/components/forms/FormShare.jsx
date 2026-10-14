import { useState, useEffect } from 'react';
import { Share2, Copy, Check, Link as LinkIcon, X, Globe, Lock } from 'lucide-react';
import formsApi from '../../api/forms';

/**
 * Form Sharing Modal
 * Enables/disables public access and provides share link
 */
export default function FormShare({ formId, isOpen, onClose, initialFormData }) {
  const [isPublic, setIsPublic] = useState(initialFormData?.is_public || false);
  const [shareToken, setShareToken] = useState(initialFormData?.share_token || null);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (shareToken) {
      const url = `${window.location.origin}/public/forms/${shareToken}`;
      setShareUrl(url);
    }
  }, [shareToken]);

  const handleEnableSharing = async () => {
    setIsLoading(true);
    try {
      const response = await formsApi.enableSharing(formId);
      setIsPublic(true);
      setShareToken(response.share_token);
      setShareUrl(response.share_url);
    } catch (err) {
      console.error('Error enabling sharing:', err);
      alert('Failed to enable sharing');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableSharing = async () => {
    if (!confirm('Are you sure you want to disable public access to this form?')) {
      return;
    }

    setIsLoading(true);
    try {
      await formsApi.disableSharing(formId);
      setIsPublic(false);
      setShareUrl('');
    } catch (err) {
      console.error('Error disabling sharing:', err);
      alert('Failed to disable sharing');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy link');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Share2 className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Share Form</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Make this form publicly accessible via a shareable link
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground/70 hover:text-muted-foreground rounded-lg hover:bg-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Public Access Toggle */}
          <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
            <div className="flex items-center gap-3">
              {isPublic ? (
                <Globe className="w-6 h-6 text-success-600" />
              ) : (
                <Lock className="w-6 h-6 text-muted-foreground/70" />
              )}
              <div>
                <h3 className="font-semibold text-foreground">
                  {isPublic ? 'Public Access Enabled' : 'Public Access Disabled'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isPublic
                    ? 'Anyone with the link can view and submit this form'
                    : 'Only authenticated users can access this form'}
                </p>
              </div>
            </div>

            {isPublic ? (
              <button
                onClick={handleDisableSharing}
                disabled={isLoading}
                className="btn-danger"
              >
                {isLoading ? 'Disabling...' : 'Disable'}
              </button>
            ) : (
              <button
                onClick={handleEnableSharing}
                disabled={isLoading}
                className="btn-primary"
              >
                {isLoading ? 'Enabling...' : 'Enable'}
              </button>
            )}
          </div>

          {/* Share Link */}
          {isPublic && shareUrl && (
            <>
              <div>
                <label className="form-label flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  Share Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="input flex-1 font-mono text-sm"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="btn-secondary flex items-center gap-2"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <p className="form-help">
                  Anyone with this link can fill out and submit the form without logging in
                </p>
              </div>

              {/* Instructions */}
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <h4 className="font-semibold text-primary-900 mb-2">How to use:</h4>
                <ul className="text-sm text-primary-800 space-y-1 list-disc list-inside">
                  <li>Copy the link above and share it with anyone</li>
                  <li>Recipients can access the form without creating an account</li>
                  <li>All submissions will be collected in your submissions dashboard</li>
                  <li>You can disable public access at any time</li>
                </ul>
              </div>

              {/* QR Code Placeholder */}
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <div className="w-32 h-32 mx-auto bg-secondary rounded-lg flex items-center justify-center mb-3">
                  <Share2 className="w-16 h-16 text-muted-foreground/70" />
                </div>
                <p className="text-sm text-muted-foreground">
                  QR Code generation (coming soon)
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex items-center justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
