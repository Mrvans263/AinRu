import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
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
    setUser(session?.user || null);
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
      
      const processedPosts = (data || []).map(post => ({
        ...post,
        userHasLiked: post.likes?.some(like => like.user_id === user?.id) || false,
        comments: post.comments?.slice(0, 3) || [],
        showAllComments: false
      }));
      
      setPosts(processedPosts);
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
  isNewPost: true // Add this flag
}, ...prev]);


      setNewPost('');
      setImagePreview(null);
      setImageFile(null);
      setVisibility('public');

    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post: ' + error.message);
    }
  };

  const handleLikePost = async (postId, currentlyLiked) => {
    if (!user) {
      alert('Please login to love posts');
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
      console.error('Error updating love:', error);
      alert('Love action failed: ' + error.message);
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
            comments: [data, ...(post.comments || [])]
          };
        }
        return post;
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
  // Parse as UTC (Supabase stores in UTC)
  const postDate = new Date(dateString + 'Z'); // Add 'Z' to force UTC
  
  const now = new Date();
  const diffMs = now - postDate;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  // For debugging
  console.log('Time calculation:', {
    input: dateString,
    parsed: postDate.toISOString(),
    now: now.toISOString(),
    diffHours: diffHour,
    diffMinutes: diffMin
  });
  
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  
  // For older posts, show local date
  return postDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: diffDay > 365 ? 'numeric' : undefined
  });
};
  const getInitials = (firstname, surname) => {
    return `${firstname?.[0] || ''}${surname?.[0] || ''}`.toUpperCase();
  };

  if (loading && posts.length === 0) {
    return (
      <div className="feed-container">
        <div className="loading">Loading feed...</div>
      </div>
    );
  }

  return (
    <div className="feed-container">
      <div className="feed-header">
        <h1>📰 Campus Feed</h1>
        <p>Share updates, connect with students</p>
      </div>

      {user && (
        <div className="create-post-card">
          <div className="post-form-header">
            <div className="user-avatar">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="Profile" />
              ) : (
                <div className="avatar-fallback">
                  {getInitials(user?.user_metadata?.firstname, user?.user_metadata?.surname)}
                </div>
              )}
            </div>
            <div className="user-info">
              <div className="user-name">
                {user?.user_metadata?.firstname || 'User'} {user?.user_metadata?.surname || ''}
              </div>
              <select 
                className="visibility-select"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
              >
                <option value="public">🌍 Public</option>
                <option value="friends">👥 Friends Only</option>
                <option value="private">🔒 Only Me</option>
              </select>
            </div>
          </div>

          <form onSubmit={handleCreatePost}>
            <textarea
              className="post-input"
              placeholder="What's on your mind?"
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              rows="3"
            />

            {imagePreview && (
              <div className="image-preview">
                <img src={imagePreview} alt="Preview" />
                <button 
                  type="button" 
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
                <label className="upload-btn">
                  📷 Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    hidden
                  />
                </label>
                <button type="button" className="emoji-btn">😊 Feeling</button>
                <button type="button" className="location-btn">📍 Location</button>
              </div>
              <button 
                type="submit" 
                className="post-btn"
                disabled={!newPost.trim() && !imageFile}
              >
                Post
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="feed-tabs">
        <button 
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          🌐 All Posts
        </button>
        {user && (
          <>
            <button 
              className={`tab-btn ${activeTab === 'following' ? 'active' : ''}`}
              onClick={() => setActiveTab('following')}
            >
              👥 Following
            </button>
            <button 
              className={`tab-btn ${activeTab === 'my' ? 'active' : ''}`}
              onClick={() => setActiveTab('my')}
            >
              📝 My Posts
            </button>
          </>
        )}
      </div>

      <div className="posts-feed">
        {posts.length === 0 ? (
          <div className="no-posts">
            <h3>No posts yet</h3>
            <p>Be the first to share something!</p>
          </div>
        ) : (
          posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={user}
              onLove={handleLikePost}
              onComment={handleAddComment}
              formatTimeAgo={formatTimeAgo}
              getInitials={getInitials}
            />
          ))
        )}
      </div>
    </div>
  );
};

const PostCard = ({ post, currentUser, onLove, onComment, formatTimeAgo, getInitials }) => {
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [isLoving, setIsLoving] = useState(false);

  const handleLove = async () => {
    if (isLoving) return;
    setIsLoving(true);
    await onLove(post.id, post.userHasLiked);
    setIsLoving(false);
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    
    await onComment(post.id, commentText);
    setCommentText('');
    setShowComments(true);
  };

  return (
    <div className={`post-card ${post.isNewPost ? 'new-post' : ''}`}>
      <div className="post-header">
        <div className="post-author">
          <div className="author-avatar">
            {post.user?.profile_picture_url ? (
              <img src={post.user.profile_picture_url} alt={post.user.firstname} />
            ) : (
              <div className="avatar-fallback">
                {getInitials(post.user?.firstname, post.user?.surname)}
              </div>
            )}
          </div>
          <div className="author-info">
            <div className="author-name">
              {post.user?.firstname || 'User'} {post.user?.surname || ''}
            </div>
            <div className="post-meta">
              <span className="post-time">{formatTimeAgo(post.created_at)}</span>
              <span className="post-visibility">
                {post.visibility === 'public' && '🌍'}
                {post.visibility === 'friends' && '👥'}
                {post.visibility === 'private' && '🔒'}
              </span>
            </div>
          </div>
        </div>
        
        {post.user_id === currentUser?.id && (
          <button className="post-menu">⋯</button>
        )}
      </div>

      <div className="post-content">
        <p>{post.content}</p>
        
        {post.image_url && (
          <div className="post-image">
            <img src={post.image_url} alt="Post" />
          </div>
        )}
      </div>

      <div className="post-stats">
        <div className="stat-item">
          <span className="stat-icon"></span>
          <span className="stat-count">{post.like_count || 0}</span>
        </div>
        <div className="stat-item">
          <span className="stat-icon"></span>
          <span className="stat-count">{post.comment_count || 0}</span>
        </div>
        <div className="stat-item">
          <span className="stat-icon"></span>
          <span className="stat-count">{post.share_count || 0}</span>
        </div>
      </div>

      <div className="post-actions-bar">
        <button 
          className={`post-action-btn ${post.userHasLiked ? 'loved' : ''}`}
          onClick={handleLove}
          disabled={isLoving}
        >
          <span className="action-icon">❤️</span>
          <span className="action-text">{post.userHasLiked ? 'Loved' : 'Love'}</span>
        </button>
        
        <button 
          className="post-action-btn"
          onClick={() => setShowComments(!showComments)}
        >
          <span className="action-icon">💬</span>
          <span className="action-text">Comment</span>
        </button>
        
        <button className="post-action-btn">
          <span className="action-icon">↪️</span>
          <span className="action-text">Share</span>
        </button>
      </div>

      <div className="comments-section">
        {currentUser && (
          <form className="add-comment-form" onSubmit={handleSubmitComment}>
            <div className="comment-avatar">
              {currentUser?.user_metadata?.avatar_url ? (
                <img src={currentUser.user_metadata.avatar_url} alt="You" />
              ) : (
                <div className="avatar-fallback small">
                  {getInitials(
                    currentUser?.user_metadata?.firstname,
                    currentUser?.user_metadata?.surname
                  )}
                </div>
              )}
            </div>
            <div className="comment-input-group">
              <input
                type="text"
                className="comment-input"
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <button type="submit" className="comment-submit" disabled={!commentText.trim()}>
                Post
              </button>
            </div>
          </form>
        )}

        {showComments && post.comments && post.comments.length > 0 && (
          <div className="comments-list">
            {post.comments.map(comment => (
              <div key={comment.id} className="comment-item">
                <div className="comment-avatar small">
                  {comment.user?.profile_picture_url ? (
                    <img src={comment.user.profile_picture_url} alt={comment.user.firstname} />
                  ) : (
                    <div className="avatar-fallback small">
                      {getInitials(comment.user?.firstname, comment.user?.surname)}
                    </div>
                  )}
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
                    <button className="comment-like">Like</button>
                    <button className="comment-reply">Reply</button>
                  </div>
                </div>
              </div>
            ))}
            
            {post.comment_count > post.comments.length && (
              <button className="view-more-comments">
                View all {post.comment_count} comments
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Feed;