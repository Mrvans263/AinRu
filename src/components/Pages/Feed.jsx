import React, { useState, useEffect, useCallback } from 'react';
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
  Users as UsersIcon,
  Award,
  X,
  Loader2
} from 'lucide-react';

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

  const fetchPosts = useCallback(async () => {
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

        if (following?.length > 0) {
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
      
      const processedPosts = (data || []).map((post) => ({
        ...post,
        userHasLiked: post.likes?.some(like => like.user_id === user?.id) || false,
        comments: post.comments?.slice(0, 3) || [],
        showAllComments: false
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
    if (!newPost.trim() && !imageFile) return;

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
        isNew: true
      }, ...prev]);

      setNewPost('');
      setImagePreview(null);
      setImageFile(null);
      setVisibility('public');
      
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setIsPosting(false);
    }
  };

  const handleLikePost = async (postId, currentlyLiked) => {
    if (!user) return;

    try {
      if (currentlyLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        await supabase.rpc('decrement_like_count', { post_id: postId });

      } else {
        await supabase
          .from('post_likes')
          .insert([{
            post_id: postId,
            user_id: user.id
          }]);

        await supabase.rpc('increment_like_count', { post_id: postId });
      }

      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          const newLikeCount = currentlyLiked ? 
            Math.max(0, post.like_count - 1) : 
            post.like_count + 1;
          
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
    }
  };

  const handleAddComment = async (postId, content) => {
    if (!user || !content.trim()) return;

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

      await supabase.rpc('increment_comment_count', { post_id: postId });

      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comment_count: (post.comment_count || 0) + 1,
            comments: [data, ...(post.comments || [])]
          };
        }
        return post;
      }));

      setCommentInputs(prev => ({
        ...prev,
        [postId]: ''
      }));

    } catch (error) {
      console.error('Error adding comment:', error);
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          <p className="mt-2 text-gray-500">Loading feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Campus Feed</h1>
        <p className="text-gray-600 mt-1">Connect with your campus community</p>
      </div>

      {/* Create Post */}
      {user && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                {getInitials(
                  user?.user_metadata?.firstname,
                  user?.user_metadata?.surname
                )}
              </div>
            </div>
            
            <div className="flex-1">
              <textarea
                className="w-full border-0 focus:ring-0 resize-none text-gray-900 placeholder-gray-500 text-base"
                placeholder="What's happening on campus?"
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                rows="3"
              />
              
              {imagePreview && (
                <div className="relative mt-3 rounded-lg overflow-hidden">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="w-full max-h-96 object-cover"
                  />
                  <button
                    type="button"
                    className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white"
                    onClick={() => {
                      setImagePreview(null);
                      setImageFile(null);
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                    <ImageIcon size={20} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  
                  <select 
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                    className="text-sm border-0 bg-gray-50 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="public"><Globe size={14} className="inline mr-1" /> Public</option>
                    <option value="friends"><Users size={14} className="inline mr-1" /> Friends</option>
                    <option value="private"><Lock size={14} className="inline mr-1" /> Private</option>
                  </select>
                </div>

                <button
                  onClick={handleCreatePost}
                  disabled={(!newPost.trim() && !imageFile) || isPosting}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg font-medium hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isPosting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Posting...
                    </>
                  ) : (
                    'Post'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'all' 
              ? 'bg-blue-50 text-blue-600 border border-blue-100' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
          onClick={() => setActiveTab('all')}
        >
          All
        </button>
        
        {user && (
          <>
            <button
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'following' 
                  ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('following')}
            >
              Following
            </button>
            <button
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'my' 
                  ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('my')}
            >
              My Posts
            </button>
          </>
        )}
      </div>

      {/* Feed */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <div className="text-gray-400 mb-3">📰</div>
            <h3 className="text-gray-900 font-medium mb-1">No posts yet</h3>
            <p className="text-gray-500 text-sm mb-4">Be the first to share something!</p>
            {!user && (
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                onClick={() => window.location.href = '/login'}
              >
                Sign in to post
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
  const [isLiking, setIsLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);

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
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${post.isNew ? 'border-blue-300' : ''}`}>
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                {post.user?.profile_picture_url ? (
                  <img 
                    src={post.user.profile_picture_url} 
                    alt={post.user.firstname}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  getInitials(post.user?.firstname, post.user?.surname)
                )}
              </div>
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">
                  {post.user?.firstname || 'User'} {post.user?.surname || ''}
                </span>
                {post.user_id === currentUser?.id && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    You
                  </span>
                )}
                <span className="text-gray-500 text-sm flex items-center gap-1">
                  <Clock size={12} />
                  {formatTimeAgo(post.created_at)}
                </span>
              </div>
              
              <div className="flex items-center gap-2 mt-1">
                {post.visibility === 'public' && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Globe size={12} /> Public
                  </span>
                )}
                {post.visibility === 'friends' && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Users size={12} /> Friends only
                  </span>
                )}
                {post.visibility === 'private' && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Lock size={12} /> Private
                  </span>
                )}
              </div>
            </div>
          </div>

          {post.user_id === currentUser?.id && (
            <button className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
              <MoreVertical size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="mt-4">
          <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>
          
          {post.image_url && (
            <div className="mt-4 rounded-lg overflow-hidden">
              <img 
                src={post.image_url} 
                alt="Post content" 
                className="w-full max-h-[500px] object-cover"
                loading="lazy"
              />
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <Heart size={14} className={post.userHasLiked ? 'fill-red-500 text-red-500' : ''} />
            <span>{post.like_count || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageCircle size={14} />
            <span>{post.comment_count || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <Share2 size={14} />
            <span>{post.share_count || 0}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-1 mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={handleLike}
            disabled={isLiking}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg transition-colors font-medium ${
              post.userHasLiked 
                ? 'text-red-600 bg-red-50 hover:bg-red-100' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Heart size={18} fill={post.userHasLiked ? 'currentColor' : 'none'} />
            Like
          </button>
          
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center justify-center gap-2 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-medium"
          >
            <MessageCircle size={18} />
            Comment
          </button>
          
          <button className="flex items-center justify-center gap-2 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-medium">
            <Share2 size={18} />
            Share
          </button>
        </div>
      </div>

      {/* Comment Input */}
      {currentUser && (
        <div className="border-t border-gray-100 p-5">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                {getInitials(
                  currentUser?.user_metadata?.firstname,
                  currentUser?.user_metadata?.surname
                )}
              </div>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Write a comment..."
                  value={commentInput}
                  onChange={(e) => onCommentInputChange(e.target.value)}
                  onKeyPress={(e) => onKeyPress(e)}
                />
                
                <button
                  onClick={handleSubmitComment}
                  disabled={!commentInput.trim()}
                  className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comments */}
      {showComments && post.comments && post.comments.length > 0 && (
        <div className="border-t border-gray-100">
          {post.comments.map((comment) => (
            <div key={comment.id} className="p-5 hover:bg-gray-50 transition-colors">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                    {comment.user?.profile_picture_url ? (
                      <img 
                        src={comment.user.profile_picture_url} 
                        alt={comment.user.firstname}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      getInitials(comment.user?.firstname, comment.user?.surname)
                    )}
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {comment.user?.firstname || 'User'} {comment.user?.surname || ''}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {formatTimeAgo(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-gray-800 mt-1">{comment.content}</p>
                </div>
              </div>
            </div>
          ))}
          
          {post.comment_count > post.comments.length && (
            <button className="w-full text-center py-3 text-sm text-blue-600 hover:text-blue-700 hover:bg-gray-50 border-t border-gray-100">
              View all {post.comment_count} comments
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Feed;