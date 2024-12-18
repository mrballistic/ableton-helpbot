import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from './ChatInterface';

describe('ChatInterface', () => {
  const mockMessages = [
    { text: 'Hello', sender: 'user' },
    { text: 'Hi there!', sender: 'bot', context: [{ content: 'Context', metadata: {} }] }
  ];

  const mockProps = {
    messages: mockMessages,
    input: '',
    loading: false,
    isInitializing: false,
    messagesEndRef: { current: null },
    inputRef: { current: null },
    onInputChange: vi.fn(),
    onKeyPress: vi.fn(),
    onSend: vi.fn()
  };

  it('renders messages correctly', () => {
    render(<ChatInterface {...mockProps} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });

  it('handles input changes', async () => {
    const user = userEvent.setup();
    render(<ChatInterface {...mockProps} />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, 'Test message');
    
    expect(mockProps.onInputChange).toHaveBeenCalled();
  });

  it('handles send button click', async () => {
    const user = userEvent.setup();
    render(<ChatInterface {...mockProps} input="Test message" />);
    
    await user.click(screen.getByRole('button', { name: /send/i }));
    expect(mockProps.onSend).toHaveBeenCalled();
  });

  it('disables input and send button when loading', () => {
    render(<ChatInterface {...mockProps} loading={true} />);
    
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('disables input and send button when initializing', () => {
    render(<ChatInterface {...mockProps} isInitializing={true} />);
    
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('shows loading indicator when loading', () => {
    render(<ChatInterface {...mockProps} loading={true} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('handles enter key press', async () => {
    const user = userEvent.setup();
    render(<ChatInterface {...mockProps} input="Test message" />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, '{Enter}');
    
    expect(mockProps.onKeyPress).toHaveBeenCalled();
  });

  it('shows correct placeholder text when initializing', () => {
    render(<ChatInterface {...mockProps} isInitializing={true} />);
    expect(screen.getByPlaceholderText('Initializing...')).toBeInTheDocument();
  });

  it('shows correct placeholder text when ready', () => {
    render(<ChatInterface {...mockProps} />);
    expect(screen.getByPlaceholderText('Ask a question about Ableton...')).toBeInTheDocument();
  });

  it('renders messages with correct alignment', () => {
    render(<ChatInterface {...mockProps} />);
    
    const userMessage = screen.getByText('Hello');
    const botMessage = screen.getByText('Hi there!');
    
    expect(userMessage.parentElement).toHaveStyle({ justifyContent: 'flex-end' });
    expect(botMessage.parentElement).toHaveStyle({ justifyContent: 'flex-start' });
  });

  it('maintains scroll position on new messages', () => {
    const mockRef = { current: { scrollIntoView: vi.fn() } };
    render(<ChatInterface {...mockProps} messagesEndRef={mockRef} />);
    
    expect(mockRef.current.scrollIntoView).toHaveBeenCalled();
  });

  it('handles empty message list', () => {
    render(<ChatInterface {...mockProps} messages={[]} />);
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('handles messages without context', () => {
    const messagesWithoutContext = [
      { text: 'Hello', sender: 'user' },
      { text: 'Hi', sender: 'bot' }
    ];
    
    render(<ChatInterface {...mockProps} messages={messagesWithoutContext} />);
    expect(screen.queryByText('Show source')).not.toBeInTheDocument();
  });
});
