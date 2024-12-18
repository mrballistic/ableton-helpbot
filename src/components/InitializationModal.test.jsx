import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import InitializationModal from './InitializationModal';

describe('InitializationModal', () => {
  it('renders when open', () => {
    render(<InitializationModal open={true} progress="Loading..." />);
    
    expect(screen.getByText('Initializing Documentation Assistant')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<InitializationModal open={false} progress="Loading..." />);
    
    expect(screen.queryByText('Initializing Documentation Assistant')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('shows default progress message when none provided', () => {
    render(<InitializationModal open={true} />);
    
    expect(screen.getByText('Please wait while we process the documentation...')).toBeInTheDocument();
  });

  it('updates progress message', () => {
    const { rerender } = render(<InitializationModal open={true} progress="Step 1" />);
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    
    rerender(<InitializationModal open={true} progress="Step 2" />);
    expect(screen.getByText('Step 2')).toBeInTheDocument();
  });

  it('has correct ARIA labels', () => {
    render(<InitializationModal open={true} progress="Loading..." />);
    
    expect(screen.getByLabelText('Initialization progress')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'initialization-modal-title');
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby', 'initialization-modal-description');
  });

  it('renders with long progress messages', () => {
    const longProgress = 'Processing PDF files and generating embeddings for vector store. This might take several minutes depending on the size of your documentation. Current progress: 45% complete';
    render(<InitializationModal open={true} progress={longProgress} />);
    
    expect(screen.getByText(longProgress)).toBeInTheDocument();
  });

  it('handles empty progress message', () => {
    render(<InitializationModal open={true} progress="" />);
    
    expect(screen.getByText('Please wait while we process the documentation...')).toBeInTheDocument();
  });

  it('maintains modal visibility when progress updates', () => {
    const { rerender } = render(<InitializationModal open={true} progress="Step 1" />);
    expect(screen.getByRole('dialog')).toBeVisible();
    
    rerender(<InitializationModal open={true} progress="Step 2" />);
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('handles progress with special characters', () => {
    const progressWithSpecialChars = 'Loading... 50% [===>   ]';
    render(<InitializationModal open={true} progress={progressWithSpecialChars} />);
    
    expect(screen.getByText(progressWithSpecialChars)).toBeInTheDocument();
  });

  it('renders modal with correct styling', () => {
    render(<InitializationModal open={true} progress="Loading..." />);
    
    const dialog = screen.getByRole('dialog');
    const styles = window.getComputedStyle(dialog);
    
    expect(dialog).toBeVisible();
    expect(styles.position).toBe('fixed');
    expect(styles.top).toBe('50%');
    expect(styles.left).toBe('50%');
    expect(styles.transform).toContain('translate(-50%, -50%)');
  });
});
