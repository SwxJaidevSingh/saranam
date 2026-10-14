import { CheckCircle, ArrowLeft, Download, Share2 } from 'lucide-react';

/**
 * Confirmation Page Component
 * Shown after successful form submission
 */
export default function ConfirmationPage({
  config = {},
  onReset,
  onDownload,
  onShare,
}) {
  const {
    title = 'Thank You!',
    message = 'Your response has been successfully submitted.',
    showResetButton = true,
    showDownloadButton = false,
    showShareButton = false,
    redirectUrl = null,
    redirectDelay = 0,
    customHtml = null,
  } = config;

  // Handle auto-redirect
  if (redirectUrl && redirectDelay > 0) {
    setTimeout(() => {
      window.location.href = redirectUrl;
    }, redirectDelay * 1000);
  }

  return (
    <div className="max-w-2xl mx-auto text-center py-12">
      {/* Success Icon */}
      <div className="mb-6">
        <div className="w-20 h-20 mx-auto bg-success-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-12 h-12 text-success-600" />
        </div>
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold text-foreground mb-4">{title}</h1>

      {/* Message */}
      <div className="text-lg text-muted-foreground mb-8">
        {customHtml ? (
          <div dangerouslySetInnerHTML={{ __html: customHtml }} />
        ) : (
          <p>{message}</p>
        )}
      </div>

      {/* Redirect Notice */}
      {redirectUrl && redirectDelay > 0 && (
        <p className="text-sm text-muted-foreground mb-6">
          Redirecting in {redirectDelay} seconds...
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        {showResetButton && onReset && (
          <button
            onClick={onReset}
            className="btn-primary flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Submit Another Response
          </button>
        )}

        {showDownloadButton && onDownload && (
          <button
            onClick={onDownload}
            className="btn-secondary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download Copy
          </button>
        )}

        {showShareButton && onShare && (
          <button
            onClick={onShare}
            className="btn-secondary flex items-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        )}

        {redirectUrl && !redirectDelay && (
          <a
            href={redirectUrl}
            className="btn-secondary"
          >
            Continue
          </a>
        )}
      </div>

      {/* Additional Info */}
      {config.showSubmissionId && (
        <div className="mt-8 p-4 bg-secondary rounded-lg">
          <p className="text-sm text-muted-foreground">
            Submission ID: <span className="font-mono font-semibold">#{Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
          </p>
        </div>
      )}
    </div>
  );
}
