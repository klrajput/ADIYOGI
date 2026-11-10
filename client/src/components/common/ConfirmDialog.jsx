import { useId } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

/**
 * Confirmation dialog for destructive actions. Uses the shared accessible
 * Modal (focus trap, Escape, focus restore) and shows a busy state while the
 * action is in flight.
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'crisis',
  loading = false,
  children,
}) {
  const titleId = useId();
  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      title={title}
      description={description}
      labelledBy={`confirm-${titleId}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'crisis' ? 'crisis' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            disabled={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
