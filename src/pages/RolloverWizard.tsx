import React, { useState } from 'react';
import { apiRequest } from '../services/api';
import { getCurrentUser } from '../services/auth';

interface RolloverWizardProps {
  onClose?: () => void;
  isModal?: boolean;
}

export const RolloverWizard: React.FC<RolloverWizardProps> = ({ onClose, isModal = false }) => {
  const [step, setStep] = useState(1);
  const [targetYear, setTargetYear] = useState('2027');
  const [isChecking, setIsChecking] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [rolloverResult, setRolloverResult] = useState<any>(null);

  const currentUser = getCurrentUser();
  const isHeadAdmin = Boolean(
    currentUser?.roles?.some(r => ['super admin', 'head'].includes(String(r).trim().toLowerCase()))
  );

  const handleRunChecks = async () => {
    if (!isHeadAdmin) {
      alert('Unauthorized: Only Head Admin / Super Admin can perform fiscal rollover audits.');
      return;
    }
    setIsChecking(true);
    try {
      const res = await apiRequest('rollover:check');
      if (res && res.ready) {
        setStep(2);
      } else {
        alert(`Rollover Blocked:\n${res.issues?.join('\n') || 'Unresolved issues detected.'}`);
      }
    } catch (err: any) {
      alert(`Validation error: ${err.message}`);
    } finally {
      setIsChecking(false);
    }
  };

  const handleExecute = async () => {
    if (!isHeadAdmin) {
      alert('Unauthorized: Only Head Admin / Super Admin can execute annual fiscal rollover.');
      return;
    }
    setIsExecuting(true);
    try {
      const res = await apiRequest('rollover:execute', {
        currentYear: 2026,
        targetYear: parseInt(targetYear, 10)
      });
      setRolloverResult(res);
      setStep(3);
    } catch (err: any) {
      alert(`Rollover execution failed: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const content = (
    <div className={`card border shadow-sm bg-white ${isModal ? 'border-0 shadow-none' : ''}`}>
      <div className="card-header bg-white py-3 px-4 border-bottom d-flex align-items-center justify-content-between">
        <div>
          <h5 className="fw-bold mb-1 text-dark">Annual Fiscal Rollover Wizard</h5>
          <div className="small text-muted">
            Automates golden template cloning, closing inventory carryover, and active ledger registry.
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
            aria-label="Close"
          ></button>
        )}
      </div>

      <div className="card-body p-4">
          {/* Progress Tabs */}
          <div className="d-flex border-bottom mb-4 text-center">
            <div className={`flex-fill py-2 small fw-semibold border-bottom ${step === 1 ? 'border-primary text-primary' : 'text-muted border-transparent'}`}>
              1. Pre-Check Audits
            </div>
            <div className={`flex-fill py-2 small fw-semibold border-bottom ${step === 2 ? 'border-primary text-primary' : 'text-muted border-transparent'}`}>
              2. Target Ledger Setup
            </div>
            <div className={`flex-fill py-2 small fw-semibold border-bottom ${step === 3 ? 'border-primary text-primary' : 'text-muted border-transparent'}`}>
              3. Completion
            </div>
          </div>

          {!isHeadAdmin && (
            <div className="alert alert-warning py-2 px-3 mb-3 small d-flex align-items-center" role="alert">
              <i className="bi bi-shield-lock-fill me-2 fs-6"></i>
              <div>
                <strong>Read-Only Mode:</strong> Annual fiscal rollover audits and execution are restricted to Head Administrators.
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h6 className="fw-semibold text-dark mb-2">Automated Audit Checklist</h6>
              <p className="text-muted small mb-3">
                Before archiving the active operational spreadsheet, ensure all transactional pipelines are resolved:
              </p>

              <div className="border rounded p-3 mb-4 bg-light small">
                <div className="py-1 border-bottom">
                  • Zero pending incident write-offs in <code>Loss_Information</code>.
                </div>
                <div className="py-1 border-bottom">
                  • Zero unverified delivery staging records in <code>_Imported_MRL</code>.
                </div>
                <div className="py-1">
                  • Verified Google Drive permissions for <code>TEMPLATE_SHEET_ID</code>.
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleRunChecks}
                disabled={isChecking}
              >
                {isChecking ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                    Verifying...
                  </>
                ) : (
                  <>
                    <i className="bi bi-shield-check me-1"></i> Run Audit Checks
                  </>
                )}
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h6 className="fw-semibold text-dark mb-2">Configure Target Fiscal Ledger</h6>
              <p className="text-muted small mb-3">
                All pre-rollover audits passed. Confirm configuration for the new operational spreadsheet:
              </p>

              <div className="row g-3 mb-4">
                <div className="col-12 col-md-6">
                  <label className="form-label small text-muted mb-1">Target Fiscal Year</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={targetYear}
                    onChange={(e) => setTargetYear(e.target.value)}
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label small text-muted mb-1">Generated Title</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    disabled
                    value={`JJJEI - Facilities Inventory Ledger ${targetYear}`}
                  />
                </div>
              </div>

              <div className="d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setStep(1)}
                  disabled={isExecuting}
                >
                  <i className="bi bi-arrow-left me-1"></i> Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleExecute}
                  disabled={isExecuting}
                >
                  {isExecuting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                      Executing Rollover...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-arrow-repeat me-1"></i> Confirm & Execute Rollover
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="alert alert-success py-3 px-3 mb-4 small border" role="alert">
                <div className="fw-bold mb-1">
                  <i className="bi bi-check-circle-fill me-1 text-success"></i> Fiscal Rollover Completed Successfully
                </div>
                <div>The new operational ledger has been provisioned and registered in Master Config.</div>
              </div>

              <div className="border rounded p-3 mb-4 bg-light small">
                <div className="mb-2"><strong>Target Year:</strong> {rolloverResult?.targetYear || targetYear}</div>
                <div className="mb-2"><strong>New Spreadsheet ID:</strong> <code className="text-dark">{rolloverResult?.newSheetId || '—'}</code></div>
                <div><strong>Closing Balances Carried:</strong> {rolloverResult?.transferredRows || 0} inventory rows</div>
              </div>

              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setStep(1)}
              >
                <i className="bi bi-arrow-counterclockwise me-1"></i> Restart Wizard
              </button>
            </div>
          )}
        </div>
      </div>
  );

  if (isModal) {
    return (
      <div
        className="modal show d-block"
        tabIndex={-1}
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', zIndex: 1055 }}
      >
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content border shadow-sm">
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4" style={{ maxWidth: '780px' }}>
      {content}
    </div>
  );
};
