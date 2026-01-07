// Feed.jsx - Complete Optimized Replacement WITH LIKE PERSISTENCE FIX & INFINITE SCROLL FIX
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Heart, MessageCircle, Share2, Image as ImageIcon, Globe, Users, Lock, MoreVertical, Send, Clock, User, X } from 'lucide-react';
import './Feed.css';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Feed Error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h3>Something went wrong</h3>
          <p>Please refresh the page or try again later.</p>
          <button onClick={() => window.location.reload()}>Refresh</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Toast Component
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(), 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-content">
        <div className="toast-message">{message}</div>
        <button className="toast-close" onClick={onClose}>×</button>
      </div>
    </div>
  );
};

// Avatar Component with caching
const Avatar = React.memo(({ user, size = 'md', onClick, priority = false }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const sizes = {
    sm: '32px',
    md: '48px',
    lg: '64px'
  };

  const getInitials = useCallback((firstname, surname) => {
    return `${firstname?.[0] || ''}${surname?.[0] || ''}`.toUpperCase();
  }, []);

  const handleImageLoad = useCallback(() => {
    setIsLoaded(true);
    if (user?.profile_picture_url) {
      try {
        localStorage.setItem(`avatar_${user.id}`, user.profile_picture_url);
      } catch (e) {
        // LocalStorage might be full or disabled
      }
    }
  }, [user]);

  const avatarSrc = useMemo(() => {
    if (!user?.id) return null;
    try {
      return localStorage.getItem(`avatar_${user.id}`) || user?.profile_picture_url;
    } catch {
      return user?.profile_picture_url;
    }
  }, [user]);

  return (
    <div 
      className={`avatar avatar-${size} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      style={{ width: sizes[size], height: sizes[size] }}
    >
      {avatarSrc && !hasError ? (
        <>
          {!isLoaded && (
            <div className="avatar-placeholder">
              <div className="avatar-shimmer"></div>
            </div>
          )}
          <img
            src={avatarSrc}
            alt={`${user?.firstname} ${user?.surname}`}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className={`avatar-image ${isLoaded ? 'loaded' : 'loading'}`}
            onLoad={handleImageLoad}
            onError={() => setHasError(true)}
          />
        </>
      ) : (
        <div className="avatar-fallback">
          {getInitials(user?.firstname, user?.surname)}
        </div>
      )}
    </div>
  );
});
Avatar.displayName = 'Avatar';

// ProgressiveImage Component
const ProgressiveImage = React.memo(({ src, alt, className, priority = false }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src) return;
    
    const img = new Image();
    img.src = src;
    
    img.onload = () => {
      setIsLoaded(true);
      setHasError(false);
    };
    
    img.onerror = () => {
      setHasError(true);
      setIsLoaded(false);
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  if (!src) return null;

  return (
    <div 
      className={`image-container ${className || ''} ${isLoaded ? 'loaded' : 'loading'}`}
      data-priority={priority}
    >
      {!isLoaded && !hasError && (
        <div className="image-placeholder">
          <div className="image-shimmer"></div>
        </div>
      )}
      
      {hasError && (
        <div className="image-error">
          <ImageIcon size={32} />
          <span>Image failed to load</span>
        </div>
      )}
      
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        className={`actual-image ${isLoaded ? 'visible' : 'invisible'}`}
        style={{ opacity: isLoaded ? 1 : 0 }}
      />
    </div>
  );
});
ProgressiveImage.displayName = 'ProgressiveImage';

// Create Post Component - SEPARATED FOR PERFORMANCE
const CreatePost = React.memo(({ user, onCreatePost, isSubmitting }) => {
  const [content, setContent] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [visibility, setVisibility] = useState('public');
  const [charCount, setCharCount] = useState(0);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!content.trim() && !imageFile) {
      return;
    }
    
    const postData = {
      content: content.trim(),
      imageFile,
      visibility
    };
    
    onCreatePost(postData);
    
    // Reset form
    setContent('');
    setCharCount(0);
    setImagePreview(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Quick validation
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }
    
    // Create preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
    
    // Store file (compression happens later in main component)
    setImageFile(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleContentChange = (e) => {
    const value = e.target.value;
    if (value.length <= 2000) {
      setContent(value);
      setCharCount(value.length);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200; // Maximum height in pixels
      textareaRef.current.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    }
  }, [content]);

  if (!user) return null;

  return (
    <div className="create-post-card">
      <form onSubmit={handleSubmit} className="post-form">
        <div className="post-form-header">
          <Avatar user={user} size="md" priority />
          <div className="post-input-wrapper">
            <textarea
              ref={textareaRef}
              className="post-input"
              placeholder={`What's on your mind, ${user.firstname}?`}
              value={content}
              onChange={handleContentChange}
              rows="3"
              maxLength={2000}
              aria-label="Post content"
              disabled={isSubmitting}
            />
            <div className="input-footer">
              <div className="char-count">
                {charCount}/2000
              </div>
              <div className="visibility-selector">
                <select 
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  className="visibility-select"
                  aria-label="Post visibility"
                  disabled={isSubmitting}
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
              type="button"
              className="remove-image"
              onClick={removeImage}
              disabled={isSubmitting}
              aria-label="Remove image"
            >
              <X size={20} />
            </button>
          </div>
        )}

        <div className="post-form-actions">
          <div className="action-buttons">
            <button 
              type="button"
              className="action-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
              aria-label="Add photo"
            >
              <ImageIcon size={20} />
              <span>Photo</span>
            </button>
            
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              ref={fileInputRef}
              hidden
            />
          </div>
          <button
            type="submit"
            className={`post-submit-btn ${isSubmitting ? 'posting' : ''}`}
            disabled={(!content.trim() && !imageFile) || isSubmitting}
            aria-label="Post to feed"
          >
            {isSubmitting ? (
              <>
                <span className="spinner-small"></span>
                Posting...
              </>
            ) : 'Post'}
          </button>
        </div>
      </form>
    </div>
  );
});
CreatePost.displayName = 'CreatePost';

// PostCard Component
const PostCard = React.memo(({ 
  post, 
  currentUser, 
  onLike, 
  onComment, 
  formatTimeAgo, 
  onShare,
  onViewProfile,
  index,
  showToast
}) => {
  const [showComments, setShowComments] = useState(false);
  const [liked, setLiked] = useState(post.userHasLiked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [comments, setComments] = useState([]);
  const [commentCount, setCommentCount] = useState(post.comment_count || 0);
  const [commentInput, setCommentInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const commentInputRef = useRef(null);
  
  const needsExpansion = post.content?.length > 300 && !isExpanded;
  const displayContent = useMemo(() => 
    needsExpansion ? post.content.substring(0, 300) + '...' : post.content,
    [needsExpansion, post.content]
  );

  // Load comments when showComments changes to true
  useEffect(() => {
    const loadComments = async () => {
      if (showComments && comments.length === 0) {
        setLoadingComments(true);
        try {
          const { data, error } = await supabase
            .from('post_comments')
            .select(`
              *,
              users!post_comments_user_id_fkey (
                id,
                firstname,
                surname,
                profile_picture_url
              )
            `)
            .eq('post_id', post.id)
            .order('created_at', { ascending: true })
            .limit(50);

          if (error) throw error;

          const formattedComments = data.map(comment => ({
            ...comment,
            user: comment.users
          }));
          setComments(formattedComments);
        } catch (error) {
          console.error('Error loading comments:', error);
        } finally {
          setLoadingComments(false);
        }
      }
    };

    loadComments();
  }, [showComments, post.id]);

  const handleLike = async () => {
    if (!currentUser) {
      showToast('Please login to like posts', 'warning');
      return;
    }
    
    const previousLiked = liked;
    const previousCount = likeCount;
    
    // Optimistic update
    setLiked(!liked);
    setLikeCount(previousLiked ? previousCount - 1 : previousCount + 1);
    
    try {
      await onLike(post.id, previousLiked);
    } catch (error) {
      // Rollback on error
      setLiked(previousLiked);
      setLikeCount(previousCount);
      showToast('Failed to update like', 'error');
    }
  };

  const handleSubmitComment = async () => {
    if (!commentInput.trim() || !currentUser) return;
    
    const commentToSend = commentInput.trim();
    setCommentInput('');
    
    try {
      await onComment(post.id, commentToSend);
      
      // Optimistically add comment
      const optimisticComment = {
        id: Date.now().toString(),
        post_id: post.id,
        user_id: currentUser.id,
        content: commentToSend,
        created_at: new Date().toISOString(),
        user: {
          id: currentUser.id,
          firstname: currentUser.firstname,
          surname: currentUser.surname,
          profile_picture_url: currentUser.profile_picture_url
        }
      };
      
      setComments(prev => [...prev, optimisticComment]);
      setCommentCount(prev => prev + 1);
      
      // Refetch actual comments in background
      const { data } = await supabase
        .from('post_comments')
        .select(`
          *,
          users!post_comments_user_id_fkey (
            id,
            firstname,
            surname,
            profile_picture_url
          )
        `)
        .eq('post_id', post.id)
        .order('created_at', { ascending: true })
        .limit(50);

      if (data) {
        const formattedComments = data.map(comment => ({
          ...comment,
          user: comment.users
        }));
        setComments(formattedComments);
      }
      
    } catch (error) {
      // Error handled by parent
      setCommentInput(commentToSend); // Restore comment input
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitComment();
    }
  };

  const handleCommentClick = () => {
    setShowComments(!showComments);
    if (!showComments && commentInputRef.current) {
      setTimeout(() => {
        commentInputRef.current?.focus();
      }, 100);
    }
  };

  useEffect(() => {
    setLiked(post.userHasLiked);
    setLikeCount(post.like_count);
    setCommentCount(post.comment_count || 0);
  }, [post]);

  return (
    <article 
      className={`post-card ${index < 3 ? 'above-fold' : ''}`}
      data-post-id={post.id}
      data-index={index}
    >
      <div className="post-header">
        <div className="post-author">
          <Avatar 
            user={post.user}
            size="md"
            onClick={() => onViewProfile(post.user_id)}
            priority={index < 3}
          />
          <div className="author-info">
            <div className="author-name">
              <span onClick={() => onViewProfile(post.user_id)} className="author-name-link">
                {post.user?.firstname} {post.user?.surname}
              </span>
              {post.user_id === currentUser?.id && (
                <span className="you-badge">You</span>
              )}
            </div>
            <div className="author-details">
              {post.user?.university && (
                <span className="author-university">
                  {post.user.university}
                </span>
              )}
              {post.user?.program_field && (
                <span className="author-program">
                  • {post.user.program_field}
                </span>
              )}
              <span className="post-time">
                <Clock size={12} />
                {formatTimeAgo(post.created_at)}
              </span>
              <span className="post-visibility" title={`Visible to ${post.visibility}`}>
                {post.visibility === 'public' && <Globe size={12} />}
                {post.visibility === 'friends' && <Users size={12} />}
                {post.visibility === 'private' && <Lock size={12} />}
              </span>
            </div>
          </div>
        </div>
        
        <div className="post-menu">
          <button 
            className="post-menu-btn" 
            onClick={() => onShare(post)}
            aria-label="Share post"
          >
            <Share2 size={20} />
          </button>
          {post.user_id === currentUser?.id && (
            <button className="post-menu-btn" aria-label="More options">
              <MoreVertical size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="post-content">
        <p className="post-text">
          {displayContent}
          {needsExpansion && (
            <button 
              className="read-more-btn" 
              onClick={() => setIsExpanded(true)}
              aria-label="Read more"
            >
              Read more
            </button>
          )}
        </p>
        
        {post.image_url && (
          <div className="post-image-wrapper">
            <ProgressiveImage
              src={post.image_url}
              alt="Post image"
              className="post-image"
              priority={index < 3}
            />
          </div>
        )}
      </div>

      <div className="post-interactive-stats">
        <button 
          className={`stat-action-btn ${liked ? 'liked' : ''}`}
          onClick={handleLike}
          aria-label={liked ? 'Unlike post' : 'Like post'}
          title={liked ? 'Unlike' : 'Like'}
        >
          <div className="stat-action-content">
            <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
            {likeCount > 0 && (
              <span className="stat-count">{likeCount}</span>
            )}
          </div>
        </button>
        
        <button 
          className={`stat-action-btn ${showComments ? 'active' : ''}`}
          onClick={handleCommentClick}
          aria-label={showComments ? 'Hide comments' : 'Show comments'}
          title="Comments"
        >
          <div className="stat-action-content">
            <MessageCircle size={18} />
            {commentCount > 0 && (
              <span className="stat-count">{commentCount}</span>
            )}
          </div>
        </button>
        
        <button 
          className="stat-action-btn"
          onClick={() => onShare(post)}
          aria-label="Share post"
          title="Share"
        >
          <div className="stat-action-content">
            <Share2 size={18} />
            {(post.share_count || 0) > 0 && (
              <span className="stat-count">{post.share_count || 0}</span>
            )}
          </div>
        </button>
      </div>

      {currentUser && (
        <div className="comment-input-section">
          <div className="comment-input-wrapper">
            <Avatar user={currentUser} size="sm" priority />
            <div className="comment-input-container">
              <input
                ref={commentInputRef}
                type="text"
                className="comment-input"
                placeholder="Write a comment..."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyPress={handleKeyPress}
                aria-label="Comment input"
              />
              <button 
                className="comment-submit-btn"
                onClick={handleSubmitComment}
                disabled={!commentInput.trim()}
                aria-label="Submit comment"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {showComments && (
        <div className="comments-section">
          {loadingComments ? (
            <div className="comments-loading">
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          ) : comments.length > 0 ? (
            <>
              <div className="comments-header">
                <h4>Comments ({commentCount})</h4>
              </div>
              {comments.map((comment) => (
                <div key={comment.id} className="comment">
                  <Avatar user={comment.user} size="sm" />
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
            </>
          ) : (
            <div className="no-comments">
              <p>No comments yet. Be the first to comment!</p>
            </div>
          )}
        </div>
      )}
    </article>
  );
});
PostCard.displayName = 'PostCard';

// Main Feed Component - OPTIMIZED WITH LIKE PERSISTENCE FIX & INFINITE SCROLL FIX
const Feed = () => {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [error, setError] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  
  const feedRef = useRef(null);
  const sentinelRef = useRef(null);
  const postsPerPage = 10;
  const abortControllerRef = useRef(null);
  const observerRef = useRef(null);
  const isLoadingMore = useRef(false); // Track loading state to prevent multiple fetches

  // Show toast notification
  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  }, []);

  // Remove toast
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Get user data
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (error) throw error;
          setUser(profile);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        showToast('Error loading user profile', 'error');
      }
    };
    
    getUser();
  }, [showToast]);

  // Optimized fetch posts - FIXED LIKE PERSISTENCE
  const fetchPosts = useCallback(async (pageNum, isRefresh = false) => {
    if (isFetching || isLoadingMore.current) return;
    
    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setIsFetching(true);
    isLoadingMore.current = true;
    setError(null);
    
    try {
      const from = pageNum * postsPerPage;
      
      // Build base query
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
            program_field
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
          if (isRefresh) setPosts([]);
          setIsFetching(false);
          isLoadingMore.current = false;
          setHasMore(false);
          return;
        }
      }
      
      // Apply visibility filters
      if (user) {
        query = query.or(`visibility.eq.public,user_id.eq.${user.id}`);
      } else {
        query = query.eq('visibility', 'public');
      }
      
      const { data: postsData, error: postsError } = await query;
      
      if (postsError) throw postsError;
      
      // Check if there are more posts
      if (!postsData || postsData.length < postsPerPage) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      // Early return if no posts
      if (!postsData || postsData.length === 0) {
        if (isRefresh || pageNum === 0) {
          setPosts([]);
        }
        setIsFetching(false);
        isLoadingMore.current = false;
        return;
      }

      // Get all post IDs for batch queries
      const postIds = postsData.map(post => post.id);

      // Batch fetch likes - FIX: This is where the like data comes from
      const { data: likesData } = await supabase
        .from('post_likes')
        .select('post_id, user_id')
        .in('post_id', postIds);

      // Batch fetch comment counts
      const { data: commentCounts } = await supabase
        .from('post_comments')
        .select('post_id')
        .in('post_id', postIds);

      // Create a Set of post IDs that the current user has liked
      // This is the key fix for like persistence
      const userLikedPostIds = new Set();
      const likeCountsByPost = new Map();
      const commentCountsByPost = new Map();

      // Process likes data - FIX: Correctly track user likes and counts
      if (likesData) {
        likesData.forEach(like => {
          // Track if current user liked this post
          if (user && like.user_id === user.id) {
            userLikedPostIds.add(like.post_id);
          }
          
          // Count likes per post
          likeCountsByPost.set(
            like.post_id, 
            (likeCountsByPost.get(like.post_id) || 0) + 1
          );
        });
      }

      // Process comment counts
      if (commentCounts) {
        commentCounts.forEach(comment => {
          commentCountsByPost.set(
            comment.post_id,
            (commentCountsByPost.get(comment.post_id) || 0) + 1
          );
        });
      }

      // Process posts - FIX: Apply the correct userHasLiked value
      const processedPosts = postsData.map((post, index) => {
        return {
          ...post,
          user: post.users,
          // FIX: Correctly check if current user has liked this post using the Set
          userHasLiked: user ? userLikedPostIds.has(post.id) : false,
          like_count: likeCountsByPost.get(post.id) || 0,
          comment_count: commentCountsByPost.get(post.id) || 0,
          comments: [],
          isExpanded: false,
          showAllComments: false
        };
      });
      
      // Update posts state
      if (isRefresh || pageNum === 0) {
        setPosts(processedPosts);
      } else {
        // Filter out duplicates
        const existingPostIds = new Set(posts.map(p => p.id));
        const newPosts = processedPosts.filter(post => !existingPostIds.has(post.id));
        
        if (newPosts.length > 0) {
          setPosts(prev => [...prev, ...newPosts]);
        } else {
          setHasMore(false);
        }
      }
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching posts:', error);
        setError('Failed to load posts. Please try again.');
        showToast('Failed to load posts', 'error');
        setHasMore(false);
      }
    } finally {
      setIsFetching(false);
      isLoadingMore.current = false;
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [user, activeTab, isFetching, showToast, postsPerPage, posts]);

  // Initialize and reset when tab changes
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchPosts(0, true);
    
    // Cleanup observer when tab changes
    if (observerRef.current && sentinelRef.current) {
      observerRef.current.unobserve(sentinelRef.current);
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  }, [user, activeTab]);

  // Setup Intersection Observer for infinite scroll - FIXED
  useEffect(() => {
    if (!hasMore || isFetching || isLoadingMore.current) return;

    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    const options = {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    };

    const handleIntersection = (entries) => {
      const [entry] = entries;
      
      // Only fetch if we're intersecting and not already loading
      if (entry.isIntersecting && !isFetching && !isLoadingMore.current && hasMore) {
        // Update page state and fetch next page
        setPage(prevPage => {
          const nextPage = prevPage + 1;
          fetchPosts(nextPage, false);
          return nextPage;
        });
      }
    };

    const observer = new IntersectionObserver(handleIntersection, options);
    observerRef.current = observer;

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [hasMore, isFetching, fetchPosts]);

  // Optimized image compression (non-blocking)
  const compressImage = useCallback((file) => {
    return new Promise((resolve) => {
      // If file is small, return as is
      if (file.size <= 1024 * 1024) { // 1MB
        resolve(file);
        return;
      }
      
      // Use requestAnimationFrame to avoid blocking
      requestAnimationFrame(() => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onload = (e) => {
          const img = new Image();
          img.src = e.target.result;
          
          img.onload = () => {
            // Use setTimeout to yield to main thread
            setTimeout(() => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              
              let width = img.width;
              let height = img.height;
              const maxSize = 1200;
              
              if (width > height && width > maxSize) {
                height = (height * maxSize) / width;
                width = maxSize;
              } else if (height > maxSize) {
                width = (width * maxSize) / height;
                height = maxSize;
              }
              
              canvas.width = width;
              canvas.height = height;
              
              ctx.drawImage(img, 0, 0, width, height);
              
              canvas.toBlob((blob) => {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });
                resolve(compressedFile);
              }, 'image/jpeg', 0.8);
            }, 0);
          };
        };
      });
    });
  }, []);

  // Handle create post - OPTIMIZED VERSION
  const handleCreatePost = useCallback(async (postData) => {
    if (!user) {
      showToast('Please login to create a post', 'warning');
      return;
    }
    
    if (!postData.content.trim() && !postData.imageFile) {
      showToast('Please write something or add an image', 'warning');
      return;
    }
    
    setIsCreatingPost(true);
    
    try {
      let imageUrl = null;
      
      // Upload image if exists (non-blocking approach)
      if (postData.imageFile) {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(postData.imageFile.type)) {
          showToast('Invalid image format', 'error');
          setIsCreatingPost(false);
          return;
        }
        
        if (postData.imageFile.size > 50 * 1024 * 1024) {
          showToast('Image size should be less than 50MB', 'warning');
          setIsCreatingPost(false);
          return;
        }
        
        // Compress image if needed (non-blocking)
        const compressedFile = await compressImage(postData.imageFile);
        
        const sanitizedName = compressedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileExt = sanitizedName.split('.').pop().toLowerCase();
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `feed-images/${user.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('feed-images')
          .upload(filePath, compressedFile, {
            cacheControl: '3600',
            upsert: false
          });
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('feed-images')
          .getPublicUrl(filePath);
        
        imageUrl = publicUrl;
      }
      
      // Create post with minimal data first
      const { data: newPostData, error } = await supabase
        .from('feed_posts')
        .insert([{
          user_id: user.id,
          content: postData.content,
          image_url: imageUrl,
          visibility: postData.visibility,
          like_count: 0,
          comment_count: 0,
          share_count: 0
        }])
        .select('*')
        .single();
      
      if (error) throw error;
      
      // Create optimistic post
      const optimisticPost = {
        ...newPostData,
        user: {
          id: user.id,
          firstname: user.firstname,
          surname: user.surname,
          profile_picture_url: user.profile_picture_url,
          university: user.university,
          program_field: user.program_field
        },
        userHasLiked: false,
        like_count: 0,
        comment_count: 0,
        comments: [],
        isExpanded: false,
        showAllComments: false,
        isNewPost: true
      };
      
      // Optimistic update - add to beginning of posts
      setPosts(prev => [optimisticPost, ...prev]);
      showToast('Post published successfully!', 'success');
      
      // Refetch to get accurate counts (in background, non-blocking)
      setTimeout(() => {
        fetchPosts(0, true);
      }, 1000);
      
    } catch (error) {
      console.error('Error creating post:', error);
      showToast('Failed to create post. Please try again.', 'error');
    } finally {
      setIsCreatingPost(false);
    }
  }, [user, showToast, compressImage, fetchPosts]);

  // Handle like post
  const handleLikePost = useCallback(async (postId, currentlyLiked) => {
    if (!user) return;
    
    try {
      if (currentlyLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('post_likes')
          .insert([{
            post_id: postId,
            user_id: user.id,
            created_at: new Date().toISOString()
          }]);
      }
      
    } catch (error) {
      console.error('Error updating like:', error);
      showToast('Failed to update like', 'error');
    }
  }, [user, showToast]);

  // Handle add comment
  const handleAddComment = useCallback(async (postId, content) => {
    if (!user) {
      showToast('Please login to comment', 'warning');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('post_comments')
        .insert([{
          post_id: postId,
          user_id: user.id,
          content: content.trim()
        }]);
      
      if (error) throw error;

      showToast('Comment added!', 'success');
      
    } catch (error) {
      console.error('Error adding comment:', error);
      showToast('Failed to add comment', 'error');
      throw error;
    }
  }, [user, showToast]);

  // Format time ago
  const formatTimeAgo = useCallback((dateString) => {
    const postDate = new Date(dateString);
    const now = new Date();
    const diffMs = now - postDate;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);
    
    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHour < 24) return `${diffHour}h`;
    if (diffDay < 7) return `${diffDay}d`;
    if (diffWeek < 4) return `${diffWeek}w`;
    if (diffMonth < 12) return `${diffMonth}mo`;
    
    return postDate.toLocaleDateString('en-US', { 
      year: 'numeric',
      month: 'short', 
      day: 'numeric' 
    });
  }, []);

  // Handle share
  const handleShare = useCallback(async (post) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Check out this post',
          text: post.content?.substring(0, 100),
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showToast('Link copied to clipboard!', 'success');
      }
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error sharing:', error);
      }
    }
  }, [showToast]);

  // Handle view profile
  const handleViewProfile = useCallback((userId) => {
    window.location.href = `/profile/${userId}`;
  }, []);

  // Loading state
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

  // Error boundary catch
  if (error && posts.length === 0) {
    return (
      <div className="feed-container">
        <div className="error-state">
          <h3>Something went wrong</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="feed-container" ref={feedRef}>
        {/* Toast Container */}
        <div className="toast-container">
          {toasts.map(toast => (
            <Toast
              key={toast.id}
              message={toast.message}
              type={toast.type}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </div>

        {/* Header */}
        <div className="feed-header">
          <div className="header-content">
            <h1 className="feed-title">
              <span className="title-main">Campus Feed</span>
              <span className="title-sub">Connect with African Students in Russia</span>
            </h1>
            {user && (
              <div className="header-stats">
                <div className="stat-item">
                  <div className="stat-value">{posts.length}</div>
                  <div className="stat-label">Posts</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">
                    {posts.reduce((sum, post) => sum + (post.like_count || 0), 0)}
                  </div>
                  <div className="stat-label">Likes</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Create Post - Separated Component */}
        {user && (
          <CreatePost
            user={user}
            onCreatePost={handleCreatePost}
            isSubmitting={isCreatingPost}
          />
        )}

        {/* Feed Tabs */}
        <div className="feed-tabs">
          <button 
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
            aria-label="View all posts"
          >
            <Globe size={18} />
            <span>All Posts</span>
          </button>
          
          {user && (
            <>
              <button 
                className={`tab ${activeTab === 'following' ? 'active' : ''}`}
                onClick={() => setActiveTab('following')}
                aria-label="View posts from people you follow"
              >
                <Users size={18} />
                <span>Following</span>
              </button>
              
              <button 
                className={`tab ${activeTab === 'my' ? 'active' : ''}`}
                onClick={() => setActiveTab('my')}
                aria-label="View your posts"
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
                key={`${post.id}-${index}`}
                post={post}
                currentUser={user}
                onLike={handleLikePost}
                onComment={handleAddComment}
                formatTimeAgo={formatTimeAgo}
                onShare={handleShare}
                onViewProfile={handleViewProfile}
                showToast={showToast}
                index={index}
              />
            ))
          )}

          {/* Loading More Indicator */}
          {isFetching && posts.length > 0 && (
            <div className="loading-more">
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p>Loading more posts...</p>
            </div>
          )}

          {/* Sentinel for infinite scroll */}
          <div 
            ref={sentinelRef}
            className="loading-sentinel"
            aria-hidden="true"
          />

          {/* End of Feed */}
          {!hasMore && posts.length > 0 && (
            <div className="end-of-feed">
              <p>You're all caught up! 🎉</p>
              <small>No more posts to load</small>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default Feed;