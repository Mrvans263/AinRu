import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import './AllStudents.css';

const AllStudents = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const [sortBy, setSortBy] = useState('recent');

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setUsers(data || []);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Filter and sort users with useMemo for performance
  const filteredUsers = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    
    return users
      .filter(user => {
        // Search filter
        const matchesSearch = 
          !searchTerm ||
          (user.firstname && user.firstname.toLowerCase().includes(searchLower)) ||
          (user.surname && user.surname.toLowerCase().includes(searchLower)) ||
          (user.email && user.email.toLowerCase().includes(searchLower)) ||
          (user.university && user.university.toLowerCase().includes(searchLower));

        // Student status filter
        const matchesStudentFilter = 
          filterBy === 'all' ||
          (filterBy === 'student' && user.is_student === true) ||
          (filterBy === 'non-student' && (!user.is_student || user.is_student === false));

        return matchesSearch && matchesStudentFilter;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name':
            const nameA = `${a.firstname || ''} ${a.surname || ''}`.toLowerCase();
            const nameB = `${b.firstname || ''} ${b.surname || ''}`.toLowerCase();
            return nameA.localeCompare(nameB);
          
          case 'recent':
            return new Date(b.created_at) - new Date(a.created_at);
          
          case 'university':
            const uniA = a.university || '';
            const uniB = b.university || '';
            return uniA.localeCompare(uniB);
          
          default:
            return 0;
        }
      });
  }, [users, searchTerm, filterBy, sortBy]);

  // Calculate stats
  const stats = useMemo(() => {
    const students = users.filter(u => u.is_student).length;
    const members = users.length - students;
    
    return { total: users.length, students, members };
  }, [users]);

  // Contact handler
  const handleContact = useCallback((type, value, name) => {
    if (!value) return;
    
    if (type === 'email') {
      window.location.href = `mailto:${value}`;
    } else if (type === 'phone') {
      if (window.confirm(`Call ${name || 'this member'} at ${value}?`)) {
        window.location.href = `tel:${value}`;
      }
    }
  }, []);

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get education badge
  const getEducationBadge = (education) => {
    if (!education) return null;
    
    const educationMap = {
      'Undergraduate': 'Undergrad',
      'Graduate': 'Graduate',
      'Postgraduate': 'Postgrad',
      'PhD': 'PhD',
      'Diploma': 'Diploma'
    };
    
    return educationMap[education] || education;
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="all-students-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="all-students-container">
      {/* Header with Stats */}
      <header className="page-header">
        <div>
          <h1>Community Members</h1>
          <p className="subtitle">Connect with {stats.total} members in our community</p>
        </div>
        
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">{stats.total}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.students}</div>
            <div className="stat-label">Students</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.members}</div>
            <div className="stat-label">Members</div>
          </div>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="filters-section">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search by name, email, university..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button 
              className="clear-btn"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="filter-controls">
          <div className="filter-group">
            <label>Filter:</label>
            <select 
              value={filterBy} 
              onChange={(e) => setFilterBy(e.target.value)}
              className="select-input"
            >
              <option value="all">All Members</option>
              <option value="student">Students Only</option>
              <option value="non-student">Non-Students</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Sort by:</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="select-input"
            >
              <option value="recent">Most Recent</option>
              <option value="name">Name (A-Z)</option>
              <option value="university">University</option>
            </select>
          </div>
        </div>

        <div className="results-info">
          <span className="results-count">
            Showing {filteredUsers.length} of {users.length} members
          </span>
        </div>
      </div>

      {/* Users Grid */}
      <main className="users-grid">
        {filteredUsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>No members found</h3>
            <p>Try adjusting your search or filters</p>
            <button 
              className="reset-btn"
              onClick={() => {
                setSearchTerm('');
                setFilterBy('all');
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div key={user.id} className="user-card">
              {/* User Header */}
              <div className="user-header">
                <div className="user-avatar">
                  {user.profile_picture_url ? (
                    <img 
                      src={user.profile_picture_url}
                      alt={`${user.firstname} ${user.surname}`}
                      className="avatar-img"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextElementSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="avatar-fallback">
                    {(user.firstname?.[0] || 'U').toUpperCase()}
                  </div>
                  <div className={`status-badge ${user.is_student ? 'student' : 'member'}`}>
                    {user.is_student ? '🎓' : '👤'}
                  </div>
                </div>

                <div className="user-info-header">
                  <h3 className="user-name">
                    {user.firstname || 'User'} {user.surname || ''}
                  </h3>
                  <div className="user-role">
                    {user.is_student ? 'Student' : 'Member'}
                  </div>
                </div>
              </div>

              {/* User Details */}
              <div className="user-details">
                {user.email && (
                  <div className="detail-row">
                    <span className="detail-icon">✉️</span>
                    <span 
                      className="detail-value clickable"
                      onClick={() => handleContact('email', user.email, user.firstname)}
                    >
                      {user.email}
                    </span>
                  </div>
                )}

                {user.university && (
                  <div className="detail-row">
                    <span className="detail-icon">🏫</span>
                    <span className="detail-value">{user.university}</span>
                  </div>
                )}

                {user.education && (
                  <div className="detail-row">
                    <span className="detail-icon">📚</span>
                    <span className="detail-value badge">{getEducationBadge(user.education)}</span>
                  </div>
                )}

                {user.city && (
                  <div className="detail-row">
                    <span className="detail-icon">📍</span>
                    <span className="detail-value">{user.city}</span>
                  </div>
                )}

                {user.phone && (
                  <div className="detail-row">
                    <span className="detail-icon">📱</span>
                    <span 
                      className="detail-value clickable"
                      onClick={() => handleContact('phone', user.phone, user.firstname)}
                    >
                      {user.phone}
                    </span>
                  </div>
                )}

                <div className="detail-row">
                  <span className="detail-icon">📅</span>
                  <span className="detail-value">Joined {formatDate(user.created_at)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="user-actions">
                {user.email && (
                  <button
                    className="action-btn email-btn"
                    onClick={() => handleContact('email', user.email, user.firstname)}
                  >
                    ✉️ Email
                  </button>
                )}
                
                {user.phone && (
                  <button
                    className="action-btn call-btn"
                    onClick={() => handleContact('phone', user.phone, user.firstname)}
                  >
                    📞 Call
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
};

export default AllStudents;