import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { messagingAPI, messagingRealtime } from '../../lib/messaging';
import './Messages.css';
import NewChatModal from './NewChatModal';

const Messages = ({ user }) => {
  // State
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
  const [isMobile, setIsMobile] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [page, setPage] = useState(0);
  
  // Refs
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isLoadingRef = useRef(false);
  const pageRef = useRef(0);

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setShowChat(true); // Always show chat on desktop
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!user?.id || isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setLoadingConversations(true);
    
    try {
      const data = await messagingAPI.getUserConversations(user.id);
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
    
    console.log('📤 Sending message:', { content, conversation: activeConversation.id });
    setSendingMessage(true);
    
    try {
      const sentMessage = await messagingAPI.sendMessage(
        activeConversation.id,
        user.id,
        content
      );
      
      console.log('✅ Message sent successfully');
      
      // Clear typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
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

  // Handle conversation select
  const handleSelectConversation = async (conversation) => {
    console.log('💬 Selecting conversation:', conversation.id);
    setActiveConversation(conversation);
    if (isMobile) {
      setShowChat(true);
    }
    setPage(0);
    pageRef.current = 0;
    setMessages([]);
    setHasMoreMessages(true);
    await loadMessages(true);
  };

  // Handle back to conversations (mobile)
  const handleBackToConversations = () => {
    setShowChat(false);
    setActiveConversation(null);
  };

  // Handle typing indicator
  const handleTyping = useCallback(async (isTyping) => {
    if (!activeConversation || !user?.id) return;
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        // Auto-clear typing after 3 seconds
      }, 3000);
    }
  }, [activeConversation?.id, user?.id]);

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
            await messagingAPI.markAsRead(activeConversation.id, user.id);
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

  // Load initial data
  useEffect(() => {
    if (!user?.id) {
      console.log('👤 No user, skipping load');
      return;
    }
    
    console.log('🚀 Initializing messages for user:', user.id);
    loadConversations();
    
    // Subscribe to user's conversations updates
    const subscription = supabase
      .channel(`user-${user.id}-conversations`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          // Check if this message is for a conversation we're in
          const { data: isParticipant } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('conversation_id', payload.new.conversation_id)
            .eq('user_id', user.id)
            .single();
          
          if (isParticipant) {
            setTimeout(() => loadConversations(), 500);
          }
        }
      )
      .subscribe();
    
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
      // Try to get other participant's name
      if (conversation.participants && conversation.participants.length > 0) {
        const otherParticipant = conversation.participants.find(p => 
          p.id !== user?.id && !p.isCurrentUser
        );
        if (otherParticipant) {
          return `${otherParticipant.firstname || ''} ${otherParticipant.surname || ''}`.trim() || 'User';
        }
      }
      return 'Chat';
    }
  };

  const getAvatar = (conversation) => {
    if (conversation.is_group) {
      return conversation.group_photo_url || null;
    } else {
      if (conversation.participants && conversation.participants.length > 0) {
        const otherParticipant = conversation.participants.find(p => 
          p.id !== user?.id && !p.isCurrentUser
        );
        return otherParticipant?.profile_picture_url || null;
      }
      return null;
    }
  };

  const getAvatarFallback = (conversation) => {
    if (conversation.is_group) {
      return '👥';
    } else {
      if (conversation.participants && conversation.participants.length > 0) {
        const otherParticipant = conversation.participants.find(p => 
          p.id !== user?.id && !p.isCurrentUser
        );
        if (otherParticipant) {
          const initials = `${otherParticipant.firstname?.[0] || ''}${otherParticipant.surname?.[0] || ''}`.toUpperCase();
          return initials || '👤';
        }
      }
      return '👤';
    }
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = getConversationName(conv).toLowerCase();
    return name.includes(query);
  });

  const getTypingNames = () => {
    if (typingUsers.length === 0) return '';
    if (!activeConversation) return '';
    return 'Someone is typing...';
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
      {/* Left sidebar - Hidden on mobile when chat is open */}
      <div className={`conversations-sidebar ${isMobile && showChat ? 'mobile-hidden' : ''}`}>
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

      {/* Main chat area - Hidden on mobile when no conversation selected */}
      <div className={`chat-main ${isMobile && !showChat ? 'mobile-hidden' : ''}`}>
        {activeConversation ? (
          <>
            {/* Chat Header with Back Button on Mobile */}
            <div className="chat-header">
              {isMobile && (
                <button 
                  className="back-to-conversations"
                  onClick={handleBackToConversations}
                  title="Back to conversations"
                >
                  ←
                </button>
              )}
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
            </div>

            {/* Messages Container */}
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

            {/* Message Input */}
            <MessageInput 
              onSendMessage={handleSendMessage}
              sendingMessage={sendingMessage}
              onTyping={handleTyping}
            />
          </>
        ) : (
          <NoConversationSelected onStartChat={() => setShowNewChatModal(true)} />
        )}
      </div>

      {/* New Chat Modal - Simple version for now */}
      {showNewChatModal && (
  <NewChatModal
    user={user}
    onClose={() => setShowNewChatModal(false)}
    onConversationCreated={async (conversationId) => {
      // Close modal
      setShowNewChatModal(false);
      
      // Reload conversations
      await loadConversations();
      
      // Find and select the new conversation
      const newConversation = conversations.find(c => c.id === conversationId);
      if (newConversation) {
        await handleSelectConversation(newConversation);
      }
    }}
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

  return (
    <div className={`message-wrapper ${isOwn ? 'own-message' : 'other-message'} ${prevSameSender ? 'same-sender-prev' : ''} ${nextSameSender ? 'same-sender-next' : ''}`}>
      {!isOwn && showAvatar && (
        <div className="message-avatar">
          <div className="avatar-fallback">
            {message.users?.firstname?.[0] || '👤'}
          </div>
        </div>
      )}
      
      <div className="message-content-wrapper">
        {!isOwn && showAvatar && (
          <div className="message-sender">
            {message.users?.firstname || 'User'} {message.users?.surname || ''}
          </div>
        )}
        
        <div className="message-bubble">
          <p className="message-text">{message.content}</p>
          <div className="message-meta">
            <span className="message-time">{formatMessageTime(message.created_at)}</span>
            {isOwn && (
              <span className="message-status">
                ✓
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!message.trim() || sendingMessage) return;

    try {
      await onSendMessage(message);
      setMessage('');
      
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
      <form className="message-input-form" onSubmit={handleSubmit}>
        <div className="input-actions">
          <button 
            type="button"
            className="action-btn"
            onClick={() => alert('File upload coming soon!')}
            title="Attach file"
            disabled={sendingMessage}
          >
            📎
          </button>
        </div>

        <div className="message-input-wrapper">
          <input
            type="text"
            className="message-input"
            placeholder="Type a message..."
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            disabled={sendingMessage}
          />
          
          <button 
            type="submit" 
            className="send-btn"
            disabled={!message.trim() || sendingMessage}
          >
            {sendingMessage ? (
              <div className="sending-spinner"></div>
            ) : message.trim() ? (
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