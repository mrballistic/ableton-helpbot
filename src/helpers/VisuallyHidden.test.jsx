import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import VisuallyHidden from './VisuallyHidden';

describe('VisuallyHidden', () => {
  it('renders children but hides them visually', () => {
    render(<VisuallyHidden>Hidden text</VisuallyHidden>);
    
    const element = screen.getByText('Hidden text');
    const styles = window.getComputedStyle(element);
    
    // Content should be in the DOM but visually hidden
    expect(element).toBeInTheDocument();
    expect(styles.position).toBe('absolute');
    expect(styles.width).toBe('1px');
    expect(styles.height).toBe('1px');
    expect(styles.padding).toBe('0px');
    expect(styles.margin).toBe('-1px');
    expect(styles.overflow).toBe('hidden');
    expect(styles.clip).toBe('rect(0px, 0px, 0px, 0px)');
    expect(styles.whiteSpace).toBe('nowrap');
    expect(styles.border).toBe('0px');
  });

  it('maintains content accessibility', () => {
    render(
      <VisuallyHidden>
        <span role="alert">Screen reader announcement</span>
      </VisuallyHidden>
    );
    
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Screen reader announcement');
  });

  it('works with nested elements', () => {
    render(
      <VisuallyHidden>
        <div>
          <span>Nested</span>
          <span>Content</span>
        </div>
      </VisuallyHidden>
    );
    
    expect(screen.getByText('Nested')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('preserves ARIA attributes', () => {
    render(
      <VisuallyHidden>
        <div role="status" aria-live="polite">Status update</div>
      </VisuallyHidden>
    );
    
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('handles empty content', () => {
    render(<VisuallyHidden />);
    const element = document.querySelector('span');
    expect(element).toBeInTheDocument();
  });

  it('applies correct styles for screen reader only content', () => {
    render(<VisuallyHidden>Screen reader text</VisuallyHidden>);
    
    const element = screen.getByText('Screen reader text');
    const styles = window.getComputedStyle(element);
    
    // Verify all CSS properties needed for screen reader only content
    expect(styles.position).toBe('absolute');
    expect(styles.width).toBe('1px');
    expect(styles.height).toBe('1px');
    expect(styles.padding).toBe('0px');
    expect(styles.margin).toBe('-1px');
    expect(styles.overflow).toBe('hidden');
    expect(styles.clip).toBe('rect(0px, 0px, 0px, 0px)');
    expect(styles.whiteSpace).toBe('nowrap');
    expect(styles.border).toBe('0px');
    expect(styles.wordWrap).toBe('normal');
  });
});
