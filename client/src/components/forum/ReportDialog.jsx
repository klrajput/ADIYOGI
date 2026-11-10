import { useEffect, useId, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import { Select, Textarea } from '../ui/Field';
import { reports } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { REPORT_REASONS } from '../../lib/constants';
import { getErrorMessage, getFieldErrors } from '../../lib/errors';

const DETAILS_MAX = 500;

/**
 * Accessible report dialog. Reason values are the enum accepted by POST /reports.
 * Reports are reviewed by the moderation team — never promised as instant.
 */
export default function ReportDialog({ open, onClose, targetType, targetId, targetLabel = 'this content', onReported }) {
  const toast = useToast();
  const titleId = useId();
  const formId = useId();
  const [reason, setReason] = useState(REPORT_REASONS[0].value);
  const [details, setDetails] = useState('');
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason(REPORT_REASONS[0].value);
    setDetails('');
    setError(null);
    setFieldErrors({});
  }, [open]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await reports.create({
        targetType,
        targetId,
        reason,
        ...(details.trim() ? { details: details.trim() } : {}),
      });
      toast.success('Thank you — a moderator will review this report.');
      onReported?.();
      onClose?.();
    } catch (caught) {
      setFieldErrors(getFieldErrors(caught));
      if (caught?.status === 409 || caught?.code === 'CONFLICT') {
        setError('You have already reported this content. A moderator will review it.');
      } else {
        setError(getErrorMessage(caught, 'Your report could not be sent. Please try again.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title="Report content"
      description={`Tell us what is wrong with ${targetLabel}. A moderator will review it; reports are not monitored in real time.`}
      labelledBy={`report-title-${titleId}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="crisis" loading={submitting} disabled={submitting}>
            Send report
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate>
        {error ? (
          <Alert tone="crisis" className="mb-4">
            {error}
          </Alert>
        ) : null}

        <Select
          label="Why are you reporting this?"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          error={fieldErrors.reason}
          required
        >
          {REPORT_REASONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <p className="hint -mt-2 mb-4 text-ink-muted">{REPORT_REASONS.find((option) => option.value === reason)?.hint}</p>

        <Textarea
          label="Anything else a moderator should know? (optional)"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          maxLength={DETAILS_MAX}
          rows={4}
          error={fieldErrors.details}
          hint="Do not include personal details about yourself or anyone else."
        />

        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          If someone is in immediate danger, please contact emergency services rather than waiting for a report to be
          reviewed.
        </p>
      </form>
    </Modal>
  );
}
