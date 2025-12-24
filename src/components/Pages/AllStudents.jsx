import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import './AllStudents.css';

const AllStudents = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all'); // 'all', 'student', 'non-student'
  const [sortBy, setSortBy] = useState('name'); // 'name', 'recent', 'university'

  useEffect(() => {
    fetchAllUsers();
  }, []);

  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      // Fetch all users from the database
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('Users fetched:', data?.length || 0);
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort users
  const filteredUsers = users
    .filter(user => {
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        !searchTerm ||
        (user.firstname && user.firstname.toLowerCase().includes(searchLower)) ||
        (user.surname && user.surname.toLowerCase().includes(searchLower)) ||
        (user.email && user.email.toLowerCase().includes(searchLower)) ||
        (user.university && user.university.toLowerCase().includes(searchLower)) ||
        (user.city && user.city.toLowerCase().includes(searchLower));

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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStudentStatusBadge = (isStudent) => {
    if (isStudent === true) {
      return <span className="student-badge">🎓 Student</span>;
    }
    return <span className="non-student-badge">👤 Member</span>;
  };

  const getEducationBadge = (education) => {
    if (!education) return null;
    
    const educationMap = {
      'Undergraduate': '📚 Undergrad',
      'Graduate': '🎓 Graduate',
      'Postgraduate': '📜 Postgrad',
      'PhD': '🧠 PhD',
      'Diploma': '📋 Diploma'
    };
    
    return educationMap[education] || education;
  };

  if (loading) {
    return (
      <div className="all-students-container">
        <div className="loading">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="all-students-container">
      {/* Header */}
      <div className="all-students-header">
        <h1 className="all-students-title">Community Members</h1>
        <p className="all-students-subtitle">
          Connect with {users.length} members in our community
        </p>
      </div>

      {/* Filters Section */}
      <div className="students-filters">
        <div className="filters-grid">
          {/* Search */}
          <div className="filter-group">
            <input
              type="text"
              className="search-input"
              placeholder="Search by name, email, or university..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filter by Student Status */}
          <div className="filter-group">
            <select
              className="filter-select"
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
            >
              <option value="all">All Members</option>
              <option value="student">Students Only</option>
              <option value="non-student">Non-Students</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="filter-group">
            <select
              className="filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name">Sort by Name</option>
              <option value="recent">Sort by Recent</option>
              <option value="university">Sort by University</option>
            </select>
          </div>
        </div>

        <div className="results-count">
          Showing {filteredUsers.length} of {users.length} members
        </div>
      </div>

      {/* Users Grid */}
      <div className="users-grid">
        {filteredUsers.length === 0 ? (
          <div className="no-users">
            <h3>No members found</h3>
            <p>Try adjusting your search or filters</p>
          </div>
        ) : (
          filteredUsers.map(user => (
            <div key={user.id} className="user-card">
              {/* Profile Picture or Initials */}
              <div className="user-avatar">
                {user.profile_picture_url ? (
                  <img 
                    src={user.profile_picture_url} 
                    alt={`${user.firstname || ''} ${user.surname || ''}`}
                    className="avatar-image"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className="avatar-fallback">
                  {user.firstname?.[0]?.toUpperCase() || 'U'}
                </div>
              </div>

              {/* User Info */}
              <div className="user-info">
                {/* Name and Student Status */}
                <div className="user-header">
                  <h3 className="user-name">
                    {user.firstname || 'User'} {user.surname || ''}
                  </h3>
                  {getStudentStatusBadge(user.is_student)}
                </div>

                {/* Email */}
                {user.email && (
                  <div className="user-email">
                    <span className="info-icon">📧</span>
                    <a href={`mailto:${user.email}`} className="email-link">
                      {user.email}
                    </a>
                  </div>
                )}

                {/* University */}
                {user.university && (
                  <div className="user-university">
                    <span className="info-icon">🏫</span>
                    {user.university}
                  </div>
                )}

                {/* Education Level */}
                {user.education && (
                  <div className="user-education">
                    <span className="info-icon">📖</span>
                    {getEducationBadge(user.education)}
                  </div>
                )}

                {/* City */}
                {user.city && (
                  <div className="user-city">
                    <span className="info-icon">📍</span>
                    {user.city}
                  </div>
                )}

                {/* Phone (if available and user is student) */}
                {user.phone && user.is_student && (
                  <div className="user-phone">
                    <span className="info-icon">📱</span>
                    <a href={`tel:${user.phone}`} className="phone-link">
                      {user.phone}
                    </a>
                  </div>
                )}

                {/* Joined Date */}
                <div className="user-joined">
                  <span className="info-icon">📅</span>
                  Joined {formatDate(user.created_at)}
                </div>

                {/* Additional Info */}
                <div className="user-meta">
                  {user.verification_board && (
                    <span className="verification-badge">
                      ✅ {user.verification_board}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="user-actions">
                {user.email && (
                  <button
                    className="email-btn"
                    onClick={() => window.location.href = `mailto:${user.email}`}
                    title="Send email"
                  >
                    📧 Email
                  </button>
                )}
                
                {user.phone && (
                  <button
                    className="call-btn"
                    onClick={() => {
                      if (window.confirm(`Call ${user.firstname || 'User'} at ${user.phone}?`)) {
                        window.location.href = `tel:${user.phone}`;
                      }
                    }}
                    title="Call"
                  >
                    📞 Call
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AllStudents;