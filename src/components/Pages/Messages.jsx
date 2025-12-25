// Replace the current Messages.js with this fixed version
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
      if (!mobile) setShowChat(true);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load conversations with proper error handling
  const loadConversations = useCallback(async () => {
    if (!user?.id || isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setLoadingConversations(true);
    
    try {
      const data = await messagingAPI.getUserConversations(user.id);
      setConversations(data || []);
      
      // Calculate total unread
      const totalUnread = (data || []).reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
      setUnreadCount(totalUnread);
    } catch (error) {
      console.error('Error loading conversations:', error);
      setConversations([]);
    } finally {
      setLoadingConversations(false);
      isLoadingRef.current = false;
    }
  }, [user?.id]);

  // Load messages for active conversation
  const loadMessages = useCallback(async (reset = false) => {
    if (!activeConversation?.id || isLoadingRef.current) return;
    
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
        setMessages(newMessages || []);
        setPage(0);
        pageRef.current = 0;
        setHasMoreMessages((newMessages || []).length === 50);
      } else {
        setMessages(prev => [...(newMessages || []), ...prev]);
        setHasMoreMessages((newMessages || []).length === 50);
      }
      
      // Mark as read
      if (reset && user?.id) {
        await messagingAPI.markAsRead(activeConversation.id, user.id);
        loadConversations();
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
      isLoadingRef.current = false;
    }
  }, [activeConversation?.id, user?.id, loadConversations]);

  // Load more messages
  const loadMoreMessages = useCallback(async () => {
    if (!hasMoreMessages || isLoadingRef.current || !activeConversation) return;
    
    pageRef.current += 1;
    setPage(prev => prev + 1);
    await loadMessages(false);
  }, [hasMoreMessages, loadMessages, activeConversation]);

  // Handle scroll for infinite loading - FIXED
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current || isLoadingRef.current || !hasMoreMessages || loadingMessages) return;
    
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const scrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;
    const scrollHeight = container.scrollHeight;
    
    // Check if we're near the top (for loading older messages)
    if (scrollTop < 100) {
      loadMoreMessages();
    }
  }, [hasMoreMessages, loadingMessages, loadMoreMessages]);

  // Send message function - FIXED
  const handleSendMessage = async (content) => {
    if (!activeConversation?.id || !user?.id || !content?.trim()) {
      console.log('Cannot send: missing required data');
      return null;
    }
    
    setSendingMessage(true);
    
    try {
      const sentMessage = await messagingAPI.sendMessage(
        activeConversation.id,
        user.id,
        content.trim()
      );
      
      // Clear typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Refresh conversations
      setTimeout(() => loadConversations(), 500);
      
      return sentMessage;
    } catch (error) {
      console.error('Error sending message:', error);
      alert(`Failed to send message: ${error.message}`);
      throw error;
    } finally {
      setSendingMessage(false);
    }
  };

  // Handle conversation select - FIXED
  const handleSelectConversation = async (conversation) => {
    if (!conversation) return;
    
    setActiveConversation(conversation);
    if (isMobile) {
      setShowChat(true);
    }
    setPage(0);
    pageRef.current = 0;
    await loadMessages(true);
  };

  // Handle back to conversations (mobile)
  const handleBackToConversations = () => {
    setShowChat(false);
    setActiveConversation(null);
    setMessages([]);
  };

  // Handle typing indicator - SIMPLIFIED
  const handleTyping = useCallback((isTyping) => {
    if (!activeConversation || !user?.id) return;
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        setTypingUsers([]);
      }, 3000);
    }
  }, [activeConversation?.id, user?.id]);

  // Subscribe to real-time updates - FIXED
  useEffect(() => {
    if (!activeConversation?.id || !user?.id) return;
    
    console.log('Subscribing to conversation:', activeConversation.id);
    
    const subscription = messagingRealtime.subscribeToConversation(
      activeConversation.id,
      async (event, data) => {
        if (event === 'message') {
          setMessages(prev => [...prev, data]);
          
          if (data.sender_id !== user.id) {
            await messagingAPI.markAsRead(activeConversation.id, user.id);
          }
          
          setTimeout(() => loadConversations(), 100);
        }
      }
    );
    
    return () => {
      if (subscription) {
        messagingRealtime.unsubscribeFromConversation(activeConversation.id);
      }
    };
  }, [activeConversation?.id, user?.id, loadConversations]);

  // Load initial data - FIXED
  useEffect(() => {
    if (!user?.id) return;
    
    loadConversations();
    
    // Subscribe to new messages
    const channel = supabase
      .channel(`user-${user.id}-messages`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=in.(${conversations.map(c => c.id).join(',')})`
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadConversations, conversations]);

  // Add scroll listener for infinite loading
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages]);

  // Helper functions - FIXED
  const formatTime = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (isNaN(date.getTime())) return '';
      
      if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays}d`;
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    } catch (error) {
      return '';
    }
  };

  const getConversationName = (conversation) => {
    if (!conversation) return 'Chat';
    
    if (conversation.is_group) {
      return conversation.group_name || 'Group Chat';
    } else {
      // Find other participant
      if (conversation.participants && Array.isArray(conversation.participants)) {
        const otherParticipant = conversation.participants.find(p => 
          p.id !== user?.id
        );
        if (otherParticipant) {
          return `${otherParticipant.firstname || ''} ${otherParticipant.surname || ''}`.trim() || 'User';
        }
      }
      return 'User';
    }
  };

  const getAvatar = (conversation) => {
    if (!conversation) return null;
    
    if (conversation.is_group) {
      return conversation.group_photo_url || null;
    } else {
      if (conversation.participants && Array.isArray(conversation.participants)) {
        const otherParticipant = conversation.participants.find(p => 
          p.id !== user?.id
        );
        return otherParticipant?.profile_picture_url || null;
      }
      return null;
    }
  };

  const getAvatarFallback = (conversation) => {
    if (!conversation) return '👤';
    
    if (conversation.is_group) {
      return '👥';
    } else {
      if (conversation.participants && Array.isArray(conversation.participants)) {
        const otherParticipant = conversation.participants.find(p => 
          p.id !== user?.id
        );
        if (otherParticipant) {
          const first = otherParticipant.firstname?.[0] || '';
          const last = otherParticipant.surname?.[0] || '';
          return `${first}${last}`.toUpperCase() || '👤';
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
    return 'Typing...';
  };

  // Loading state
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
      {/* Left sidebar */}
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
                        e.target.style.display = 'none';
                        const fallback = e.target.parentElement.querySelector('.avatar-fallback');
                        if (fallback) fallback.style.display = 'flex';
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
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className={`chat-main ${isMobile && !showChat ? 'mobile-hidden' : ''}`}>
        {activeConversation ? (
          <>
            {/* Chat Header */}
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
                {getAvatarFallback(activeConversation)}
              </div>
              <div className="chat-header-info">
                <h3 className="chat-title">{getConversationName(activeConversation)}</h3>
                <p className="chat-status">
                  {activeConversation.is_group 
                    ? `${activeConversation.participants?.length || 1} participants`
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
                        nextMessage.sender_id !== message.sender_id;
                        
                      return (
                        <React.Fragment key={message.id || index}>
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
                            user={user}
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

      {/* New Chat Modal */}
      {showNewChatModal && (
        <NewChatModal
          user={user}
          onClose={() => setShowNewChatModal(false)}
          onConversationCreated={async (conversationId) => {
            setShowNewChatModal(false);
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

// Message Bubble Component - FIXED
const MessageBubble = ({ message, isOwn, showAvatar, user }) => {
  const formatMessageTime = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      return '';
    }
  };

  // Get sender name
  const getSenderName = () => {
    if (!message.users) return 'User';
    return `${message.users.firstname || ''} ${message.users.surname || ''}`.trim() || 'User';
  };

  return (
    <div className={`message-wrapper ${isOwn ? 'own-message' : 'other-message'}`}>
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
            {getSenderName()}
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

// Message Input Component - FIXED
const MessageInput = ({ onSendMessage, sendingMessage, onTyping }) => {
  const [message, setMessage] = useState('');
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
      console.error('Error sending message:', error);
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
            ) : (
              'Send'
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