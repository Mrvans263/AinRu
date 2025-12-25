import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { messagingAPI, messagingRealtime } from '../../lib/messaging';
import NewChatModal from './NewChatModal';
import './Messages.css';

const Messages = ({ user }) => {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [page, setPage] = useState(0);
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isLoadingRef = useRef(false);
  const pageRef = useRef(0);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!user?.id || isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setLoadingConversations(true);
    
    try {
      const data = await messagingAPI.getUserConversations(user.id);
      console.log('📱 Conversations loaded:', data.length);
      setConversations(data);
      
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
      
      console.log('📱 Messages loaded:', newMessages.length);
      
      if (reset) {
        setMessages(newMessages);
        setPage(0);
        pageRef.current = 0;
        setHasMoreMessages(newMessages.length === 50);
      } else {
        setMessages(prev => [...newMessages, ...prev]);
        setHasMoreMessages(newMessages.length === 50);
      }
      
      // Mark as read
      if (reset && user?.id) {
        await messagingAPI.markAsRead(activeConversation.id, user.id);
        loadConversations();
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoadingMessages(false);
      isLoadingRef.current = false;
    }
  }, [activeConversation, user?.id, loadConversations]);

  // Load more messages
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

  // Send message function
  const handleSendMessage = async (content, file = null) => {
    if (!activeConversation || !user?.id || (!content.trim() && !file)) {
      console.log('❌ Cannot send: missing required data');
      return;
    }
    
    console.log('📤 Sending message:', { content, file, conversation: activeConversation.id });
    setSendingMessage(true);
    
    try {
      let fileData = null;
      
      if (file) {
        console.log('📎 Uploading file:', file.name);
        fileData = await messagingAPI.uploadFile(file, user.id);
      }
      
      const sentMessage = await messagingAPI.sendMessage(
        activeConversation.id,
        user.id,
        content,
        file ? (file.type.startsWith('image/') ? 'image' : 'file') : 'text',
        fileData
      );
      
      console.log('✅ Message sent successfully:', sentMessage);
      
      // Clear typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      await messagingRealtime.sendTypingIndicator(activeConversation.id, user.id, false);
      
      // Refresh conversations to update last message preview
      setTimeout(() => loadConversations(), 500);
      
      return sentMessage;
    } catch (error) {
      console.error('❌ Error sending message:', error);
      alert(`Failed to send message: ${error.message}`);
      throw error;
    } finally {
      setSendingMessage(false);
    }
  };

  // Handle conversation selection
  const handleSelectConversation = async (conversation) => {
    console.log('💬 Selecting conversation:', conversation.id);
    setActiveConversation(conversation);
    setPage(0);
    pageRef.current = 0;
    setMessages([]);
    setHasMoreMessages(true);
    await loadMessages(true);
  };

  // Handle new conversation created
  const handleConversationCreated = async (conversationId) => {
    // Refresh conversations
    await loadConversations();
    
    // Find and select the new conversation
    const newConversation = conversations.find(c => c.id === conversationId);
    if (newConversation) {
      await handleSelectConversation(newConversation);
    } else {
      // If not found in current list, wait a bit and try again
      setTimeout(async () => {
        await loadConversations();
        const refreshedConv = conversations.find(c => c.id === conversationId);
        if (refreshedConv) {
          await handleSelectConversation(refreshedConv);
        }
      }, 1000);
    }
  };

  // Subscribe to real-time updates
  useEffect(() => {
    if (!activeConversation?.id || !user?.id) return;
    
    console.log('🔔 Subscribing to conversation:', activeConversation.id);
    
    const subscription = messagingRealtime.subscribeToConversation(
      activeConversation.id,
      async (event, data) => {
        if (event === 'message') {
          console.log('📨 New real-time message:', data);
          setMessages(prev => [...prev, data]);
          
          if (data.sender_id !== user.id) {
            await messagingAPI.markAsRead(activeConversation.id, user.id, [data.id]);
          }
          
          setTimeout(() => loadConversations(), 100);
        }
      }
    );
    
    return () => {
      console.log('🔕 Unsubscribing from conversation:', activeConversation.id);
      messagingRealtime.unsubscribeFromConversation(activeConversation.id);
    };
  }, [activeConversation?.id, user?.id, loadConversations]);

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

  // Load initial data
  useEffect(() => {
    if (!user?.id) {
      console.log('👤 No user, skipping load');
      return;
    }
    
    console.log('🚀 Initializing messages for user:', user.id);
    loadConversations();
    
    const subscription = messagingRealtime.subscribeToUserConversations(
      user.id,
      () => {
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
      const container = messagesContainerRef.current;
      if (container) {
        const isNearBottom = 
          container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        
        if (isNearBottom) {
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      }
    }
  }, [messages]);

  // Helper functions
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

  // Loading state
  if (loadingConversations && conversations.length === 0) {
    return (
      <div className="messages-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading messages...</p>
          <small>You have {unreadCount} unread conversations</small>
        </div>
      </div>
    );
  }

  return (
    <div className="messages-container">
      {/* Left sidebar */}
      <div className="conversations-sidebar">
        <div className="sidebar-header">
          <h2>Messages {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}</h2>
          <button 
            className="new-chat-btn"
            onClick={() => setShowNewChatModal(true)}
            title="New chat"
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
              <button 
                className="start-chat-btn small"
                onClick={() => setShowNewChatModal(true)}
              >
                Start New Chat
              </button>
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
                <button className="chat-action-btn" title="Video call" onClick={() => alert('Video call coming soon!')}>
                  📹
                </button>
                <button className="chat-action-btn" title="Voice call" onClick={() => alert('Voice call coming soon!')}>
                  📞
                </button>
                <button className="chat-action-btn" title="More options" onClick={() => alert('More options coming soon!')}>
                  ⋯
                </button>
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
                          
                          <MessageBubble 
                            message={message}
                            isOwn={message.sender_id === user?.id}
                            showAvatar={showAvatar}
                            prevSameSender={prevMessage?.sender_id === message.sender_id}
                            nextSameSender={nextMessage?.sender_id === message.sender_id}
                          />
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
            <MessageInput 
              onSendMessage={handleSendMessage}
              sendingMessage={sendingMessage}
              onTyping={async (isTyping) => {
                if (!activeConversation || !user?.id) return;
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                
                if (isTyping) {
                  await messagingRealtime.sendTypingIndicator(activeConversation.id, user.id, true);
                  typingTimeoutRef.current = setTimeout(() => {
                    messagingRealtime.sendTypingIndicator(activeConversation.id, user.id, false);
                  }, 3000);
                } else {
                  await messagingRealtime.sendTypingIndicator(activeConversation.id, user.id, false);
                }
              }}
            />
          </>
        ) : (
          <NoConversationSelected onStartChat={() => setShowNewChatModal(true)} />
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <NewChatModal
          user={user}
          onClose={() => setShowNewChatModal(false)}
          onConversationCreated={handleConversationCreated}
        />
      )}
    </div>
  );
};

// Message Bubble Component
const MessageBubble = ({ message, isOwn, showAvatar, prevSameSender, nextSameSender }) => {
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

// Message Input Component
const MessageInput = ({ onSendMessage, sendingMessage, onTyping }) => {
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    
    // Trigger typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    onTyping(true);
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 3000);
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (selectedFile.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setFile(selectedFile);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if ((!message.trim() && !file) || sendingMessage) return;

    try {
      await onSendMessage(message, file);
      setMessage('');
      setFile(null);
      setFilePreview(null);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Clear typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      onTyping(false);
    } catch (error) {
      console.error('Error in handleSubmit:', error);
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
            disabled={sendingMessage}
          >
            📎
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.txt"
            style={{ display: 'none' }}
            disabled={sendingMessage}
          />
          
          <button 
            type="button" 
            className="action-btn" 
            title="Emoji"
            onClick={() => alert('Emoji picker coming soon!')}
            disabled={sendingMessage}
          >
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
            disabled={sendingMessage}
          />
          
          <button 
            type="submit" 
            className="send-btn"
            disabled={(!message.trim() && !file) || sendingMessage}
          >
            {sendingMessage ? (
              <div className="sending-spinner"></div>
            ) : message.trim() || file ? (
              'Send'
            ) : (
              '→'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

// No Conversation Selected Component
const NoConversationSelected = ({ onStartChat }) => (
  <div className="no-conversation-selected">
    <div className="welcome-message">
      <h3>💬 Campus Messenger</h3>
      <p>Select a conversation or start a new one to begin messaging</p>
      <button 
        className="start-chat-btn"
        onClick={onStartChat}
      >
        Start New Chat
      </button>
    </div>
  </div>
);

export default Messages;