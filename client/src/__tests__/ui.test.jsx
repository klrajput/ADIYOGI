import { useState } from 'react';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import Button from '../components/ui/Button';
import { Field, Input, Textarea, Select, Checkbox } from '../components/ui/Field';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Pagination from '../components/ui/Pagination';
import Alert from '../components/ui/Alert';
import Spinner, { LoadingBlock } from '../components/ui/Spinner';

describe('Button', () => {
  it('renders a button with type=button by default and handles clicks', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save changes</Button>);
    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies variant and size classes', () => {
    render(
      <Button variant="secondary" size="sm">
        Secondary
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Secondary' });
    expect(button.className).toContain('btn-secondary');
    expect(button.className).toContain('btn-sm');
  });

  it('shows a loading state, is aria-busy and cannot be clicked while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Posting
      </Button>
    );
    const button = screen.getByRole('button', { name: /Posting/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is disabled and not clickable when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders a real link when given a router destination', () => {
    render(
      <MemoryRouter>
        <Button to="/community">Community</Button>
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: 'Community' });
    expect(link).toHaveAttribute('href', '/community');
  });

  it('renders an external anchor when given href', () => {
    render(<Button href="https://findahelpline.com">Find a helpline</Button>);
    const link = screen.getByRole('link', { name: 'Find a helpline' });
    expect(link).toHaveAttribute('href', 'https://findahelpline.com');
  });
});

describe('Field / Input', () => {
  it('associates the label with the control', () => {
    render(<Input label="Display name" />);
    expect(screen.getByLabelText('Display name')).toBeInstanceOf(HTMLInputElement);
  });

  it('renders an error with role=alert and marks the input invalid', () => {
    render(<Input label="Email" error="Enter a valid email address" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Enter a valid email address');
  });

  it('marks required fields and renders the hint when there is no error', () => {
    const { rerender } = render(<Input label="Password" hint="At least 12 characters" required />);
    expect(screen.getByLabelText(/Password/)).toBeRequired();
    expect(screen.getByText('At least 12 characters')).toBeInTheDocument();

    rerender(<Input label="Password" hint="At least 12 characters" required error="Too short" />);
    expect(screen.queryByText('At least 12 characters')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Too short');
  });

  it('renders a textarea and select with accessible labels', () => {
    render(
      <>
        <Textarea label="Your message" maxLength={2000} value="hello" showCount />
        <Select label="Country" defaultValue="IN">
          <option value="IN">India</option>
          <option value="US">United States</option>
        </Select>
      </>
    );
    expect(screen.getByLabelText('Your message')).toBeInstanceOf(HTMLTextAreaElement);
    expect(screen.getByLabelText('Country')).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByText('5/2000')).toBeInTheDocument();
  });

  it('renders a labelled checkbox and its error', () => {
    render(<Checkbox label="I understand" hint="Required" />);
    expect(screen.getByLabelText(/I understand/)).toBeInstanceOf(HTMLInputElement);
  });

  it('Field renders arbitrary children next to the label', () => {
    render(
      <Field label="Custom" htmlFor="custom-input" hint="Helpful hint">
        <input id="custom-input" />
      </Field>
    );
    expect(screen.getByLabelText('Custom')).toBeInTheDocument();
    expect(screen.getByText('Helpful hint')).toBeInTheDocument();
  });
});

describe('Modal', () => {
  function Harness({ onClose = () => {} }) {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)}>
          Open dialog
        </button>
        <Modal
          open={open}
          onClose={() => {
            setOpen(false);
            onClose();
          }}
          title="Report this reply"
          description="A moderator will review it."
          footer={
            <button type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          }
        >
          <button type="button">Send report</button>
        </Modal>
      </div>
    );
  }

  it('does not render when closed and opens as a labelled dialog', async () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Report this reply');
    expect(within(dialog).getByText('A moderator will review it.')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement.querySelector('.absolute.inset-0');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('moves focus into the dialog and traps Tab / Shift+Tab', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
    const dialog = screen.getByRole('dialog');
    const closeButton = within(dialog).getByRole('button', { name: 'Close dialog' });

    await waitFor(() => expect(document.activeElement).toBe(closeButton));

    const focusable = dialog.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('restores focus to the trigger when closed', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    trigger.focus();
    await userEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe('EmptyState', () => {
  it('renders an accessible heading, description and a next action', () => {
    render(
      <EmptyState
        title="No threads yet"
        description="Be the first to share something kind."
        action={<button type="button">Start a thread</button>}
      />
    );
    expect(screen.getByRole('heading', { name: 'No threads yet' })).toBeInTheDocument();
    expect(screen.getByText('Be the first to share something kind.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start a thread' })).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('renders an alert with a retry action and reference id', async () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Could not load" description="Please try again." onRetry={onRetry} requestId="req-123" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Could not load' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Reference: req-123')).toBeInTheDocument();
  });

  it('renders without a retry button when no retry handler exists', () => {
    render(<ErrorState />);
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});

describe('Pagination', () => {
  const meta = { page: 2, limit: 10, total: 45, totalPages: 5, hasNext: true, hasPrev: true };

  it('renders nothing when there is only one page', () => {
    const { container } = render(
      <Pagination meta={{ ...meta, page: 1, totalPages: 1, hasNext: false, hasPrev: false }} onPageChange={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing without meta', () => {
    const { container } = render(<Pagination meta={null} onPageChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('announces the current page and calls onPageChange for page/prev/next', async () => {
    const onPageChange = vi.fn();
    render(<Pagination meta={meta} onPageChange={onPageChange} />);

    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);

    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);

    await userEvent.click(screen.getByRole('button', { name: '5' }));
    expect(onPageChange).toHaveBeenLastCalledWith(5);
  });

  it('disables the arrow on the first page', () => {
    const { unmount } = render(
      <Pagination meta={{ ...meta, page: 1, hasPrev: false }} onPageChange={() => {}} />
    );
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    unmount();
  });

  it('disables the arrow on the last page', () => {
    render(<Pagination meta={{ ...meta, page: 5, hasNext: false }} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });
});

describe('Alert and Spinner', () => {
  it('uses role=alert for warning/crisis tones and status otherwise', () => {
    const { rerender } = render(<Alert tone="warning">Careful</Alert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Careful');

    rerender(<Alert tone="info">For your information</Alert>);
    expect(screen.getByRole('status')).toHaveTextContent('For your information');
  });

  it('Spinner exposes a status role with an accessible label', () => {
    render(<Spinner label="Loading boards" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading boards');
  });

  it('LoadingBlock announces a busy region', () => {
    render(<LoadingBlock label="Loading threads" rows={2} />);
    const region = screen.getByText('Loading threads').closest('[aria-busy]');
    expect(region).toHaveAttribute('aria-busy', 'true');
  });
});
