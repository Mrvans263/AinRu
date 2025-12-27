import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Heart, MessageCircle, Share2, Image as ImageIcon, MapPin, Smile, Globe, Users, Lock, MoreVertical, Send, Clock, Zap, Sparkles, TrendingUp, Users as UsersIcon, Award } from 'lucide-react';
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
  const [stats, setStats] = useState({ totalPosts: 0, activeUsers: 0, trendingPosts: 0 });

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchPosts();
      fetchStats();
    }
  }, [user, activeTab]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user || null);
  };

  const fetchStats = async () => {
    try {
      const { data: postsData } = await supabase
        .from('feed_posts')
        .select('id')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const { data: usersData } = await supabase
        .from('users')
        .select('id')
        .limit(100);

      setStats({
        totalPosts: postsData?.length || 0,
        activeUsers: usersData?.length || 0,
        trendingPosts: Math.floor((postsData?.length || 0) / 3)
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('feed_posts')
        .select(`
          *,
          user:users(firstname, surname, profile_picture_url),
          likes:post_likes(user_id),
          comments:post_comments(
            id,
            content,
            created_at,
            user:users(firstname, surname, profile_picture_url)
          )
        `)
        .order('created_at', { ascending: false });

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

      if (user) {
        query = query.or(`visibility.eq.public,user_id.eq.${user.id}`);
      } else {
        query = query.eq('visibility', 'public');
      }

      const { data, error } = await query.limit(50);
      
      if (error) throw error;
      
      const processedPosts = (data || []).map((post, index) => ({
        ...post,
        userHasLiked: post.likes?.some(like => like.user_id === user?.id) || false,
        comments: post.comments?.slice(0, 3) || [],
        showAllComments: false,
        isExpanded: false,
        animationDelay: index * 0.1
      }));
      
      setPosts(processedPosts);
      setCommentInputs({});
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim() && !imageFile) {
      alert('Please write something or add an image');
      return;
    }

    try {
      setIsComposing(true);
      
      let imageUrl = null;
      
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('feed-images')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('feed-images')
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

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
          user:users(firstname, surname, profile_picture_url)
        `)
        .single();

      if (error) throw error;

      setPosts(prev => [{
        ...data,
        userHasLiked: false,
        likes: [],
        comments: [],
        showAllComments: false,
        isNewPost: true,
        animationDelay: 0
      }, ...prev]);

      // Show success message
      const successMsg = document.createElement('div');
      successMsg.className = 'post-success-message';
      successMsg.innerHTML = `
        <div class="success-icon">🎉</div>
        <div class="success-text">Post published successfully!</div>
      `;
      document.body.appendChild(successMsg);
      setTimeout(() => successMsg.remove(), 3000);

      // Reset form
      setTimeout(() => {
        setNewPost('');
        setImagePreview(null);
        setImageFile(null);
        setVisibility('public');
        setIsComposing(false);
      }, 500);

      // Update stats
      setStats(prev => ({
        ...prev,
        totalPosts: prev.totalPosts + 1
      }));

    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post: ' + error.message);
      setIsComposing(false);
    }
  };

  const handleLikePost = async (postId, currentlyLiked) => {
    if (!user) {
      alert('Please login to like posts');
      return;
    }

    try {
      if (currentlyLiked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;

        const { data: currentPost } = await supabase
          .from('feed_posts')
          .select('like_count')
          .eq('id', postId)
          .single();

        const newLikeCount = Math.max(0, (currentPost?.like_count || 0) - 1);
        
        await supabase
          .from('feed_posts')
          .update({ like_count: newLikeCount })
          .eq('id', postId);

      } else {
        const { error } = await supabase
          .from('post_likes')
          .insert([{
            post_id: postId,
            user_id: user.id
          }]);

        if (error) throw error;

        const { data: currentPost } = await supabase
          .from('feed_posts')
          .select('like_count')
          .eq('id', postId)
          .single();

        const newLikeCount = (currentPost?.like_count || 0) + 1;
        
        await supabase
          .from('feed_posts')
          .update({ like_count: newLikeCount })
          .eq('id', postId);
      }

      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          const newLikeCount = currentlyLiked ? 
            Math.max(0, post.like_count - 1) : 
            post.like_count + 1;
          
          return {
            ...post,
            like_count: newLikeCount,
            userHasLiked: !currentlyLiked,
            likes: currentlyLiked 
              ? (post.likes || []).filter(like => like.user_id !== user.id)
              : [...(post.likes || []), { user_id: user.id }]
          };
        }
        return post;
      }));

    } catch (error) {
      console.error('Error updating like:', error);
      alert('Like action failed: ' + error.message);
    }
  };

  const handleAddComment = async (postId, content) => {
    if (!user) {
      alert('Please login to comment');
      return;
    }

    if (!content.trim()) {
      alert('Please write a comment');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('post_comments')
        .insert([{
          post_id: postId,
          user_id: user.id,
          content: content.trim()
        }])
        .select(`
          *,
          user:users(firstname, surname, profile_picture_url)
        `)
        .single();

      if (error) throw error;

      const { data: currentPost } = await supabase
        .from('feed_posts')
        .select('comment_count')
        .eq('id', postId)
        .single();

      const newCommentCount = (currentPost?.comment_count || 0) + 1;
      
      await supabase
        .from('feed_posts')
        .update({ comment_count: newCommentCount })
        .eq('id', postId);

      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comment_count: newCommentCount,
            comments: [data, ...(post.comments || [])],
            showAllComments: true
          };
        }
        return post;
      }));

      // Clear the input for this post
      setCommentInputs(prev => ({
        ...prev,
        [postId]: ''
      }));

    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment: ' + error.message);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    setImageFile(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const formatTimeAgo = (dateString) => {
    const postDate = new Date(dateString + 'Z');
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
        <div className="loading-container">
          <div className="loading-spinner">
            <div className="spinner-ring"></div>
          </div>
          <p className="loading-text">Loading campus feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="feed-container">
      {/* Floating Elements */}
      <div className="floating-elements">
        <div className="floating-icon floating-icon-1">✨</div>
        <div className="floating-icon floating-icon-2">🌟</div>
        <div className="floating-icon floating-icon-3">🎯</div>
      </div>

      <div className="feed-header">
        <div className="header-content">
          <div className="header-title-wrapper">
            <h1 className="header-title">
              <span className="title-text">Campus</span>
              <span className="title-highlight">Feed</span>
            </h1>
            <div className="title-sparkle">✨</div>
          </div>
          <p className="header-subtitle">Share updates, connect with students</p>
        </div>
        
        {/* Animated Stats Bar */}
        <div className="stats-bar">
          <div className="stat-card">
            <div className="stat-icon-wrapper">
              <TrendingUp size={20} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalPosts}+</div>
              <div className="stat-label">Posts This Week</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon-wrapper">
              <UsersIcon size={20} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.activeUsers}+</div>
              <div className="stat-label">Active Students</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon-wrapper">
              <Zap size={20} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.trendingPosts}</div>
              <div className="stat-label">Trending Now</div>
            </div>
          </div>
        </div>
      </div>

      {user && (
        <div className={`create-post-card glassmorphism ${isComposing ? 'pulsing' : ''}`}>
          <div className="post-form-header">
            <div className="user-avatar">
              {user?.user_metadata?.avatar_url ? (
                <img 
                  src={user.user_metadata.avatar_url} 
                  alt="Profile" 
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.querySelector('.avatar-fallback').style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`avatar-fallback ${user?.user_metadata?.avatar_url ? 'hidden' : ''}`}>
                {getInitials(user?.user_metadata?.firstname, user?.user_metadata?.surname)}
              </div>
            </div>
            <div className="post-input-wrapper">
              <textarea
                className="post-input"
                placeholder="What's happening on campus?"
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                rows="3"
              />
              <div className="character-count">
                <span className={`count ${newPost.length > 400 ? 'warning' : ''}`}>
                  {newPost.length}
                </span>
                <span>/500</span>
              </div>
              <div className="post-options">
                <div className="visibility-selector">
                  <select 
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                    className="visibility-select"
                  >
                    <option value="public"><Globe size={14} /> Public</option>
                    <option value="friends"><Users size={14} /> Friends Only</option>
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
                type="button" 
                className="remove-image-btn"
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
            <div className="action-icons">
              <label className="action-icon-btn">
                <ImageIcon size={20} />
                <span>Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  hidden
                />
              </label>
              <button type="button" className="action-icon-btn">
                <Smile size={20} />
                <span>Feeling</span>
              </button>
              <button type="button" className="action-icon-btn">
                <MapPin size={20} />
                <span>Location</span>
              </button>
            </div>
            <button 
              type="submit" 
              className="post-submit-btn gradient-btn"
              onClick={handleCreatePost}
              disabled={!newPost.trim() && !imageFile}
            >
              <span className="btn-text">Post</span>
            </button>
          </div>
        </div>
      )}

      <div className="feed-tabs">
        <button 
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <Globe size={16} />
          <span>All Posts</span>
        </button>
        {user && (
          <>
            <button 
              className={`tab-btn ${activeTab === 'following' ? 'active' : ''}`}
              onClick={() => setActiveTab('following')}
            >
              <Users size={16} />
              <span>Following</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'my' ? 'active' : ''}`}
              onClick={() => setActiveTab('my')}
            >
              <Award size={16} />
              <span>My Posts</span>
            </button>
          </>
        )}
      </div>

      <div className="posts-feed">
        {posts.length === 0 ? (
          <div className="no-posts glassmorphism">
            <div className="no-posts-icon">📰</div>
            <h3>No posts yet</h3>
            <p>Be the first to share something with the campus!</p>
            {!user && (
              <button className="login-prompt-btn" onClick={() => window.location.href = '/login'}>
                Login to post
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

  const needsExpansion = post.content && post.content.length > 300 && !isExpanded;
  const displayContent = needsExpansion 
    ? post.content.substring(0, 300) + '...' 
    : post.content;

  return (
    <div 
      className={`post-card glassmorphism slide-up ${post.isNewPost ? 'new-post-highlight' : ''}`}
      style={{ animationDelay: `${animationDelay}s` }}
    >
      <div className="post-header">
        <div className="post-author">
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
              {post.user?.firstname || 'User'} {post.user?.surname || ''}
              {post.user_id === currentUser?.id && (
                <span className="you-badge">You</span>
              )}
            </div>
            <div className="post-meta">
              <Clock size={12} />
              <span className="post-time">{formatTimeAgo(post.created_at)}</span>
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
                e.target.parentElement.innerHTML = '<div class="image-error">Image failed to load</div>';
              }}
            />
          </div>
        )}
      </div>

      <div className="post-stats">
        <div className="stat">
          <Heart size={14} className={likeAnimation ? 'pulse-heart' : ''} />
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

      <div className="post-actions-bar">
        <button 
          className={`post-action-btn ${post.userHasLiked ? 'liked' : ''}`}
          onClick={handleLike}
          disabled={isLiking}
        >
          <Heart size={18} fill={post.userHasLiked ? 'currentColor' : 'none'} />
          <span>{post.userHasLiked ? 'Liked' : 'Like'}</span>
        </button>
        
        <button 
          className="post-action-btn"
          onClick={() => setShowComments(!showComments)}
        >
          <MessageCircle size={18} />
          <span>Comment</span>
        </button>
        
        <button className="post-action-btn">
          <Share2 size={18} />
          <span>Share</span>
        </button>
      </div>

      {currentUser && (
        <div className="add-comment-section">
          <div className="comment-input-wrapper">
            <div className="comment-avatar small">
              {currentUser?.user_metadata?.avatar_url ? (
                <img 
                  src={currentUser.user_metadata.avatar_url} 
                  alt="You"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.querySelector('.avatar-fallback').style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`avatar-fallback small ${currentUser?.user_metadata?.avatar_url ? 'hidden' : ''}`}>
                {getInitials(
                  currentUser?.user_metadata?.firstname,
                  currentUser?.user_metadata?.surname
                )}
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
            <div key={comment.id} className="comment-item fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="comment-avatar small">
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
                <div className={`avatar-fallback small ${comment.user?.profile_picture_url ? 'hidden' : ''}`}>
                  {getInitials(comment.user?.firstname, comment.user?.surname)}
                </div>
              </div>
              <div className="comment-content">
                <div className="comment-header">
                  <span className="comment-author">
                    {comment.user?.firstname || 'User'} {comment.user?.surname || ''}
                  </span>
                  <span className="comment-time">
                    {formatTimeAgo(comment.created_at)}
                  </span>
                </div>
                <p className="comment-text">{comment.content}</p>
                <div className="comment-actions">
                  <button className="comment-like-btn">Like</button>
                  <button className="comment-reply-btn">Reply</button>
                </div>
              </div>
            </div>
          ))}
          
          {post.comment_count > post.comments.length && (
            <button className="view-more-comments-btn">
              View all {post.comment_count} comments
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Feed;