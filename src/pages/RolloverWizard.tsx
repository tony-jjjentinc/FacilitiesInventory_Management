import React, { useState } from 'react';
import { apiRequest } from '../services/api';

export const RolloverWizard: React.FC = () => {
  const [step, setStep] = useState(1);
  const [targetYear, setTargetYear] = useState('2027');
  const [isChecking, setIsChecking] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [rolloverResult, setRolloverResult] = useState<any>(null);

  const handleRunChecks = async () => {
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

  return (
    <div className="container py-4" style={{ maxWidth: '780px' }}>
      <div className="card border shadow-sm bg-white">
        <div className="card-header bg-white py-3 px-4 border-bottom">
          <h5 className="fw-bold mb-1 text-dark">Annual Fiscal Rollover Wizard</h5>
          <div className="small text-muted">
            Automates golden template cloning, closing inventory carryover, and active ledger registry.
          </div>
        </div>

        <div className="card-body p-4">
          {/* Progress Tabs */}
          <div className="d-flex border-bottom mb-4 text-center">
            <div className={`flex-fill py-2 small fw-semibold border-bottom ${step === 1 ? 'border-dark text-dark' : 'text-muted border-transparent'}`}>
              1. Pre-Check Audits
            </div>
            <div className={`flex-fill py-2 small fw-semibold border-bottom ${step === 2 ? 'border-dark text-dark' : 'text-muted border-transparent'}`}>
              2. Target Ledger Setup
            </div>
            <div className={`flex-fill py-2 small fw-semibold border-bottom ${step === 3 ? 'border-dark text-dark' : 'text-muted border-transparent'}`}>
              3. Completion
            </div>
          </div>

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
                className="btn btn-dark btn-sm"
                onClick={handleRunChecks}
                disabled={isChecking}
              >
                {isChecking ? 'Verifying...' : 'Run Audit Checks'}
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
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn-dark btn-sm"
                  onClick={handleExecute}
                  disabled={isExecuting}
                >
                  {isExecuting ? 'Executing Rollover...' : 'Confirm & Execute Rollover'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="alert alert-secondary py-3 px-3 mb-4 small" role="alert">
                <div className="fw-bold mb-1">Fiscal Rollover Completed Successfully</div>
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
                Restart Wizard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
