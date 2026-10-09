import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';

interface ReportIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ReportIncidentModal: React.FC<ReportIncidentModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [lossType, setLossType] = useState('DAMAGE');
  const [originType, setOriginType] = useState('INVENTORY');
  const [originRefId, setOriginRefId] = useState('FACILITIES_WAREHOUSE_MAIN');
  const [liablePartyId, setLiablePartyId] = useState('');
  const [description, setDescription] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  // Single or multiple items
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [serialNumber, setSerialNumber] = useState('');
  const [disposalMethod, setDisposalMethod] = useState('SCRAP_DISPOSAL');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
      setLossType('DAMAGE');
      setOriginType('INVENTORY');
      setOriginRefId('FACILITIES_WAREHOUSE_MAIN');
      setLiablePartyId('');
      setDescription('');
      setAttachmentUrl('');
      setItemId('');
      setQuantity('1');
      setSerialNumber('');
      setDisposalMethod('SCRAP_DISPOSAL');
      setErrorMsg('');
      setIsSubmitting(false);
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId.trim()) {
      setErrorMsg('Item ID is required.');
      return;
    }
    if (Number(quantity) <= 0) {
      setErrorMsg('Quantity must be greater than 0.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Incident narrative description is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await apiRequest('incident:report', {
        lossType,
        originType,
        originRefId: originRefId.trim(),
        liablePartyId: liablePartyId.trim(),
        incidentDescription: description.trim(),
        attachmentUrl: attachmentUrl.trim(),
        items: [
          {
            itemId: itemId.trim(),
            quantity: Number(quantity),
            serialNumber: serialNumber.trim() || 'N/A',
            disposalMethod
          }
        ]
      });

      alert('Loss Incident Report submitted successfully to Department Head review queue.');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit incident report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal show d-block"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
      tabIndex={-1}
    >
      <div className="modal-dialog modal-lg">
        <div className="modal-content shadow border-0">
          <div className="modal-header bg-danger-subtle text-danger border-bottom">
            <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
              <i className="bi bi-exclamation-octagon-fill"></i>
              File Loss / Damage Incident Report
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={isSubmitting}
            ></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              {errorMsg && (
                <div className="alert alert-danger py-2 small mb-3">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  {errorMsg}
                </div>
              )}

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Incident Type *</label>
                  <select
                    className="form-select form-select-sm"
                    value={lossType}
                    onChange={(e) => setLossType(e.target.value)}
                  >
                    <option value="DAMAGE">Accidental Physical Damage (DAMAGE)</option>
                    <option value="EXPIRATION">Shelf-Life Expiration (EXPIRATION)</option>
                    <option value="MISHANDLEMENT">Operational Negligence (MISHANDLEMENT)</option>
                    <option value="THEFT_LOSS">Missing / Theft Variance (THEFT_LOSS)</option>
                    <option value="SCRAP">End-of-Life Decommissioning (SCRAP)</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Origin Type *</label>
                  <select
                    className="form-select form-select-sm"
                    value={originType}
                    onChange={(e) => setOriginType(e.target.value)}
                  >
                    <option value="INVENTORY">Warehouse Storage (INVENTORY)</option>
                    <option value="ACTIVITY">Project Work Order (ACTIVITY)</option>
                    <option value="IN_HOUSE">Staff Tool Custody (IN_HOUSE)</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Origin Reference / Location *</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. FACILITIES_WAREHOUSE_MAIN or ACT-2026-0012"
                    value={originRefId}
                    onChange={(e) => setOriginRefId(e.target.value)}
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Accountable / Liable Party</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Email or Employee ID (e.g. tech.m@jjjentinc.com)"
                    value={liablePartyId}
                    onChange={(e) => setLiablePartyId(e.target.value)}
                  />
                </div>

                <div className="col-12">
                  <hr className="my-2" />
                  <h6 className="fw-bold small text-muted text-uppercase mb-3">Item Details</h6>
                </div>

                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Inventory Item ID *</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. ITM-0001"
                    value={itemId}
                    onChange={(e) => setItemId(e.target.value)}
                    required
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Quantity to Write Off *</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control form-control-sm"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Serial Number</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="N/A or Specific Serial"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Proposed Disposal Method</label>
                  <select
                    className="form-select form-select-sm"
                    value={disposalMethod}
                    onChange={(e) => setDisposalMethod(e.target.value)}
                  >
                    <option value="SCRAP_DISPOSAL">Physical Scrap & Recycling</option>
                    <option value="HAZMAT_DISPOSAL">Hazardous Waste Disposal</option>
                    <option value="RETURN_TO_VENDOR">Return to Vendor for RMA</option>
                    <option value="WRITE_OFF_AUDIT">Direct Balance Write-off</option>
                  </select>
                </div>

                <div className="col-12">
                  <label className="form-label small fw-semibold">Narrative Description & Reason *</label>
                  <textarea
                    className="form-control form-control-sm"
                    rows={3}
                    placeholder="Describe how the incident occurred, physical evidence, or reason for scrap/expiration..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  ></textarea>
                </div>

                <div className="col-12">
                  <label className="form-label small fw-semibold">Photo Evidence Attachment (URL or Drive Link)</label>
                  <input
                    type="url"
                    className="form-control form-control-sm"
                    placeholder="https://drive.google.com/..."
                    value={attachmentUrl}
                    onChange={(e) => setAttachmentUrl(e.target.value)}
                  />
                  <div className="form-text small text-muted">
                    Paste Google Drive photo link or file attachment reference.
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer bg-light border-top">
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-sm btn-danger d-flex align-items-center gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    Submitting...
                  </>
                ) : (
                  <>
                    <i className="bi bi-send-fill"></i>
                    Submit Incident Report
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
