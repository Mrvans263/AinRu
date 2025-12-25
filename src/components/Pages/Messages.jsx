import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { messagingAPI, messagingRealtime } from '../../lib/messaging';
import './Messages.css';

const Messages = ({ user }) => {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [page, setPage] = useState(0);
  const [typingUsers, setTypingUsers] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isLoadingRef = useRef(false);
  const pageRef = useRef(0);
  // Temporary debug - add this at the top of your Messages component
useEffect(() => {
  console.log('=== MESSAGES DEBUG ===');
  console.log('User ID:', user?.id);
  console.log('User Email:', user?.email);
  
  // Test the API directly
  if (user?.id) {
    console.log('Testing messagingAPI.getUserConversations...');
    messagingAPI.getUserConversations(user.id)
      .then(data => {
        console.log('✅ Conversations loaded:', data);
        console.log('First conversation:', data[0]);
        console.log('All conversations:', data);
      })
      .catch(error => {
        console.error('❌ Error loading conversations:', error);
      });
  }
}, [user]);

  // Load user's conversations (only once on mount or user change)
  const loadConversations = useCallback(async () => {
    if (!user?.id || isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setLoadingConversations(true);
    
    try {
      const data = await messagingAPI.getUserConversations(user.id);
      setConversations(data);
      
      // Calculate total unread count
      const totalUnread = data.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
      setUnreadCount(totalUnread);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoadingConversations(false);
      isLoadingRef.current = false;
    }
  }, [user?.id]);

  // Load messages for active conversation
  const loadMessages = useCallback(async (reset = false) => {
    if (!activeConversation || isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setLoadingMessages(true);
    
    const currentPage = reset ? 0 : pageRef.current;
    
    try {
      const newMessages = await messagingAPI.getConversationMessages(
        activeConversation.id,
        currentPage,
        50
      );
      
      if (reset) {
        setMessages(newMessages);
        setPage(0);
        pageRef.current = 0;
        setHasMoreMessages(newMessages.length === 50);
      } else {
        setMessages(prev => [...newMessages, ...prev]);
        setHasMoreMessages(newMessages.length === 50);
      }
      
      // Mark as read if it's a new load
      if (reset && user?.id) {
        await messagingAPI.markAsRead(activeConversation.id, user.id);
        // Refresh conversations to update unread count
        loadConversations();
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoadingMessages(false);
      isLoadingRef.current = false;
    }
  }, [activeConversation, user?.id, loadConversations]);

  // Load more messages (infinite scroll)
  const loadMoreMessages = useCallback(async () => {
    if (!hasMoreMessages || isLoadingRef.current) return;
    
    pageRef.current += 1;
    setPage(prev => prev + 1);
    await loadMessages(false);
  }, [hasMoreMessages, loadMessages]);

  // Handle scroll for infinite loading
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current || isLoadingRef.current || !hasMoreMessages) return;
    
    const container = messagesContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // Load more when scrolled near top
    if (scrollTop < 100 && hasMoreMessages && !loadingMessages) {
      loadMoreMessages();
    }
  }, [hasMoreMessages, loadingMessages, loadMoreMessages]);

  // Subscribe to conversation updates
  useEffect(() => {
    if (!activeConversation?.id || !user?.id) return;
    
    const subscription = messagingRealtime.subscribeToConversation(
      activeConversation.id,
      async (event, data) => {
        if (event === 'message') {
          // Add new message to the end
          setMessages(prev => [...prev, data]);
          
          // Mark as read if user is viewing
          if (data.sender_id !== user.id) {
            await messagingAPI.markAsRead(activeConversation.id, user.id, [data.id]);
          }
          
          // Update conversations list (but don't await to avoid blocking)
          setTimeout(() => loadConversations(), 100);
        }
      }
    );
    
    return () => {
      messagingRealtime.unsubscribeFromConversation(activeConversation.id);
    };
  }, [activeConversation?.id, user?.id]);

  // Subscribe to typing indicators
  useEffect(() => {
    if (!activeConversation?.id || !user?.id) return;
    
    const channel = supabase.channel(`presence:${activeConversation.id}`);
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const typing = [];
        
        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            if (presence.userId !== user.id && presence.isTyping) {
              typing.push(presence.userId);
            }
          });
        });
        
        setTypingUsers(typing);
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversation?.id, user?.id]);

  // Load initial conversations
  useEffect(() => {
    if (!user?.id) return;
    
    loadConversations();
    
    // Subscribe to new conversations
    const subscription = messagingRealtime.subscribeToUserConversations(
      user.id,
      () => {
        // Debounce conversation updates
        setTimeout(() => loadConversations(), 500);
      }
    );
    
    return () => {
      subscription?.unsubscribe();
    };
  }, [user?.id, loadConversations]);

  // Add scroll listener for infinite loading
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      // Only auto-scroll if user is near bottom
      const container = messagesContainerRef.current;
      if (container) {
        const isNearBottom = 
          container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        
        if (isNearBottom) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  }, [messages]);

  // Handle send message
  const handleSendMessage = async (content, file) => {
    if (!activeConversation || !user?.id || (!content.trim() && !file)) return;
    
    try {
      let fileData = null;
      
      if (file) {
        // Upload file to storage
        fileData = await messagingAPI.uploadFile(file, user.id);
      }
      
      await messagingAPI.sendMessage(
        activeConversation.id,
        user.id,
        content,
        file ? (file.type.startsWith('image/') ? 'image' : 'file') : 'text',
        fileData
      );
      
      // Clear typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      await messagingRealtime.sendTypingIndicator(activeConversation.id, user.id, false);
      
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    }
  };

  // Handle typing indicator
  const handleTyping = useCallback(async (isTyping) => {
    if (!activeConversation || !user?.id) return;
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (isTyping) {
      await messagingRealtime.sendTypingIndicator(activeConversation.id, user.id, true);
      
      // Auto-clear typing after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        messagingRealtime.sendTypingIndicator(activeConversation.id, user.id, false);
      }, 3000);
    } else {
      await messagingRealtime.sendTypingIndicator(activeConversation.id, user.id, false);
    }
  }, [activeConversation?.id, user?.id]);

  // Handle conversation select
  const handleSelectConversation = async (conversation) => {
    setActiveConversation(conversation);
    setPage(0);
    pageRef.current = 0;
    setMessages([]); // Clear previous messages immediately
    setHasMoreMessages(true);
    await loadMessages(true);
  };

  // Start new conversation
  const handleStartConversation = async (otherUserId) => {
    try {
      const conversationId = await messagingAPI.getOrCreateConversation(
        user.id,
        otherUserId
      );
      
      // Find or create conversation object
      let conversation = conversations.find(c => c.id === conversationId);
      
      if (!conversation) {
        conversation = {
          id: conversationId,
          is_group: false,
          participants: [],
          unread_count: 0,
          last_message_preview: 'Start a conversation...'
        };
        setConversations(prev => [conversation, ...prev]);
      }
      
      setActiveConversation(conversation);
      setPage(0);
      pageRef.current = 0;
      setMessages([]);
      setHasMoreMessages(true);
      await loadMessages(true);
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    
    if (conv.is_group) {
      return conv.group_name?.toLowerCase().includes(query);
    } else {
      const otherParticipant = conv.participants?.find(p => 
        p.id !== user?.id && !p.isCurrentUser
      );
      if (otherParticipant) {
        const fullName = `${otherParticipant.firstname || ''} ${otherParticipant.surname || ''}`.toLowerCase();
        return fullName.includes(query) || 
               otherParticipant.university?.toLowerCase().includes(query);
      }
    }
    return false;
  });

  // Format time for conversation preview
  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Get conversation display name
  const getConversationName = (conversation) => {
    if (conversation.is_group) {
      return conversation.group_name || 'Group Chat';
    } else {
      const otherParticipant = conversation.participants?.find(p => 
        p.id !== user?.id && !p.isCurrentUser
      );
      if (otherParticipant) {
        return `${otherParticipant.firstname || ''} ${otherParticipant.surname || ''}`.trim() || 'Unknown';
      }
      return 'Unknown';
    }
  };

  // Get conversation avatar
  const getAvatar = (conversation) => {
    if (conversation.is_group) {
      return conversation.group_photo_url || null;
    } else {
      const otherParticipant = conversation.participants?.find(p => 
        p.id !== user?.id && !p.isCurrentUser
      );
      return otherParticipant?.profile_picture_url || null;
    }
  };

  // Get avatar fallback text
  const getAvatarFallback = (conversation) => {
    if (conversation.is_group) {
      return '👥';
    } else {
      const otherParticipant = conversation.participants?.find(p => 
        p.id !== user?.id && !p.isCurrentUser
      );
      if (otherParticipant) {
        const initials = `${otherParticipant.firstname?.[0] || ''}${otherParticipant.surname?.[0] || ''}`.toUpperCase();
        return initials || '👤';
      }
      return '👤';
    }
  };

  // Render message bubble
  const renderMessageBubble = (message, isOwn, showAvatar, prevSameSender, nextSameSender) => {
    const formatMessageTime = (dateString) => {
      return new Date(dateString).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    };

    const renderMessageContent = () => {
      switch (message.message_type) {
        case 'image':
          return (
            <div className="message-image">
              <img 
                src={message.file_url} 
                alt={message.file_name || 'Image'} 
                onClick={() => window.open(message.file_url, '_blank')}
              />
              {message.content && <p className="image-caption">{message.content}</p>}
            </div>
          );
          
        case 'file':
          return (
            <div className="message-file">
              <div className="file-icon">📎</div>
              <div className="file-info">
                <a 
                  href={message.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="file-name"
                >
                  {message.file_name || 'File'}
                </a>
                <span className="file-size">
                  {(message.file_size / 1024).toFixed(1)} KB
                </span>
              </div>
              {message.content && <p className="file-message">{message.content}</p>}
            </div>
          );
          
        default:
          return <p className="message-text">{message.content}</p>;
      }
    };

    return (
      <div className={`message-wrapper ${isOwn ? 'own-message' : 'other-message'} ${prevSameSender ? 'same-sender-prev' : ''} ${nextSameSender ? 'same-sender-next' : ''}`}>
        {!isOwn && showAvatar && (
          <div className="message-avatar">
            {message.users?.profile_picture_url ? (
              <img 
                src={message.users.profile_picture_url} 
                alt={`${message.users.firstname} ${message.users.surname}`}
              />
            ) : (
              <div className="avatar-fallback">
                {`${message.users?.firstname?.[0] || ''}${message.users?.surname?.[0] || ''}`.toUpperCase() || '👤'}
              </div>
            )}
          </div>
        )}
        
        <div className="message-content-wrapper">
          {!isOwn && showAvatar && (
            <div className="message-sender">
              {message.users?.firstname} {message.users?.surname}
            </div>
          )}
          
          <div className={`message-bubble ${message.message_type}`}>
            {renderMessageContent()}
            <div className="message-meta">
              <span className="message-time">{formatMessageTime(message.created_at)}</span>
              {isOwn && (
                <span className="message-status">
                  {message.read_by?.length > 1 ? '✓✓' : '✓'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Get typing indicator text
  const getTypingNames = () => {
    if (typingUsers.length === 0) return '';
    
    if (!activeConversation) return '';
    
    const participants = activeConversation.participants?.filter(p => !p.isCurrentUser);
    const typingParticipants = participants?.filter(p => typingUsers.includes(p.id));
    
    if (!typingParticipants || typingParticipants.length === 0) {
      return 'Someone is typing...';
    }
    
    if (typingParticipants.length === 1) {
      return `${typingParticipants[0].firstname} is typing...`;
    }
    
    return 'Multiple people are typing...';
  };

  if (loadingConversations && conversations.length === 0) {
    return (
      <div className="messages-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="messages-container">
      {/* Left sidebar - Conversation list */}
      <div className="conversations-sidebar">
        <div className="sidebar-header">
          <h2>Messages {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}</h2>
          <button 
            className="new-chat-btn"
            onClick={() => {/* Implement new group chat */}}
            title="New group chat"
          >
            +
          </button>
        </div>
        
        <div className="conversation-search">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="conversation-items">
          {filteredConversations.length === 0 ? (
            <div className="no-conversations">
              <p>No conversations found</p>
            </div>
          ) : (
            filteredConversations.map(conversation => (
              <div
                key={conversation.id}
                className={`conversation-item ${activeConversation?.id === conversation.id ? 'active' : ''}`}
                onClick={() => handleSelectConversation(conversation)}
              >
                <div className="conversation-avatar">
                  {getAvatar(conversation) ? (
                    <img 
                      src={getAvatar(conversation)} 
                      alt={getConversationName(conversation)}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.style.display = 'none';
                        e.target.parentElement.querySelector('.avatar-fallback').style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="avatar-fallback">
                    {getAvatarFallback(conversation)}
                  </div>
                  {conversation.unread_count > 0 && (
                    <span className="unread-dot">{conversation.unread_count}</span>
                  )}
                </div>

                <div className="conversation-details">
                  <div className="conversation-header">
                    <h4 className="conversation-name">
                      {getConversationName(conversation)}
                      {conversation.is_group && <span className="group-badge">👥</span>}
                    </h4>
                    <span className="conversation-time">
                      {formatTime(conversation.last_message_at)}
                    </span>
                  </div>
                  
                  <p className="conversation-preview">
                    {conversation.last_message_preview || 'No messages yet'}
                  </p>
                  
                  {conversation.unread_count > 0 && (
                    <span className="unread-count">
                      {conversation.unread_count} new
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="chat-main">
        {activeConversation ? (
          <>
            {/* Chat header */}
            <div className="chat-header">
              <div className="chat-header-avatar">
                {activeConversation.is_group ? '👥' : '👤'}
              </div>
              <div className="chat-header-info">
                <h3 className="chat-title">{getConversationName(activeConversation)}</h3>
                <p className="chat-status">
                  {activeConversation.is_group 
                    ? `${activeConversation.participants?.length || 0} participants`
                    : 'Active recently'
                  }
                </p>
              </div>
              <div className="chat-header-actions">
                <button className="chat-action-btn" title="Video call">📹</button>
                <button className="chat-action-btn" title="Voice call">📞</button>
                <button className="chat-action-btn" title="More options">⋯</button>
              </div>
            </div>

            {/* Messages container */}
            <div className="messages-container-scroll" ref={messagesContainerRef}>
              {loadingMessages && messages.length === 0 ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>Loading messages...</p>
                </div>
              ) : (
                <>
                  {hasMoreMessages && !loadingMessages && (
                    <div className="load-more-indicator">
                      <button onClick={loadMoreMessages}>Load older messages</button>
                    </div>
                  )}
                  
                  {loadingMessages && messages.length > 0 && (
                    <div className="load-more-indicator">
                      <div className="loading-spinner small"></div>
                    </div>
                  )}

                  <div className="messages-list">
                    {messages.map((message, index) => {
                      const prevMessage = messages[index - 1];
                      const nextMessage = messages[index + 1];
                      
                      const showDate = !prevMessage || 
                        new Date(message.created_at).toDateString() !== 
                        new Date(prevMessage.created_at).toDateString();
                      
                      const showAvatar = !nextMessage || 
                        nextMessage.sender_id !== message.sender_id ||
                        new Date(nextMessage.created_at).getTime() - 
                        new Date(message.created_at).getTime() > 300000; // 5 minutes
                        
                      return (
                        <React.Fragment key={message.id}>
                          {showDate && (
                            <div className="message-date-divider">
                              <span>{new Date(message.created_at).toLocaleDateString([], { 
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}</span>
                            </div>
                          )}
                          
                          {renderMessageBubble(
                            message,
                            message.sender_id === user?.id,
                            showAvatar,
                            prevMessage?.sender_id === message.sender_id,
                            nextMessage?.sender_id === message.sender_id
                          )}
                        </React.Fragment>
                      );
                    })}
                    
                    {typingUsers.length > 0 && (
                      <div className="typing-indicator">
                        <div className="typing-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                        <span className="typing-text">{getTypingNames()}</span>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>
                </>
              )}
            </div>

            {/* Message input */}
            <MessageInputComponent 
              onSendMessage={handleSendMessage}
              onTyping={handleTyping}
            />
          </>
        ) : (
          <div className="no-conversation-selected">
            <div className="welcome-message">
              <h3>💬 Campus Messenger</h3>
              <p>Select a conversation or start a new one to begin messaging</p>
              <button 
                className="start-chat-btn"
                onClick={() => {/* Open new chat modal */}}
              >
                Start New Chat
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Message Input Component
const MessageInputComponent = ({ onSendMessage, onTyping }) => {
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      onTyping(true);
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      onTyping(false);
    }, 3000);
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    handleTyping();
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Validate file size (10MB max)
    if (selectedFile.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setFile(selectedFile);

    // Create preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!message.trim() && !file) return;

    onSendMessage(message, file);
    setMessage('');
    setFile(null);
    setFilePreview(null);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Clear typing indicator
    setIsTyping(false);
    onTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="message-input-container">
      {filePreview && (
        <div className="file-preview">
          <img src={filePreview} alt="Preview" />
          <button 
            type="button" 
            className="remove-preview-btn"
            onClick={handleRemoveFile}
          >
            ×
          </button>
        </div>
      )}
      
      {file && !filePreview && (
        <div className="file-preview">
          <div className="file-info">
            <span>📎 {file.name}</span>
            <button 
              type="button" 
              className="remove-preview-btn"
              onClick={handleRemoveFile}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <form className="message-input-form" onSubmit={handleSubmit}>
        <div className="input-actions">
          <button 
            type="button"
            className="action-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
          >
            📎
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.txt"
            style={{ display: 'none' }}
          />
          
          <button type="button" className="action-btn" title="Emoji">
            😊
          </button>
        </div>

        <div className="message-input-wrapper">
          <textarea
            className="message-input"
            placeholder="Type a message..."
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            rows="1"
          />
          
          <button 
            type="submit" 
            className="send-btn"
            disabled={!message.trim() && !file}
          >
            {message.trim() || file ? 'Send' : '→'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Messages;