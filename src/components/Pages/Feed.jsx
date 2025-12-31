import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Image as ImageIcon, 
  MapPin, 
  Globe, 
  Users, 
  Lock, 
  MoreVertical, 
  Send, 
  Clock, 
  TrendingUp,
  Bookmark,
  Eye,
  Filter,
  Hash,
  Flag,
  X,
  Award
} from 'lucide-react';
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
  const [isPosting, setIsPosting] = useState(false);
  
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchPosts();
    }
  }, [user, activeTab]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
    }
  };

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('feed_posts')
        .select(`
          *,
          user:users(id, firstname, lastname, avatar_url),
          post_likes(id, user_id),
          post_comments(
            id,
            content,
            created_at,
            user:users(id, firstname, lastname, avatar_url)
          )
        `)
        .order('created_at', { ascending: false });

      if (activeTab === 'my' && user) {
        query = query.eq('user_id', user.id);
      } else if (activeTab === 'following' && user) {
        // If you have a followers table, uncomment this:
        // const { data: following } = await supabase
        //   .from('user_follows')
        //   .select('following_id')
        //   .eq('follower_id', user.id);

        // if (following?.length > 0) {
        //   const followingIds = following.map(f => f.following_id);
        //   query = query.in('user_id', followingIds);
        // } else {
        //   setPosts([]);
        //   setLoading(false);
        //   return;
        // }
        
        // For now, show all posts if following tab is not implemented
        setPosts([]);
        setLoading(false);
        return;
      }

      if (user) {
        query = query.or(`visibility.eq.public,user_id.eq.${user.id}`);
      } else {
        query = query.eq('visibility', 'public');
      }

      const { data, error } = await query.limit(50);
      
      if (error) throw error;
      
      const processedPosts = (data || []).map((post) => ({
        ...post,
        userHasLiked: post.post_likes?.some(like => like.user_id === user?.id) || false,
        like_count: post.like_count || 0,
        comment_count: post.comment_count || 0,
        comments: post.post_comments?.slice(0, 3) || [],
        showAllComments: false,
        // Extract user details from the nested object
        user: post.user || null
      }));
      
      setPosts(processedPosts);
      setCommentInputs({});
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  }, [user, activeTab]);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim() && !imageFile) {
      alert('Please write something or add an image');
      return;
    }

    setIsPosting(true);
    
    try {
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
          comment_count: 0
        }])
        .select(`
          *,
          user:users(id, firstname, lastname, avatar_url)
        `)
        .single();

      if (error) throw error;

      setPosts(prev => [{
        ...data,
        userHasLiked: false,
        post_likes: [],
        post_comments: [],
        comments: [],
        comment_count: 0,
        isNew: true,
        user: data.user || null
      }, ...prev]);

      // Reset form
      setNewPost('');
      setImagePreview(null);
      setImageFile(null);
      setVisibility('public');
      
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post: ' + error.message);
    } finally {
      setIsPosting(false);
    }
  };

  const handleLikePost = async (postId, currentlyLiked) => {
    if (!user) {
      alert('Please login to like posts');
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

        // Update like count
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
        // Add like
        const { error } = await supabase
          .from('post_likes')
          .insert([{
            post_id: postId,
            user_id: user.id
          }]);

        if (error) throw error;

        // Update like count
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

      // Update local state
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          const newLikeCount = currentlyLiked ? 
            Math.max(0, (post.like_count || 0) - 1) : 
            (post.like_count || 0) + 1;
          
          return {
            ...post,
            like_count: newLikeCount,
            userHasLiked: !currentlyLiked
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
          user:users(id, firstname, lastname, avatar_url)
        `)
        .single();

      if (error) throw error;

      // Update comment count
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

      // Update local state
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

  const getInitials = (firstname, lastname) => {
    return `${firstname?.[0] || ''}${lastname?.[0] || ''}`.toUpperCase();
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
      <div className="feed-loading">
        <div className="loading-spinner"></div>
        <p>Loading community updates...</p>
      </div>
    );
  }

  return (
    <div className="feed-container">
      {/* Header */}
      <div className="feed-header">
        <div className="header-content">
          <h1>AinRu <span className="gradient-text">Community Feed</span></h1>
          <p className="header-subtitle">Connect with Africans in Russia</p>
        </div>
      </div>

      {/* Create Post - Only for logged in users */}
      {user && (
        <div className="create-post-card">
          <div className="post-form-header">
            <div className="user-avatar">
              {user?.user_metadata?.avatar_url ? (
                <img 
                  src={user.user_metadata.avatar_url} 
                  alt="Profile" 
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className="avatar-fallback">
                {getInitials(
                  user?.user_metadata?.firstname,
                  user?.user_metadata?.lastname || user?.user_metadata?.surname
                )}
              </div>
            </div>
            
            <div className="post-input-wrapper">
              <textarea
                ref={textareaRef}
                className="post-input"
                placeholder="Share what's happening... Ask questions, post opportunities, or share updates with the community"
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                rows="3"
              />
              
              <div className="post-options-row">
                <div className="post-actions-left">
                  <button 
                    className="action-btn"
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                  >
                    <ImageIcon size={18} />
                    <span>Media</span>
                  </button>
                  
                  <select 
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                    className="visibility-select"
                  >
                    <option value="public"><Globe size={14} /> Public</option>
                    <option value="friends"><Users size={14} /> Friends</option>
                    <option value="private"><Lock size={14} /> Private</option>
                  </select>
                </div>
                
                <div className="post-actions-right">
                  <div className="character-count">
                    {newPost.length}/500
                  </div>
                  <button
                    onClick={handleCreatePost}
                    disabled={(!newPost.trim() && !imageFile) || isPosting}
                    className="submit-btn"
                  >
                    {isPosting ? (
                      <>
                        <div className="spinner-small"></div>
                        Posting...
                      </>
                    ) : (
                      'Post'
                    )}
                  </button>
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
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden-input"
          />
        </div>
      )}

      {/* Feed Navigation */}
      <div className="feed-navigation">
        <div className="nav-tabs">
          <button 
            className={`nav-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <Globe size={18} />
            <span>All Posts</span>
          </button>
          
          {user && (
            <>
              <button 
                className={`nav-tab ${activeTab === 'following' ? 'active' : ''}`}
                onClick={() => setActiveTab('following')}
              >
                <Users size={18} />
                <span>Following</span>
              </button>
              
              <button 
                className={`nav-tab ${activeTab === 'my' ? 'active' : ''}`}
                onClick={() => setActiveTab('my')}
              >
                <Award size={18} />
                <span>My Posts</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Posts Feed */}
      <div className="posts-feed">
        {posts.length === 0 ? (
          <div className="empty-feed">
            <div className="empty-icon">📰</div>
            <h3>No posts yet</h3>
            <p>Be the first to share something with the community!</p>
            {!user && (
              <button 
                className="auth-cta"
                onClick={() => window.location.href = '/login'}
              >
                Join AinRu to Post
              </button>
            )}
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={user}
              onLike={handleLikePost}
              onComment={handleAddComment}
              formatTimeAgo={formatTimeAgo}
              getInitials={getInitials}
              commentInput={commentInputs[post.id] || ''}
              onCommentInputChange={(value) => handleCommentInputChange(post.id, value)}
              onKeyPress={(e) => handleKeyPress(e, post.id)}
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
  commentInput,
  onCommentInputChange,
  onKeyPress
}) => {
  const [showComments, setShowComments] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);
    await onLike(post.id, post.userHasLiked);
    setIsLiking(false);
  };

  const handleSubmitComment = async () => {
    if (!commentInput.trim()) return;
    await onComment(post.id, commentInput);
  };

  return (
    <div className={`post-card ${post.isNew ? 'new-post' : ''}`}>
      {/* Post Header */}
      <div className="post-header">
        <div className="post-author">
          <div className="author-avatar">
            {post.user?.avatar_url ? (
              <img 
                src={post.user.avatar_url} 
                alt={post.user.firstname}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div className="avatar-fallback">
              {getInitials(post.user?.firstname, post.user?.lastname || post.user?.surname)}
            </div>
          </div>
          
          <div className="author-info">
            <div className="author-name">
              <span className="name">
                {post.user?.firstname || 'User'} {post.user?.lastname || ''}
              </span>
              {post.user_id === currentUser?.id && (
                <span className="you-badge">You</span>
              )}
            </div>
            
            <div className="post-meta">
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

        <div className="post-actions-menu">
          <button 
            className="post-menu-btn"
            onClick={() => setShowOptions(!showOptions)}
          >
            <MoreVertical size={20} />
          </button>
          
          {showOptions && (
            <div className="dropdown-menu">
              {post.user_id === currentUser?.id && (
                <button className="dropdown-item delete">
                  Delete post
                </button>
              )}
              <button className="dropdown-item">
                <Flag size={16} />
                Report post
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Post Content */}
      <div className="post-content">
        <p className="post-text">{post.content}</p>
        
        {post.image_url && (
          <div className="post-media">
            <img 
              src={post.image_url} 
              alt="Post content"
              loading="lazy"
              className="post-image"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<div class="image-error">Image failed to load</div>';
              }}
            />
          </div>
        )}
      </div>

      {/* Post Stats */}
      <div className="post-stats-bar">
        <div className="stat-item">
          <Heart size={14} />
          <span>{post.like_count || 0} likes</span>
        </div>
        <div className="stat-item">
          <MessageCircle size={14} />
          <span>{post.comment_count || 0} comments</span>
        </div>
      </div>

      {/* Post Actions */}
      <div className="post-actions">
        <button 
          className={`action-btn ${post.userHasLiked ? 'active' : ''}`}
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

      {/* Comment Input */}
      {currentUser && (
        <div className="comment-input-section">
          <div className="comment-input-wrapper">
            <div className="comment-avatar">
              {currentUser?.user_metadata?.avatar_url ? (
                <img 
                  src={currentUser.user_metadata.avatar_url} 
                  alt="You"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className="avatar-fallback small">
                {getInitials(
                  currentUser?.user_metadata?.firstname,
                  currentUser?.user_metadata?.lastname || currentUser?.user_metadata?.surname
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
                onKeyPress={onKeyPress}
              />
              <button 
                className="comment-submit"
                onClick={handleSubmitComment}
                disabled={!commentInput.trim()}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments Section */}
      {showComments && post.comments && post.comments.length > 0 && (
        <div className="comments-section">
          {post.comments.map((comment) => (
            <div key={comment.id} className="comment">
              <div className="comment-avatar small">
                {comment.user?.avatar_url ? (
                  <img 
                    src={comment.user.avatar_url} 
                    alt={comment.user.firstname}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className="avatar-fallback small">
                  {getInitials(comment.user?.firstname, comment.user?.lastname || comment.user?.surname)}
                </div>
              </div>
              
              <div className="comment-content">
                <div className="comment-header">
                  <span className="comment-author">
                    {comment.user?.firstname} {comment.user?.lastname}
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