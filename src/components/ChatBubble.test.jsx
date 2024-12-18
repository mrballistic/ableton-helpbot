import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatBubble from './ChatBubble';

describe('ChatBubble', () => {
  const mockMessage = 'Test message';
  const mockContext = [
    { content: 'Context 1', metadata: {} },
    { content: 'Context 2', metadata: {} }
  ];

  it('renders user message correctly', () => {
    render(<ChatBubble message={mockMessage} isUser={true} />);
    expect(screen.getByText(mockMessage)).toBeInTheDocument();
  });

  it('renders assistant message with markdown', () => {
    const markdownMessage = '# Heading\n- List item\n- Another item\n\n```js\nconst code = true;\n```';
    render(<ChatBubble message={markdownMessage} isUser={false} />);
    
    expect(screen.getByRole('heading', { level: 1, name: 'Heading' })).toBeInTheDocument();
    expect(screen.getByText('List item')).toBeInTheDocument();
    expect(screen.getByText('Another item')).toBeInTheDocument();
    expect(screen.getByText('const code = true;')).toBeInTheDocument();
  });

  it('handles context display', () => {
    render(<ChatBubble message={mockMessage} isUser={false} context={mockContext} />);
    
    expect(screen.getByText('Show source')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Show source'));
    
    expect(screen.getByText('Context 1')).toBeInTheDocument();
    expect(screen.getByText('Context 2')).toBeInTheDocument();
    expect(screen.getByText('Hide source')).toBeInTheDocument();
  });

  it('toggles context visibility', () => {
    render(<ChatBubble message={mockMessage} isUser={false} context={mockContext} />);
    
    const toggleButton = screen.getByText('Show source');
    fireEvent.click(toggleButton);
    expect(screen.getByText('Context 1')).toBeVisible();
    
    fireEvent.click(screen.getByText('Hide source'));
    expect(screen.queryByText('Context 1')).not.toBeVisible();
  });

  it('renders complex markdown correctly', () => {
    const complexMarkdown = `
# Main Title

## Subtitle

1. First item
2. Second item
   - Nested item
   - Another nested item

\`\`\`javascript
const test = () => {
  return true;
};
\`\`\`

> Blockquote text

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
`;

    render(<ChatBubble message={complexMarkdown} isUser={false} />);
    
    expect(screen.getByRole('heading', { level: 1, name: 'Main Title' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Subtitle' })).toBeInTheDocument();
    expect(screen.getByText('First item')).toBeInTheDocument();
    expect(screen.getByText('Second item')).toBeInTheDocument();
    expect(screen.getByText('Nested item')).toBeInTheDocument();
    expect(screen.getByText('Another nested item')).toBeInTheDocument();
    expect(screen.getByText('const test = () => {')).toBeInTheDocument();
    expect(screen.getByText('Blockquote text')).toBeInTheDocument();
    expect(screen.getByText('Header 1')).toBeInTheDocument();
    expect(screen.getByText('Cell 1')).toBeInTheDocument();
  });

  it('does not show context toggle for user messages', () => {
    render(<ChatBubble message={mockMessage} isUser={true} context={mockContext} />);
    expect(screen.queryByText('Show source')).not.toBeInTheDocument();
  });

  it('handles messages without context', () => {
    render(<ChatBubble message={mockMessage} isUser={false} />);
    expect(screen.queryByText('Show source')).not.toBeInTheDocument();
  });
});
