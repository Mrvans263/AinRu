import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Heart, MessageCircle, Share2, Image as ImageIcon, Globe, Users, Lock, MoreVertical, Send, Clock, Zap, TrendingUp, User, Award, Sparkles, BookOpen, MapPin, Flag, GraduationCap } from 'lucide-react';
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
  const feedRef = useRef(null);
  const postsPerPage = 5;

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchPosts(0);
      fetchStats();
    }
  }, [user, activeTab]);

  const checkUser = async () => {
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

  const fetchStats = async () => {
    try {
      // Get posts from last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const { data: postsData } = await supabase
        .from('feed_posts')
        .select('id')
        .gte('created_at', weekAgo.toISOString());

      // Get active users (those with posts in last month)
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      
      const { data: recentPosts } = await supabase
        .from('feed_posts')
        .select('user_id')
        .gte('created_at', monthAgo.toISOString());

      const activeUserIds = [...new Set(recentPosts?.map(post => post.user_id) || [])];
      
      return {
        totalPosts: postsData?.length || 0,
        activeUsers: activeUserIds.length,
        trendingPosts: Math.floor((postsData?.length || 0) / 2)
      };
    } catch (error) {
      console.error('Error fetching stats:', error);
      return { totalPosts: 0, activeUsers: 0, trendingPosts: 0 };
    }
  };

  const fetchPosts = async (pageNum) => {
    if (!hasMore && pageNum > 0) return;
    
    setLoading(true);
    try {
      const from = pageNum * postsPerPage;
      const to = from + postsPerPage - 1;

      let query = supabase
        .from('feed_posts')
        .select(`
          *,
          users!feed_posts_user_id_fkey (
            id,
            firstname,
            surname,
            profile_picture_url,
            university,
            program_field,
            is_student
          ),
          post_likes!inner (
            user_id
          ),
          post_comments!inner (
            id,
            content,
            created_at,
            user_id,
            users!post_comments_user_id_fkey (
              firstname,
              surname,
              profile_picture_url
            )
          )
        `)
        .order('created_at', { ascending: false });

      // Apply filters based on active tab
      if (activeTab === 'my' && user) {
        query = query.eq('user_id', user.id);
      } else if (activeTab === 'following' && user) {
        const { data: following } = await supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', user.id);

        if (following && following.length > 0) {
          const followingIds = following.map(f => f.following_id);
          query = query.in('user_id', followingIds);
        } else {
          setPosts([]);
          setLoading(false);
          return;
        }
      }

      // Visibility filter
      if (user) {
        query = query.or(`visibility.eq.public,user_id.eq.${user.id},visibility.eq.friends`);
      } else {
        query = query.eq('visibility', 'public');
      }

      const { data, error, count } = await query.range(from, to);

      if (error) throw error;

      // Check if we have more posts
      if (!data || data.length < postsPerPage) {
        setHasMore(false);
      }

      // Process posts data
      const processedPosts = (data || []).map((post, index) => {
        // Count unique likes
        const uniqueLikes = new Set(post.post_likes?.map(like => like.user_id) || []);
        
        return {
          ...post,
          userHasLiked: uniqueLikes.has(user?.id) || false,
          like_count: uniqueLikes.size,
          comments: (post.post_comments || []).map(comment => ({
            ...comment,
            user: comment.users
          })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
          user: post.users,
          isExpanded: false,
          showAllComments: false,
          animationDelay: index * 0.1
        };
      });

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

  const loadMorePosts = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPosts(nextPage);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (!feedRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
      if (scrollHeight - scrollTop - clientHeight < 100) {
        loadMorePosts();
      }
    };

    const feedElement = feedRef.current;
    if (feedElement) {
      feedElement.addEventListener('scroll', handleScroll);
      return () => feedElement.removeEventListener('scroll', handleScroll);
    }
  }, [loading, hasMore]);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim() && !imageFile) return;

    try {
      setIsComposing(true);
      let imageUrl = null;

      // Upload image if exists
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('feed-images')
          .upload(fileName, imageFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('feed-images')
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      // Create post in database
      const { data, error } = await supabase
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
          users!feed_posts_user_id_fkey (
            id,
            firstname,
            surname,
            profile_picture_url,
            university,
            program_field,
            is_student
          )
        `)
        .single();

      if (error) throw error;

      // Add new post to state
      const newPostData = {
        ...data,
        userHasLiked: false,
        post_likes: [],
        post_comments: [],
        user: data.users,
        isNewPost: true,
        animationDelay: 0
      };

      setPosts(prev => [newPostData, ...prev]);

      // Show success toast
      showToast('Post published successfully! 🎉', 'success');

      // Reset form
      setNewPost('');
      setImagePreview(null);
      setImageFile(null);
      setIsComposing(false);

      // Refresh stats
      fetchStats();

    } catch (error) {
      console.error('Error creating post:', error);
      showToast('Failed to create post. Please try again.', 'error');
      setIsComposing(false);
    }
  };

  const handleLikePost = async (postId, currentlyLiked) => {
    if (!user) {
      showToast('Please login to like posts', 'warning');
      return;
    }

    try {
      if (currentlyLiked) {
        // Unlike post
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Decrement like count in feed_posts
        const { data: post } = await supabase
          .from('feed_posts')
          .select('like_count')
          .eq('id', postId)
          .single();

        if (post) {
          await supabase
            .from('feed_posts')
            .update({ like_count: Math.max(0, post.like_count - 1) })
            .eq('id', postId);
        }

      } else {
        // Like post
        const { error } = await supabase
          .from('post_likes')
          .insert([{
            post_id: postId,
            user_id: user.id
          }]);

        if (error) throw error;

        // Increment like count in feed_posts
        const { data: post } = await supabase
          .from('feed_posts')
          .select('like_count')
          .eq('id', postId)
          .single();

        if (post) {
          await supabase
            .from('feed_posts')
            .update({ like_count: post.like_count + 1 })
            .eq('id', postId);
        }
      }

      // Update local state
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          const newLikeCount = currentlyLiked 
            ? Math.max(0, post.like_count - 1)
            : post.like_count + 1;
          
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
          users!post_comments_user_id_fkey (
            firstname,
            surname,
            profile_picture_url
          )
        `)
        .single();

      if (error) throw error;

      // Increment comment count in feed_posts
      const { data: post } = await supabase
        .from('feed_posts')
        .select('comment_count')
        .eq('id', postId)
        .single();

      if (post) {
        await supabase
          .from('feed_posts')
          .update({ comment_count: post.comment_count + 1 })
          .eq('id', postId);
      }

      // Update local state
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          const newComment = {
            ...comment,
            user: comment.users
          };
          
          return {
            ...post,
            comment_count: (post.comment_count || 0) + 1,
            post_comments: [newComment, ...(post.post_comments || [])]
          };
        }
        return post;
      }));

      // Clear comment input
      setCommentInputs(prev => ({
        ...prev,
        [postId]: ''
      }));

      showToast('Comment added successfully!', 'success');

    } catch (error) {
      console.error('Error adding comment:', error);
      showToast('Failed to add comment', 'error');
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      showToast('Image size should be less than 50MB', 'warning');
      return;
    }

    // Check file type
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

  const showToast = (message, type = 'info') => {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-message">${message}</div>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    // Remove toast after 3 seconds
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  const formatTimeAgo = (dateString) => {
    const postDate = new Date(dateString);
    const now = new Date();
    const diffMs = now - postDate;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    
    return postDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: diffDay > 365 ? 'numeric' : undefined
    });
  };

  const getInitials = (firstname, surname) => {
    return `${firstname?.[0] || ''}${surname?.[0] || ''}`.toUpperCase();
  };

  const togglePostExpand = (postId) => {
    setPosts(prev => prev.map(post => 
      post.id === postId 
        ? { ...post, isExpanded: !post.isExpanded }
        : post
    ));
  };

  const handleCommentInputChange = (postId, value) => {
    setCommentInputs(prev => ({
      ...prev,
      [postId]: value
    }));
  };

  const handleKeyPress = (e, postId) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const content = commentInputs[postId] || '';
      if (content.trim()) {
        handleAddComment(postId, content);
      }
    }
  };

  if (loading && posts.length === 0) {
    return (
      <div className="feed-container">
        <div className="loading-state">
          <div className="spinner">
            <div className="spinner-circle"></div>
          </div>
          <div className="loading-text">Loading your campus feed...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="feed-container" ref={feedRef}>
      {/* Floating Decorations */}
      <div className="floating-decorations">
        <div className="floating-element el1">🇷🇺</div>
        <div className="floating-element el2">🇳🇬</div>
        <div className="floating-element el3">🇰🇪</div>
        <div className="floating-element el4">🇬🇭</div>
        <div className="floating-element el5">🇿🇦</div>
      </div>

      {/* Header */}
      <div className="feed-header">
        <div className="header-main">
          <div className="title-section">
            <h1 className="main-title">
              <span className="title-gradient">Ain Ru</span>
              <span className="title-sparkle">✨</span>
            </h1>
            <p className="subtitle">African Student Community in Russia</p>
          </div>
          <div className="header-stats">
            <div className="stat-item">
              <TrendingUp size={18} />
              <span>{posts.length} Posts</span>
            </div>
            <div className="stat-item">
              <Users size={18} />
              <span>Active Students</span>
            </div>
          </div>
        </div>
      </div>

      {/* Create Post Card */}
      {user && (
        <div className="create-post-card glass-effect">
          <div className="post-form">
            <div className="user-info">
              <div className="user-avatar">
                {user.profile_picture_url ? (
                  <img src={user.profile_picture_url} alt={user.firstname} />
                ) : (
                  <div className="avatar-fallback">
                    {getInitials(user.firstname, user.surname)}
                  </div>
                )}
              </div>
              <div className="user-details">
                <div className="user-name">{user.firstname} {user.surname}</div>
                <div className="user-study">
                  <GraduationCap size={14} />
                  <span>{user.university || 'University'} • {user.program_field || 'Field of Study'}</span>
                </div>
              </div>
            </div>
            
            <div className="post-input-section">
              <textarea
                className="post-input"
                placeholder="What's happening in your Russian campus life?"
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                rows="3"
                maxLength="500"
              />
              <div className="input-actions">
                <div className="char-count">{newPost.length}/500</div>
                <div className="visibility-select">
                  <select 
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                  >
                    <option value="public"><Globe size={14} /> Public</option>
                    <option value="friends"><Users size={14} /> Friends</option>
                    <option value="private"><Lock size={14} /> Private</option>
                  </select>
                </div>
              </div>
            </div>

            {imagePreview && (
              <div className="image-preview">
                <img src={imagePreview} alt="Preview" />
                <button 
                  className="remove-image"
                  onClick={() => {
                    setImagePreview(null);
                    setImageFile(null);
                  }}
                >
                  ×
                </button>
              </div>
            )}

            <div className="post-actions">
              <div className="action-buttons">
                <label className="action-btn upload-btn">
                  <ImageIcon size={20} />
                  <span>Add Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    hidden
                  />
                </label>
                <button className="action-btn">
                  <MapPin size={20} />
                  <span>Location</span>
                </button>
                <button className="action-btn">
                  <Flag size={20} />
                  <span>Tag</span>
                </button>
              </div>
              <button
                className={`submit-btn ${isComposing ? 'composing' : ''}`}
                onClick={handleCreatePost}
                disabled={(!newPost.trim() && !imageFile) || isComposing}
              >
                {isComposing ? 'Posting...' : 'Post to Feed'}
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
          <div className="empty-feed glass-effect">
            <div className="empty-icon">📝</div>
            <h3>No posts yet</h3>
            <p>Be the first to share your experience in Russia!</p>
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
            <Sparkles size={20} />
            <span>You're all caught up!</span>
          </div>
        )}
      </div>
    </div>
  );
};

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

  const needsExpansion = post.content && post.content.length > 400 && !isExpanded;
  const displayContent = needsExpansion 
    ? post.content.substring(0, 400) + '...' 
    : post.content;

  return (
    <div 
      className={`post-card glass-effect ${post.isNewPost ? 'new-post' : ''}`}
      style={{ animationDelay: `${animationDelay}s` }}
    >
      <div className="post-header">
        <div className="author-info">
          <div className="author-avatar">
            {post.user?.profile_picture_url ? (
              <img 
                src={post.user.profile_picture_url} 
                alt={post.user.firstname}
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
          <div className="author-details">
            <div className="author-name">
              <strong>{post.user?.firstname || 'Student'} {post.user?.surname || ''}</strong>
              {post.user?.is_student && (
                <span className="student-badge">
                  <GraduationCap size={12} />
                  <span>Student</span>
                </span>
              )}
            </div>
            <div className="author-study">
              <BookOpen size={12} />
              <span>{post.user?.university || 'Russian University'}</span>
            </div>
            <div className="post-meta">
              <Clock size={12} />
              <span className="time">{formatTimeAgo(post.created_at)}</span>
              <span className="visibility">
                {post.visibility === 'public' && <Globe size={12} />}
                {post.visibility === 'friends' && <Users size={12} />}
                {post.visibility === 'private' && <Lock size={12} />}
              </span>
            </div>
          </div>
        </div>
        
        <button className="post-menu">
          <MoreVertical size={20} />
        </button>
      </div>

      <div className="post-content">
        <div className="post-text">
          <p>
            {displayContent}
            {needsExpansion && (
              <button className="expand-btn" onClick={onToggleExpand}>
                Read more
              </button>
            )}
          </p>
        </div>
        
        {post.image_url && (
          <div className="post-image">
            <img 
              src={post.image_url} 
              alt="Post" 
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
          <span>Like</span>
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
          <div className="input-wrapper">
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
            <input
              type="text"
              className="comment-input"
              placeholder="Write a comment..."
              value={commentInput}
              onChange={(e) => onCommentInputChange(e.target.value)}
              onKeyPress={(e) => onKeyPress(e)}
            />
            <button 
              className="comment-send"
              onClick={handleSubmitComment}
              disabled={!commentInput.trim()}
            >
              <Send size={18} />
            </button>
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
                    alt={comment.user.firstname}
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