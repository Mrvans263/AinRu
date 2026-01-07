import React, { useState, useEffect, useCallback } from 'react';
import { messagingAPI } from '../../lib/messaging';
import './NewChatModal.css';

const NewChatModal = ({ user, onClose, onConversationCreated }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Search users with debounce
  const searchUsers = useCallback(async () => {
    if (!user?.id || searchQuery.length < 2) {
      setUsers([]);
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const data = await messagingAPI.searchUsersToMessage(user.id, searchQuery);
      setUsers(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
      setError('Failed to search users. Please try again.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, searchQuery]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchUsers]);

  // Handle user selection
  const handleUserSelect = (user) => {
    setSelectedUser(user);
  };

  // Start new conversation
  const handleStartConversation = async () => {
    if (!selectedUser || !user?.id || creating) return;
    
    setCreating(true);
    setError('');
    
    try {
      // First check if conversation already exists
      const existingConvId = await messagingAPI.checkExistingConversation(user.id, selectedUser.id);
      
      if (existingConvId) {
        onConversationCreated(existingConvId);
        onClose();
        return;
      }
      
      // Create new conversation
      const conversationId = await messagingAPI.getOrCreateConversation(
        user.id,
        selectedUser.id
      );
      
      // Add welcome message
      await messagingAPI.sendMessage(
        conversationId,
        user.id,
        `Hi ${selectedUser.firstname}! 👋`
      );
      
      onConversationCreated(conversationId);
      onClose();
      
    } catch (error) {
      console.error('Error starting conversation:', error);
      setError('Failed to start conversation. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('');
    setUsers([]);
    setSelectedUser(null);
    setError('');
  };

  return (
    <div className="new-chat-modal-overlay" onClick={onClose}>
      <div className="new-chat-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="new-chat-modal-header">
          <h2>New Message</h2>
          <button className="new-chat-close-btn" onClick={onClose}>×</button>
        </div>
        
        {/* Search */}
        <div className="new-chat-search">
          <div className="search-input-wrapper">
            <input
              type="text"
              className="new-chat-search-input"
              placeholder="Search by name, email, or university..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button 
                className="clear-search-btn"
                onClick={handleClearSearch}
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>
          {searchQuery.length > 0 && searchQuery.length < 2 && (
            <div className="search-hint">
              Type at least 2 characters to search
            </div>
          )}
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="new-chat-error">
            {error}
          </div>
        )}
        
        {/* Loading State */}
        {loading && (
          <div className="new-chat-loading">
            <div className="loading-spinner"></div>
            <p>Searching users...</p>
          </div>
        )}
        
        {/* User List */}
        <div className="new-chat-users-list">
          {!loading && searchQuery.length >= 2 && users.length === 0 ? (
            <div className="no-users-found">
              <p>No users found for "{searchQuery}"</p>
            </div>
          ) : (
            users.map((userItem) => (
              <div
                key={userItem.id}
                className={`new-chat-user-item ${selectedUser?.id === userItem.id ? 'selected' : ''}`}
                onClick={() => handleUserSelect(userItem)}
              >
                <div className="new-chat-user-avatar">
                  {userItem.profile_picture_url ? (
                    <img 
                      src={userItem.profile_picture_url} 
                      alt={userItem.firstname}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        const fallback = e.target.parentElement.querySelector('.avatar-fallback');
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="avatar-fallback">
                    {`${userItem.firstname?.[0] || ''}${userItem.surname?.[0] || ''}`.toUpperCase() || '👤'}
                  </div>
                </div>
                
                <div className="new-chat-user-info">
                  <h4 className="new-chat-user-name">
                    {userItem.firstname} {userItem.surname || ''}
                  </h4>
                  <p className="new-chat-user-email">{userItem.email}</p>
                  {(userItem.university || userItem.city) && (
                    <div className="new-chat-user-details">
                      {userItem.university && (
                        <span className="new-chat-user-university">
                          🎓 {userItem.university}
                        </span>
                      )}
                      {userItem.city && (
                        <span className="new-chat-user-city">
                          📍 {userItem.city}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                <button 
                  className={`new-chat-select-btn ${selectedUser?.id === userItem.id ? 'selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUserSelect(userItem);
                  }}
                >
                  {selectedUser?.id === userItem.id ? '✓ Selected' : 'Select'}
                </button>
              </div>
            ))
          )}
        </div>
        
        {/* Selected User Preview */}
        {selectedUser && (
          <div className="selected-user-preview">
            <div className="preview-header">
              <h4>Start conversation with:</h4>
            </div>
            <div className="preview-user">
              <div className="preview-avatar">
                {`${selectedUser.firstname?.[0] || ''}${selectedUser.surname?.[0] || ''}`.toUpperCase() || '👤'}
              </div>
              <div className="preview-info">
                <h5>{selectedUser.firstname} {selectedUser.surname}</h5>
                <p>{selectedUser.email}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className="new-chat-actions">
          <button 
            className="new-chat-cancel-btn"
            onClick={onClose}
            disabled={creating}
          >
            Cancel
          </button>
          <button 
            className="new-chat-start-btn"
            onClick={handleStartConversation}
            disabled={!selectedUser || creating}
          >
            {creating ? (
              <>
                <div className="sending-spinner"></div>
                Starting...
              </>
            ) : (
              'Start Conversation'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewChatModal;