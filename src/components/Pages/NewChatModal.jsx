import React, { useState, useEffect } from 'react';
import { messagingAPI } from '../../lib/messaging';
import './NewChatModal.css';

const NewChatModal = ({ user, onClose, onConversationCreated }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState('users'); // 'users' or 'group'

  // Load users when search changes
  useEffect(() => {
    const loadUsers = async () => {
      if (!user?.id) return;
      
      setLoading(true);
      try {
        const data = await messagingAPI.findUsersToChat(user.id, searchQuery, 20);
        setUsers(data);
      } catch (error) {
        console.error('Error loading users:', error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(loadUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [user?.id, searchQuery]);

  // Handle user selection
  const toggleUserSelection = (user) => {
    if (selectedUsers.some(u => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  // Start 1-on-1 chat
  const startOneOnOneChat = async (otherUser) => {
    if (creating || !user?.id) return;
    
    setCreating(true);
    try {
      const conversationId = await messagingAPI.getOrCreateConversation(
        user.id,
        otherUser.id
      );
      
      onConversationCreated(conversationId);
      onClose();
    } catch (error) {
      console.error('Error starting chat:', error);
      alert('Failed to start chat. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  // Create group chat
  const createGroupChat = async () => {
    if (creating || !user?.id || selectedUsers.length < 2) return;
    
    setCreating(true);
    try {
      const conversationId = await messagingAPI.createGroupChat(
        user.id,
        selectedUsers.map(u => u.id),
        groupName || undefined
      );
      
      onConversationCreated(conversationId);
      onClose();
    } catch (error) {
      console.error('Error creating group chat:', error);
      alert('Failed to create group chat. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New Chat</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          <button 
            className={`tab-btn ${tab === 'users' ? 'active' : ''}`}
            onClick={() => setTab('users')}
          >
            👤 Direct Message
          </button>
          <button 
            className={`tab-btn ${tab === 'group' ? 'active' : ''}`}
            onClick={() => setTab('group')}
          >
            👥 Group Chat
          </button>
        </div>

        {/* Search */}
        <div className="search-section">
          <input
            type="text"
            className="search-input"
            placeholder="Search by name, email, or university..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {tab === 'users' ? (
          /* 1-on-1 Chat Tab */
          <div className="users-list">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="empty-state">
                <p>No users found</p>
              </div>
            ) : (
              users.map(userItem => (
                <div 
                  key={userItem.id}
                  className={`user-item ${userItem.is_already_in_conversation ? 'has-conversation' : ''}`}
                  onClick={() => startOneOnOneChat(userItem)}
                >
                  <div className="user-avatar">
                    {userItem.profile_picture_url ? (
                      <img src={userItem.profile_picture_url} alt={userItem.firstname} />
                    ) : (
                      <div className="avatar-fallback">
                        {`${userItem.firstname?.[0] || ''}${userItem.surname?.[0] || ''}`.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="user-info">
                    <h4>{userItem.firstname} {userItem.surname}</h4>
                    <p>{userItem.email}</p>
                    {userItem.university && (
                      <small className="university">{userItem.university}</small>
                    )}
                  </div>
                  {userItem.is_already_in_conversation && (
                    <span className="existing-badge">Existing Chat</span>
                  )}
                  <button 
                    className="message-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      startOneOnOneChat(userItem);
                    }}
                    disabled={creating}
                  >
                    Message
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Group Chat Tab */
          <div className="group-chat-section">
            {/* Selected Users */}
            {selectedUsers.length > 0 && (
              <div className="selected-users">
                <h4>Selected ({selectedUsers.length})</h4>
                <div className="selected-list">
                  {selectedUsers.map(userItem => (
                    <div key={userItem.id} className="selected-user">
                      <span>
                        {userItem.firstname} {userItem.surname}
                      </span>
                      <button 
                        className="remove-btn"
                        onClick={() => toggleUserSelection(userItem)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                
                {/* Group Name Input */}
                {selectedUsers.length >= 2 && (
                  <div className="group-name-input">
                    <label>Group Name (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g., Study Group, Project Team"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Available Users */}
            <div className="available-users">
              <h4>Select Participants (min 2)</h4>
              {loading ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>Loading users...</p>
                </div>
              ) : users.length === 0 ? (
                <div className="empty-state">
                  <p>No users found</p>
                </div>
              ) : (
                <div className="selectable-users">
                  {users.map(userItem => (
                    <div 
                      key={userItem.id}
                      className={`selectable-user ${selectedUsers.some(u => u.id === userItem.id) ? 'selected' : ''}`}
                      onClick={() => toggleUserSelection(userItem)}
                    >
                      <div className="user-avatar small">
                        {userItem.profile_picture_url ? (
                          <img src={userItem.profile_picture_url} alt={userItem.firstname} />
                        ) : (
                          <div className="avatar-fallback">
                            {`${userItem.firstname?.[0] || ''}${userItem.surname?.[0] || ''}`.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="user-info">
                        <span className="user-name">
                          {userItem.firstname} {userItem.surname}
                        </span>
                        <small className="user-email">{userItem.email}</small>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedUsers.some(u => u.id === userItem.id)}
                        onChange={() => toggleUserSelection(userItem)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create Button */}
            <div className="modal-actions">
              <button 
                className="btn-cancel"
                onClick={onClose}
                disabled={creating}
              >
                Cancel
              </button>
              <button 
                className="btn-create"
                onClick={createGroupChat}
                disabled={creating || selectedUsers.length < 2}
              >
                {creating ? (
                  <>
                    <div className="sending-spinner"></div>
                    Creating...
                  </>
                ) : (
                  `Create Group (${selectedUsers.length})`
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewChatModal;