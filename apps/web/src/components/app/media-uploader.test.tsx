// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaUploader, UploadButton, useUploadPicker } from './media-uploader';

const mocks = vi.hoisted(() => ({ upload: vi.fn(), toastError: vi.fn() }));
vi.mock('@/lib/hooks', () => ({ useMediaUpload: () => ({ upload: mocks.upload, uploading: false }) }));
vi.mock('@/components/ui/states', () => ({ useErrorMessage: () => () => 'Upload failed' }));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));

const file = (name: string, type = 'image/png') => new File(['x'], name, { type });
const carrying = (...files: File[]) => ({ dataTransfer: { types: ['Files'], files, dropEffect: 'none' } });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.upload.mockImplementation(async (dropped: File) => ({ id: dropped.name }));
});
afterEach(cleanup);

describe('media drag and drop', () => {
  it('highlights while files are over it and uploads only the first image for a single picture', async () => {
    const onUploaded = vi.fn();
    render(<MediaUploader purpose="avatar" label="Change avatar" onUploaded={onUploaded} />);
    const target = screen.getByRole('button', { name: 'Change avatar' });
    fireEvent.dragEnter(target, carrying());
    expect(target.textContent).toBe('Drop to upload');
    fireEvent.drop(target, carrying(file('first.png'), file('second.png')));
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith({ id: 'first.png' }));
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.upload).toHaveBeenCalledWith(expect.objectContaining({ name: 'first.png' }), 'avatar', undefined);
    expect(target.textContent).toBe('Change avatar');
  });

  it('uploads every accepted file and reports the rest', async () => {
    render(<MediaUploader purpose="vehicle" accept="media" multiple onUploaded={vi.fn()} />);
    fireEvent.drop(screen.getByRole('button', { name: 'Upload' }), carrying(file('notes.pdf', 'application/pdf'), file('clip.mp4', 'video/mp4'), file('car.webp', 'image/webp')));
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(2));
    expect(mocks.toastError).toHaveBeenCalledWith('Only images and videos can be uploaded here.');
  });

  it('uploads a drop once when a larger area shares the picker with its button', async () => {
    const onUploaded = vi.fn();
    function Composer() {
      const picker = useUploadPicker('message', onUploaded, { multiple: true });
      return (
        <div data-testid="composer" {...picker.dropProps}>
          <UploadButton picker={picker} label="Attach image" />
        </div>
      );
    }
    render(<Composer />);
    fireEvent.drop(screen.getByRole('button', { name: 'Attach image' }), carrying(file('on-button.png')));
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    fireEvent.drop(screen.getByTestId('composer'), carrying(file('in-area.png')));
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(2));
    expect(mocks.upload.mock.calls.map(([dropped]) => dropped.name)).toEqual(['on-button.png', 'in-area.png']);
  });

  it('ignores images dragged from within the page', () => {
    render(<MediaUploader purpose="avatar" label="Change avatar" onUploaded={vi.fn()} />);
    const target = screen.getByRole('button', { name: 'Change avatar' });
    fireEvent.dragStart(document.body);
    fireEvent.dragEnter(target, carrying());
    fireEvent.drop(target, carrying(file('from-page.png')));
    fireEvent.dragEnd(document.body);
    expect(target.textContent).toBe('Change avatar');
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('keeps the browser from opening files dropped beside a drop zone', () => {
    render(<MediaUploader purpose="avatar" onUploaded={vi.fn()} />);
    const stray = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(stray, 'dataTransfer', { value: carrying(file('stray.png')).dataTransfer });
    document.body.dispatchEvent(stray);
    expect(stray.defaultPrevented).toBe(true);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
