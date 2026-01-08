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
  const [messageInput, setMessageInput] = useState('');
  const [viewportHeight, setViewportHeight] = useState('100vh');
  
  // Refs
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isLoadingRef = useRef(false);
  const pageRef = useRef(0);
  const loadedMessageIdsRef = useRef(new Set());
  const scrollPositionRef = useRef(null);
  const prevConversationIdRef = useRef(null);
  const inputRef = useRef(null);

  // Fix mobile viewport height
  useEffect(() => {
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      setViewportHeight('calc(var(--vh, 1vh) * 100)');
    };
    
    setVh();
    
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setShowChat(true);
      setVh();
    };
    
    checkMobile();
    
    window.addEventListener('resize', checkMobile);
    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', setVh);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('resize', setVh);
      window.removeEventListener('orientationchange', setVh);
    };
  }, []);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!user?.id || isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setLoadingConversations(true);
    
    try {
      const data = await messagingAPI.getUserConversations(user.id);
      setConversations(data || []);
      
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
  const loadMessages = useCallback(async (conversationId, reset = false) => {
    if (!conversationId || isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setLoadingMessages(true);
    
    const currentPage = reset ? 0 : pageRef.current;
    
    try {
      const newMessages = await messagingAPI.getConversationMessages(
        conversationId,
        currentPage,
        50
      );
      
      if (reset) {
        loadedMessageIdsRef.current.clear();
        const uniqueMessages = removeDuplicateMessages(newMessages || []);
        setMessages(uniqueMessages);
        pageRef.current = 0;
        setHasMoreMessages(uniqueMessages.length === 50);
        
        if (user?.id) {
          await messagingAPI.markAsRead(conversationId, user.id);
          setConversations(prev => 
            prev.map(conv => 
              conv.id === conversationId 
                ? { ...conv, unread_count: 0 }
                : conv
            )
          );
          loadConversations();
        }
      } else {
        const uniqueNewMessages = (newMessages || []).filter(
          msg => !loadedMessageIdsRef.current.has(msg.id)
        );
        
        if (uniqueNewMessages.length > 0) {
          if (messagesContainerRef.current) {
            const container = messagesContainerRef.current;
            const previousHeight = container.scrollHeight;
            scrollPositionRef.current = { previousHeight, scrollTop: container.scrollTop };
          }
          
          const deduplicatedMessages = removeDuplicateMessages(uniqueNewMessages);
          setMessages(prev => [...deduplicatedMessages, ...prev]);
          setHasMoreMessages(deduplicatedMessages.length === 50);
          deduplicatedMessages.forEach(msg => loadedMessageIdsRef.current.add(msg.id));
        } else {
          setHasMoreMessages(false);
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
      isLoadingRef.current = false;
    }
  }, [user?.id, loadConversations]);

  // Helper function to remove duplicate messages
  const removeDuplicateMessages = useCallback((messagesArray) => {
    const seen = new Set();
    return messagesArray.filter(message => {
      if (!message || !message.id) return false;
      const duplicate = seen.has(message.id);
      seen.add(message.id);
      return !duplicate;
    });
  }, []);

  // Restore scroll position
  useEffect(() => {
    if (scrollPositionRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const { previousHeight, scrollTop } = scrollPositionRef.current;
      const newHeight = container.scrollHeight;
      
      const heightDifference = newHeight - previousHeight;
      container.scrollTop = scrollTop + heightDifference;
      scrollPositionRef.current = null;
    }
  }, [messages]);

  // Load more messages
  const loadMoreMessages = useCallback(async () => {
    if (!hasMoreMessages || isLoadingRef.current || !activeConversation) return;
    
    pageRef.current += 1;
    await loadMessages(activeConversation.id, false);
  }, [hasMoreMessages, activeConversation, loadMessages]);

  // Handle scroll for infinite loading
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current || isLoadingRef.current || !hasMoreMessages || loadingMessages) return;
    
    const container = messagesContainerRef.current;
    const scrollTop = container.scrollTop;
    
    if (scrollTop < 200) {
      loadMoreMessages();
    }
  }, [hasMoreMessages, loadingMessages, loadMoreMessages]);

  // Send message function
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
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      setMessages(prev => {
        if (prev.some(msg => msg.id === sentMessage.id)) {
          return prev;
        }
        return [...prev, sentMessage];
      });
      
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

  // Handle conversation select
  const handleSelectConversation = useCallback(async (conversation) => {
    if (!conversation) return;
    
    const prevId = prevConversationIdRef.current;
    prevConversationIdRef.current = conversation.id;
    
    if (prevId === conversation.id) {
      await loadMessages(conversation.id, true);
      return;
    }
    
    setMessages([]);
    setActiveConversation(conversation);
    
    if (isMobile) {
      setShowChat(true);
    }
    
    pageRef.current = 0;
    loadedMessageIdsRef.current.clear();
    await loadMessages(conversation.id, true);
  }, [isMobile, loadMessages]);

  // Handle back to conversations (mobile)
  const handleBackToConversations = () => {
    setShowChat(false);
    setActiveConversation(null);
    setMessages([]);
    prevConversationIdRef.current = null;
  };

  // Handle typing indicator
  const handleTyping = useCallback((isTyping) => {
    if (!activeConversation || !user?.id) return;
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [activeConversation?.id, user?.id]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!activeConversation?.id || !user?.id) return;
    
    let subscription;
    
    const setupSubscription = async () => {
      subscription = messagingRealtime.subscribeToConversation(
        activeConversation.id,
        async (event, data) => {
          if (event === 'message') {
            if (!loadedMessageIdsRef.current.has(data.id)) {
              loadedMessageIdsRef.current.add(data.id);
              
              if (data.conversation_id === activeConversation.id) {
                setMessages(prev => {
                  if (prev.some(msg => msg.id === data.id)) {
                    return prev;
                  }
                  return [...prev, data];
                });
                
                if (data.sender_id !== user.id) {
                  await messagingAPI.markAsRead(activeConversation.id, user.id);
                  setConversations(prev => 
                    prev.map(conv => 
                      conv.id === activeConversation.id 
                        ? { ...conv, unread_count: 0 }
                        : conv
                    )
                  );
                }
                
                setTimeout(() => loadConversations(), 100);
              }
            }
          } else if (event === 'typing') {
            if (data.user_id !== user.id) {
              if (data.is_typing) {
                setTypingUsers(prev => [...prev, { id: data.user_id, name: 'Someone' }]);
                typingTimeoutRef.current = setTimeout(() => {
                  setTypingUsers(prev => prev.filter(u => u.id !== data.user_id));
                }, 3000);
              } else {
                setTypingUsers(prev => prev.filter(u => u.id !== data.user_id));
              }
            }
          }
        }
      );
    };
    
    setupSubscription();
    
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (subscription) {
        messagingRealtime.unsubscribeFromConversation(activeConversation.id);
      }
    };
  }, [activeConversation?.id, user?.id, loadConversations]);

  // Load initial conversations
  useEffect(() => {
    if (!user?.id) return;
    
    loadConversations();
    
    const channel = supabase
      .channel(`user-${user.id}-messages`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadConversations]);

  // Add scroll listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.sender_id === user?.id) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [messages, user?.id]);

  // Helper functions
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

  const getAvatarUrl = (conversation) => {
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
    
    if (activeConversation.is_group) {
      return `${typingUsers.length} ${typingUsers.length === 1 ? 'person is' : 'people are'} typing...`;
    }
    return 'Typing...';
  };

  // Handle message submit
  const handleMessageSubmit = async (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    
    await handleSendMessage(messageInput);
    setMessageInput('');
  };

  // Loading state
  if (loadingConversations && conversations.length === 0) {
    return (
      <div className="messages-container loading">
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Loading your conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="messages-container" style={{ height: viewportHeight }}>
      {/* Conversations Sidebar */}
      <div className={`conversations-sidebar ${isMobile && showChat ? 'mobile-hidden' : ''}`}>
        <div className="sidebar-header">
          <div className="header-content">
            <h2>Messages</h2>
            {unreadCount > 0 && (
              <span className="unread-badge-global">{unreadCount}</span>
            )}
          </div>
          <button 
            className="new-chat-btn"
            onClick={() => setShowNewChatModal(true)}
            title="New chat"
            aria-label="New chat"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
        
        <div className="search-box">
          <div className="search-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button 
              className="clear-search"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="conversations-list">
          {filteredConversations.length === 0 ? (
            <div className="empty-conversations">
              <div className="empty-icon">💬</div>
              <p>No conversations yet</p>
              <button 
                className="start-chat-btn"
                onClick={() => setShowNewChatModal(true)}
              >
                Start a conversation
              </button>
            </div>
          ) : (
            filteredConversations.map(conversation => (
              <div
                key={conversation.id}
                className={`conversation-card ${activeConversation?.id === conversation.id ? 'active' : ''}`}
                onClick={() => handleSelectConversation(conversation)}
              >
                <div className="conversation-avatar">
                  <div className="avatar-wrapper">
                    {getAvatarUrl(conversation) ? (
                      <img 
                        src={getAvatarUrl(conversation)} 
                        alt={getConversationName(conversation)}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className="avatar-fallback">
                      {getAvatarFallback(conversation)}
                    </div>
                  </div>
                  {conversation.unread_count > 0 && (
                    <span className="unread-indicator">{conversation.unread_count}</span>
                  )}
                </div>

                <div className="conversation-info">
                  <div className="conversation-header">
                    <h3 className="conversation-name">
                      {getConversationName(conversation)}
                      {conversation.is_group && <span className="group-indicator">👥</span>}
                    </h3>
                    <span className="conversation-time">
                      {formatTime(conversation.last_message_at)}
                    </span>
                  </div>
                  
                  <div className="conversation-preview">
                    <p className="preview-text">
                      {conversation.last_message_preview || 'Start a conversation'}
                    </p>
                    {conversation.unread_count > 0 && (
                      <span className="message-count">{conversation.unread_count}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`chat-area ${isMobile && !showChat ? 'mobile-hidden' : ''}`}>
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              {isMobile && (
                <button 
                  className="back-btn"
                  onClick={handleBackToConversations}
                  title="Back to conversations"
                  aria-label="Back to conversations"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              )}
              
              <div className="chat-user">
                <div className="chat-avatar">
                  <div className="avatar-wrapper">
                    {getAvatarUrl(activeConversation) ? (
                      <img 
                        src={getAvatarUrl(activeConversation)} 
                        alt={getConversationName(activeConversation)}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className="avatar-fallback">
                      {getAvatarFallback(activeConversation)}
                    </div>
                  </div>
                </div>
                <div className="chat-user-info">
                  <h3 className="chat-user-name">
                    {getConversationName(activeConversation)}
                    {activeConversation.is_group && (
                      <span className="group-badge">Group</span>
                    )}
                  </h3>
                  <p className="chat-status">
                    {typingUsers.length > 0 ? (
                      <span className="typing-indicator-text">{getTypingNames()}</span>
                    ) : (
                      <span>Active now</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages Container */}
            <div 
              className="messages-scroll-container" 
              ref={messagesContainerRef}
            >
              {loadingMessages && messages.length === 0 ? (
                <div className="loading-messages">
                  <div className="spinner"></div>
                  <p>Loading messages...</p>
                </div>
              ) : (
                <>
                  {hasMoreMessages && !loadingMessages && (
                    <div className="load-more-container">
                      <button 
                        className="load-more-btn"
                        onClick={loadMoreMessages}
                      >
                        Load older messages
                      </button>
                    </div>
                  )}
                  
                  {loadingMessages && messages.length > 0 && (
                    <div className="loading-more">
                      <div className="spinner small"></div>
                    </div>
                  )}

                  <div className="messages-list">
                    {messages.map((message, index) => {
                      const prevMessage = messages[index - 1];
                      const showDate = !prevMessage || 
                        new Date(message.created_at).toDateString() !== 
                        new Date(prevMessage.created_at).toDateString();
                      
                      const nextMessage = messages[index + 1];
                      const showAvatar = !nextMessage || 
                        nextMessage.sender_id !== message.sender_id;
                        
                      return (
                        <React.Fragment key={`${message.id}-${index}`}>
                          {showDate && (
                            <div className="date-divider">
                              <div className="date-line"></div>
                              <span className="date-text">
                                {new Date(message.created_at).toLocaleDateString([], { 
                                  weekday: 'long',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                              <div className="date-line"></div>
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
                      <div className="typing-bubble">
                        <div className="typing-dots">
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
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
            <form className="message-input-area" onSubmit={handleMessageSubmit}>
              <div className="input-wrapper">
                <input
                  ref={inputRef}
                  type="text"
                  className="message-input"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value);
                    handleTyping(e.target.value.length > 0);
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleMessageSubmit(e);
                    }
                  }}
                  disabled={sendingMessage}
                  aria-label="Type a message"
                />
                <button 
                  type="submit" 
                  className="send-button"
                  disabled={!messageInput.trim() || sendingMessage}
                  aria-label="Send message"
                >
                  {sendingMessage ? (
                    <div className="sending-spinner"></div>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="welcome-screen">
            <div className="welcome-content">
              <div className="welcome-icon">💬</div>
              <h2>Campus Messenger</h2>
              <p>Select a conversation from the sidebar or start a new one to begin chatting</p>
              <button 
                className="start-conversation-btn"
                onClick={() => setShowNewChatModal(true)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Conversation
              </button>
            </div>
          </div>
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
            
            const newConversation = conversations.find(c => c.id === conversationId);
            if (newConversation) {
              await handleSelectConversation(newConversation);
            } else {
              await loadConversations();
              const updatedConversations = await messagingAPI.getUserConversations(user.id);
              const foundConv = updatedConversations.find(c => c.id === conversationId);
              if (foundConv) {
                await handleSelectConversation(foundConv);
              }
            }
          }}
        />
      )}
    </div>
  );
};

// Message Bubble Component
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

  const getSenderName = () => {
    if (!message.users) return 'User';
    return `${message.users.firstname || ''} ${message.users.surname || ''}`.trim() || 'User';
  };

  const getAvatarFallbackText = () => {
    if (!message.users) return '👤';
    const first = message.users.firstname?.[0] || '';
    const last = message.users.surname?.[0] || '';
    return `${first}${last}`.toUpperCase() || '👤';
  };

  const getMessageStatus = () => {
    if (message.is_read) return '✓✓';
    return '✓';
  };

  return (
    <div className={`message-wrapper ${isOwn ? 'own' : 'other'}`}>
      {!isOwn && showAvatar && (
        <div className="message-avatar">
          <div className="avatar-wrapper small">
            {message.users?.profile_picture_url ? (
              <img 
                src={message.users.profile_picture_url} 
                alt={getSenderName()}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div className="avatar-fallback">
              {getAvatarFallbackText()}
            </div>
          </div>
        </div>
      )}
      
      <div className="message-content">
        {!isOwn && showAvatar && (
          <div className="message-sender-name">
            {getSenderName()}
          </div>
        )}
        
        <div className={`message-bubble ${isOwn ? 'own' : 'other'}`}>
          <div className="message-text">
            {message.content}
          </div>
          <div className="message-footer">
            <span className="message-time">
              {formatMessageTime(message.created_at)}
            </span>
            {isOwn && (
              <span className="message-status">
                {getMessageStatus()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Messages;