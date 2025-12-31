import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Heart, MessageCircle, Share2, Image as ImageIcon, Globe, Users, Lock, MoreVertical, Send, Clock, TrendingUp, User, Award, BookOpen, GraduationCap, Building, MapPin, X } from 'lucide-react';
import './Feed.css';

const Feed = () => {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [visibility, setVisibility] = useState('public');
  const [activeTab, setActiveTab] = useState('all');
  const [commentInputs, setCommentInputs] = useState({});
  const [isComposing, setIsComposing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [stats, setStats] = useState({ totalPosts: 0, totalUsers: 0, activeUsers: 0 });
  const fileInputRef = useRef(null);
  const feedRef = useRef(null);
  const postsPerPage = 10;

  // Load user session
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setUser(profile);
      }
    };
    getUser();
  }, []);

  // Fetch posts when user or tab changes
  useEffect(() => {
    if (user !== null) { // Changed to handle both logged in and not logged in
      fetchPosts(0);
      fetchStats();
    }
  }, [user, activeTab]);

  // Fetch platform statistics
  const fetchStats = async () => {
    try {
      // Total posts
      const { count: totalPosts } = await supabase
        .from('feed_posts')
        .select('*', { count: 'exact', head: true });

      // Total users
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Active users (posted in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: activePosts } = await supabase
        .from('feed_posts')
        .select('user_id')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const activeUserIds = [...new Set(activePosts?.map(post => post.user_id) || [])];

      setStats({
        totalPosts: totalPosts || 0,
        totalUsers: totalUsers || 0,
        activeUsers: activeUserIds.length
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Fetch posts with pagination
  const fetchPosts = async (pageNum) => {
    setLoading(true);
    try {
      const from = pageNum * postsPerPage;
      
      // Build base query with joins
      let query = supabase
        .from('feed_posts')
        .select(`
          *,
          user:users!feed_posts_user_id_fkey (
            id,
            firstname,
            surname,
            profile_picture_url,
            university,
            program_field,
            is_student,
            year_of_study
          ),
          post_likes (
            user_id
          ),
          post_comments (
            id,
            content,
            created_at,
            user_id,
            user:users!post_comments_user_id_fkey (
              firstname,
              surname,
              profile_picture_url
            )
          )
        `)
        .order('created_at', { ascending: false })
        .range(from, from + postsPerPage - 1);

      // Apply filters based on active tab
      if (activeTab === 'my' && user) {
        query = query.eq('user_id', user.id);
      } else if (activeTab === 'following' && user) {
        const { data: following } = await supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', user.id);

        if (following?.length > 0) {
          const followingIds = following.map(f => f.following_id);
          query = query.in('user_id', followingIds);
        } else {
          setPosts([]);
          setLoading(false);
          return;
        }
      }

      // Apply visibility filter
      if (user) {
        query = query.or(`visibility.eq.public,user_id.eq.${user.id},and(visibility.eq.friends,user_id.in.(select following_id from user_follows where follower_id.eq.${user.id}))`);
      } else {
        query = query.eq('visibility', 'public');
      }

      const { data: postsData, error } = await query;

      if (error) throw error;

      // Check if we have more posts
      if (!postsData || postsData.length < postsPerPage) {
        setHasMore(false);
      }

      // Process posts data
      const processedPosts = postsData?.map((post, index) => {
        // Get unique likes count
        const uniqueLikes = new Set(post.post_likes?.map(like => like.user_id) || []);
        const userHasLiked = user ? uniqueLikes.has(user.id) : false;
        
        // Sort comments by date
        const sortedComments = (post.post_comments || [])
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 3); // Only show 3 comments initially

        return {
          ...post,
          userHasLiked,
          like_count: uniqueLikes.size,
          comments: sortedComments,
          isExpanded: false,
          showAllComments: false,
          animationDelay: index * 0.05
        };
      }) || [];

      if (pageNum === 0) {
        setPosts(processedPosts);
      } else {
        setPosts(prev => [...prev, ...processedPosts]);
      }

    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (!feedRef.current || loading || !hasMore) return;
      
      const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
      if (scrollHeight - scrollTop - clientHeight < 100) {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchPosts(nextPage);
      }
    };

    const feedElement = feedRef.current;
    if (feedElement) {
      feedElement.addEventListener('scroll', handleScroll);
      return () => feedElement.removeEventListener('scroll', handleScroll);
    }
  }, [loading, hasMore, page]);

  // Create new post
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim() && !imageFile) {
      showToast('Please write something or add an image', 'warning');
      return;
    }

    try {
      setIsComposing(true);
      let imageUrl = null;

      // Upload image if provided
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `feed-images/${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('feed-images')
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('feed-images')
          .getPublicUrl(filePath);

        imageUrl = publicUrl;
      }

      // Insert post into database
      const { data: newPostData, error } = await supabase
        .from('feed_posts')
        .insert([{
          user_id: user.id,
          content: newPost.trim(),
          image_url: imageUrl,
          visibility: visibility,
          like_count: 0,
          comment_count: 0,
          share_count: 0
        }])
        .select(`
          *,
          user:users!feed_posts_user_id_fkey (
            id,
            firstname,
            surname,
            profile_picture_url,
            university,
            program_field,
            is_student,
            year_of_study
          )
        `)
        .single();

      if (error) throw error;

      // Add to local state
      setPosts(prev => [{
        ...newPostData,
        userHasLiked: false,
        post_likes: [],
        post_comments: [],
        user: newPostData.user,
        isNewPost: true,
        animationDelay: 0
      }, ...prev]);

      // Show success message
      showToast('Post published successfully!', 'success');

      // Reset form
      setNewPost('');
      setImagePreview(null);
      setImageFile(null);
      setIsComposing(false);

      // Refresh stats
      fetchStats();

    } catch (error) {
      console.error('Error creating post:', error);
      showToast('Failed to create post', 'error');
      setIsComposing(false);
    }
  };

  // Handle like/unlike post
  const handleLikePost = async (postId, currentlyLiked) => {
    if (!user) {
      showToast('Please login to like posts', 'warning');
      return;
    }

    try {
      if (currentlyLiked) {
        // Remove like
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Decrement like count
        await supabase.rpc('decrement', {
          table_name: 'feed_posts',
          column_name: 'like_count',
          id: postId
        });

      } else {
        // Add like
        const { error } = await supabase
          .from('post_likes')
          .insert([{
            post_id: postId,
            user_id: user.id
          }]);

        if (error) throw error;

        // Increment like count
        await supabase.rpc('increment', {
          table_name: 'feed_posts',
          column_name: 'like_count',
          id: postId
        });
      }

      // Update local state
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          const newLikeCount = currentlyLiked ? post.like_count - 1 : post.like_count + 1;
          const updatedLikes = currentlyLiked
            ? (post.post_likes || []).filter(like => like.user_id !== user.id)
            : [...(post.post_likes || []), { user_id: user.id }];

          return {
            ...post,
            like_count: newLikeCount,
            userHasLiked: !currentlyLiked,
            post_likes: updatedLikes
          };
        }
        return post;
      }));

    } catch (error) {
      console.error('Error updating like:', error);
      showToast('Failed to update like', 'error');
    }
  };

  // Add comment to post
  const handleAddComment = async (postId, content) => {
    if (!user) {
      showToast('Please login to comment', 'warning');
      return;
    }

    if (!content.trim()) {
      showToast('Please write a comment', 'warning');
      return;
    }

    try {
      // Insert comment
      const { data: comment, error } = await supabase
        .from('post_comments')
        .insert([{
          post_id: postId,
          user_id: user.id,
          content: content.trim()
        }])
        .select(`
          *,
          user:users!post_comments_user_id_fkey (
            firstname,
            surname,
            profile_picture_url
          )
        `)
        .single();

      if (error) throw error;

      // Increment comment count
      await supabase.rpc('increment', {
        table_name: 'feed_posts',
        column_name: 'comment_count',
        id: postId
      });

      // Update local state
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          const newCommentCount = post.comment_count + 1;
          return {
            ...post,
            comment_count: newCommentCount,
            comments: [comment, ...post.comments],
            showAllComments: true
          };
        }
        return post;
      }));

      // Clear comment input
      setCommentInputs(prev => ({
        ...prev,
        [postId]: ''
      }));

      showToast('Comment added!', 'success');

    } catch (error) {
      console.error('Error adding comment:', error);
      showToast('Failed to add comment', 'error');
    }
  };

  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      showToast('Image size should be less than 50MB', 'warning');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'warning');
      return;
    }

    setImageFile(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Show toast notification
  const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-message">${message}</div>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  // Format time ago
  const formatTimeAgo = (dateString) => {
    const postDate = new Date(dateString);
    const now = new Date();
    const diffMs = now - postDate;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHour < 24) return `${diffHour}h`;
    if (diffDay < 7) return `${diffDay}d`;
    if (diffDay < 30) return `${Math.floor(diffDay / 7)}w`;
    
    return postDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Get user initials for avatar
  const getInitials = (firstname, surname) => {
    return `${firstname?.[0] || ''}${surname?.[0] || ''}`.toUpperCase();
  };

  // Toggle post content expansion
  const togglePostExpand = (postId) => {
    setPosts(prev => prev.map(post => 
      post.id === postId 
        ? { ...post, isExpanded: !post.isExpanded }
        : post
    ));
  };

  // Handle comment input change
  const handleCommentInputChange = (postId, value) => {
    setCommentInputs(prev => ({
      ...prev,
      [postId]: value
    }));
  };

  // Handle enter key in comment input
  const handleKeyPress = (e, postId) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const content = commentInputs[postId] || '';
      if (content.trim()) {
        handleAddComment(postId, content);
      }
    }
  };

  // Render loading state
  if (loading && posts.length === 0) {
    return (
      <div className="feed-container">
        <div className="loading-state">
          <div className="spinner">
            <div className="spinner-inner"></div>
          </div>
          <p>Loading your campus feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="feed-container" ref={feedRef}>
      {/* Header */}
      <div className="feed-header">
        <div className="header-content">
          <h1 className="feed-title">
            <span className="title-main">Campus Feed</span>
            <span className="title-sub">African Students in Russia</span>
          </h1>
          
          <div className="header-stats">
            <div className="stat-item">
              <div className="stat-value">{stats.totalPosts}</div>
              <div className="stat-label">Posts</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.totalUsers}</div>
              <div className="stat-label">Students</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.activeUsers}</div>
              <div className="stat-label">Active</div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Post Card */}
      {user && (
        <div className="create-post-card">
          <div className="post-form">
            <div className="post-form-header">
              <div className="user-avatar">
                {user.profile_picture_url ? (
                  <img src={user.profile_picture_url} alt={user.firstname} />
                ) : (
                  <div className="avatar-fallback">
                    {getInitials(user.firstname, user.surname)}
                  </div>
                )}
              </div>
              <div className="post-input-wrapper">
                <textarea
                  className="post-input"
                  placeholder={`What's on your mind, ${user.firstname}?`}
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  rows="3"
                  maxLength={500}
                />
                <div className="input-footer">
                  <div className="char-count">
                    {newPost.length}/500
                  </div>
                  <div className="visibility-selector">
                    <select 
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value)}
                      className="visibility-select"
                    >
                      <option value="public"><Globe size={14} /> Public</option>
                      <option value="friends"><Users size={14} /> Friends</option>
                      <option value="private"><Lock size={14} /> Only Me</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {imagePreview && (
              <div className="image-preview-container">
                <img src={imagePreview} alt="Preview" className="image-preview" />
                <button 
                  className="remove-image"
                  onClick={() => {
                    setImagePreview(null);
                    setImageFile(null);
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            )}

            <div className="post-form-actions">
              <div className="action-buttons">
                <label className="action-btn">
                  <ImageIcon size={20} />
                  <span>Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    ref={fileInputRef}
                    hidden
                  />
                </label>
              </div>
              <button
                className={`post-submit-btn ${isComposing ? 'posting' : ''}`}
                onClick={handleCreatePost}
                disabled={(!newPost.trim() && !imageFile) || isComposing}
              >
                {isComposing ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feed Tabs */}
      <div className="feed-tabs">
        <button 
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('all');
            setPage(0);
            setHasMore(true);
            fetchPosts(0);
          }}
        >
          <Globe size={18} />
          <span>All Posts</span>
        </button>
        
        {user && (
          <>
            <button 
              className={`tab ${activeTab === 'following' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('following');
                setPage(0);
                setHasMore(true);
                fetchPosts(0);
              }}
            >
              <Users size={18} />
              <span>Following</span>
            </button>
            
            <button 
              className={`tab ${activeTab === 'my' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('my');
                setPage(0);
                setHasMore(true);
                fetchPosts(0);
              }}
            >
              <User size={18} />
              <span>My Posts</span>
            </button>
          </>
        )}
      </div>

      {/* Posts Feed */}
      <div className="posts-feed">
        {posts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h3>No posts yet</h3>
            <p>Be the first to share something with the community!</p>
            {!user && (
              <button 
                className="login-btn"
                onClick={() => window.location.href = '/login'}
              >
                Login to Post
              </button>
            )}
          </div>
        ) : (
          posts.map((post, index) => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={user}
              onLike={handleLikePost}
              onComment={handleAddComment}
              formatTimeAgo={formatTimeAgo}
              getInitials={getInitials}
              isExpanded={post.isExpanded}
              onToggleExpand={() => togglePostExpand(post.id)}
              commentInput={commentInputs[post.id] || ''}
              onCommentInputChange={(value) => handleCommentInputChange(post.id, value)}
              onKeyPress={(e) => handleKeyPress(e, post.id)}
              animationDelay={post.animationDelay}
              index={index}
            />
          ))
        )}

        {loading && posts.length > 0 && (
          <div className="loading-more">
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}

        {!hasMore && posts.length > 0 && (
          <div className="end-of-feed">
            <p>You're all caught up! 🎉</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Post Card Component
const PostCard = ({ 
  post, 
  currentUser, 
  onLike, 
  onComment, 
  formatTimeAgo, 
  getInitials,
  isExpanded,
  onToggleExpand,
  commentInput,
  onCommentInputChange,
  onKeyPress,
  animationDelay,
  index
}) => {
  const [isLiking, setIsLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [likeAnimation, setLikeAnimation] = useState(false);

  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);
    setLikeAnimation(true);
    
    await onLike(post.id, post.userHasLiked);
    setIsLiking(false);
    
    setTimeout(() => setLikeAnimation(false), 1000);
  };

  const handleSubmitComment = async () => {
    if (!commentInput.trim()) return;
    await onComment(post.id, commentInput);
  };

  const needsExpansion = post.content && post.content.length > 300 && !isExpanded;
  const displayContent = needsExpansion 
    ? post.content.substring(0, 300) + '...' 
    : post.content;

  return (
    <div 
      className={`post-card ${post.isNewPost ? 'new-post' : ''}`}
      style={{ animationDelay: `${animationDelay}s` }}
    >
      <div className="post-header">
        <div className="post-author">
          <div className="author-avatar">
            {post.user?.profile_picture_url ? (
              <img 
                src={post.user.profile_picture_url} 
                alt={`${post.user.firstname} ${post.user.surname}`}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.querySelector('.avatar-fallback').style.display = 'flex';
                }}
              />
            ) : null}
            <div className={`avatar-fallback ${post.user?.profile_picture_url ? 'hidden' : ''}`}>
              {getInitials(post.user?.firstname, post.user?.surname)}
            </div>
          </div>
          <div className="author-info">
            <div className="author-name">
              {post.user?.firstname} {post.user?.surname}
              {post.user_id === currentUser?.id && (
                <span className="you-badge">You</span>
              )}
            </div>
            <div className="author-details">
              {post.user?.university && (
                <span className="author-university">
                  <Building size={12} />
                  {post.user.university}
                </span>
              )}
              <span className="post-time">
                <Clock size={12} />
                {formatTimeAgo(post.created_at)}
              </span>
              <span className="post-visibility">
                {post.visibility === 'public' && <Globe size={12} />}
                {post.visibility === 'friends' && <Users size={12} />}
                {post.visibility === 'private' && <Lock size={12} />}
              </span>
            </div>
          </div>
        </div>
        
        {post.user_id === currentUser?.id && (
          <button className="post-menu-btn">
            <MoreVertical size={20} />
          </button>
        )}
      </div>

      <div className="post-content">
        <p className="post-text">
          {displayContent}
          {needsExpansion && (
            <button className="read-more-btn" onClick={onToggleExpand}>
              Read more
            </button>
          )}
        </p>
        
        {post.image_url && (
          <div className="post-image-container">
            <img 
              src={post.image_url} 
              alt="Post" 
              className="post-image"
              loading="lazy"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<div class="image-error">Image unavailable</div>';
              }}
            />
          </div>
        )}
      </div>

      <div className="post-stats">
        <div className="stat">
          <Heart size={14} className={likeAnimation ? 'liking' : ''} />
          <span>{post.like_count || 0} likes</span>
        </div>
        <div className="stat">
          <MessageCircle size={14} />
          <span>{post.comment_count || 0} comments</span>
        </div>
        <div className="stat">
          <Share2 size={14} />
          <span>{post.share_count || 0} shares</span>
        </div>
      </div>

      <div className="post-actions">
        <button 
          className={`action-btn ${post.userHasLiked ? 'liked' : ''}`}
          onClick={handleLike}
          disabled={isLiking}
        >
          <Heart size={18} fill={post.userHasLiked ? 'currentColor' : 'none'} />
          <span>{post.userHasLiked ? 'Liked' : 'Like'}</span>
        </button>
        
        <button 
          className="action-btn"
          onClick={() => setShowComments(!showComments)}
        >
          <MessageCircle size={18} />
          <span>Comment</span>
        </button>
        
        <button className="action-btn">
          <Share2 size={18} />
          <span>Share</span>
        </button>
      </div>

      {currentUser && (
        <div className="comment-input-section">
          <div className="comment-input-wrapper">
            <div className="comment-avatar">
              {currentUser.profile_picture_url ? (
                <img 
                  src={currentUser.profile_picture_url} 
                  alt="You"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.querySelector('.avatar-fallback').style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`avatar-fallback ${currentUser.profile_picture_url ? 'hidden' : ''}`}>
                {getInitials(currentUser.firstname, currentUser.surname)}
              </div>
            </div>
            <div className="comment-input-container">
              <input
                type="text"
                className="comment-input"
                placeholder="Write a comment..."
                value={commentInput}
                onChange={(e) => onCommentInputChange(e.target.value)}
                onKeyPress={(e) => onKeyPress(e)}
              />
              <button 
                className="comment-submit-btn"
                onClick={handleSubmitComment}
                disabled={!commentInput.trim()}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {showComments && post.comments && post.comments.length > 0 && (
        <div className="comments-section">
          {post.comments.map((comment, i) => (
            <div key={comment.id} className="comment" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="comment-avatar">
                {comment.user?.profile_picture_url ? (
                  <img 
                    src={comment.user.profile_picture_url} 
                    alt={`${comment.user.firstname} ${comment.user.surname}`}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.querySelector('.avatar-fallback').style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className={`avatar-fallback ${comment.user?.profile_picture_url ? 'hidden' : ''}`}>
                  {getInitials(comment.user?.firstname, comment.user?.surname)}
                </div>
              </div>
              <div className="comment-content">
                <div className="comment-header">
                  <span className="comment-author">
                    {comment.user?.firstname} {comment.user?.surname}
                  </span>
                  <span className="comment-time">
                    {formatTimeAgo(comment.created_at)}
                  </span>
                </div>
                <p className="comment-text">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Feed;