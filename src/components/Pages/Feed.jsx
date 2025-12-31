import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  supabase, 
  checkAuth, 
  uploadToStorage,
  subscribeToRealtime
} from '../../lib/supabase';
import {
  Heart,
  MessageCircle,
  Share2,
  Image as ImageIcon,
  Globe,
  Users,
  Lock,
  MoreVertical,
  Send,
  Clock,
  Bookmark,
  Eye,
  Filter,
  Hash,
  Flag,
  X,
  Award,
  TrendingUp,
  Zap,
  Sparkles,
  Bell,
  UserPlus,
  Video,
  FileText,
  MapPin,
  Smile,
  Gif,
  BarChart,
  Edit3,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Volume2,
  VolumeX
} from 'lucide-react';
import './Feed.css';

// Constants
const POST_VISIBILITY = {
  PUBLIC: 'public',
  FRIENDS: 'friends',
  PRIVATE: 'private'
};

const FEED_TABS = {
  ALL: 'all',
  FOLLOWING: 'following',
  MY_POSTS: 'my',
  TRENDING: 'trending',
  POPULAR: 'popular'
};

const Feed = () => {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [visibility, setVisibility] = useState(POST_VISIBILITY.PUBLIC);
  const [activeTab, setActiveTab] = useState(FEED_TABS.ALL);
  const [commentInputs, setCommentInputs] = useState({});
  const [isPosting, setIsPosting] = useState(false);
  const [showMutedPosts, setShowMutedPosts] = useState(false);
  const [pollData, setPollData] = useState({ question: '', options: ['', ''] });
  const [showPoll, setShowPoll] = useState(false);
  const [selectedHashtags, setSelectedHashtags] = useState([]);
  const [postMetrics, setPostMetrics] = useState({});
  const [lastPostId, setLastPostId] = useState(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const feedRef = useRef(null);
  const subscriptionRef = useRef(null);

  // User profile data
  const [userProfile, setUserProfile] = useState(null);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [trendingHashtags, setTrendingHashtags] = useState([]);

  useEffect(() => {
    initializeFeed();
    
    // Set up realtime subscription
    setupRealtimeSubscription();
    
    return () => {
      // Cleanup subscription
      if (subscriptionRef.current) {
        supabase.removeSubscription(subscriptionRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchPosts();
      fetchTrendingData();
    }
  }, [user, activeTab]);

  const initializeFeed = async () => {
    const { user: authUser, profile } = await checkAuth();
    if (authUser) {
      setUser(authUser);
      setUserProfile(profile);
    }
  };

  const setupRealtimeSubscription = () => {
    subscriptionRef.current = subscribeToRealtime(
      'feed_posts',
      handleRealtimeUpdate
    );
  };

  const handleRealtimeUpdate = (payload) => {
    const { eventType, new: newPost, old: oldPost } = payload;
    
    switch (eventType) {
      case 'INSERT':
        setPosts(prev => [formatPost(newPost), ...prev]);
        break;
      case 'UPDATE':
        setPosts(prev => prev.map(post => 
          post.id === newPost.id ? formatPost(newPost) : post
        ));
        break;
      case 'DELETE':
        setPosts(prev => prev.filter(post => post.id !== oldPost.id));
        break;
    }
  };

  const fetchPosts = useCallback(async (loadMore = false) => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      let query = supabase
        .from('feed_posts')
        .select(`
          *,
          user:users!user_id(
            id,
            firstname,
            surname,
            profile_picture_url,
            bio,
            university,
            city,
            verification_board
          ),
          post_likes(id, user_id),
          post_comments(
            id,
            content,
            created_at,
            like_count,
            user:users!user_id(
              id,
              firstname,
              surname,
              profile_picture_url
            )
          ),
          shares:share_count,
          views:view_count
        `)
        .order('created_at', { ascending: false })
        .limit(loadMore ? 10 : 20);

      // Apply filters based on active tab
      switch (activeTab) {
        case FEED_TABS.MY_POSTS:
          query = query.eq('user_id', user.id);
          break;
        case FEED_TABS.FOLLOWING:
          // Fetch followed users' posts
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
            setLoadingMore(false);
            return;
          }
          break;
        case FEED_TABS.TRENDING:
          query = query.gte('like_count', 10)
                      .gte('comment_count', 5);
          break;
        case FEED_TABS.POPULAR:
          query = query.gt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
                      .order('like_count', { ascending: false });
          break;
      }

      // Pagination for infinite scroll
      if (loadMore && lastPostId) {
        const { data: lastPost } = await supabase
          .from('feed_posts')
          .select('created_at')
          .eq('id', lastPostId)
          .single();

        if (lastPost) {
          query = query.lt('created_at', lastPost.created_at);
        }
      }

      // Apply visibility filter
      query = query.or(`visibility.eq.public,user_id.eq.${user.id}`);

      const { data, error } = await query;

      if (error) throw error;

      const processedPosts = (data || []).map(formatPost);

      if (loadMore) {
        setPosts(prev => [...prev, ...processedPosts]);
      } else {
        setPosts(processedPosts);
      }

      // Update pagination state
      if (data && data.length > 0) {
        setLastPostId(data[data.length - 1].id);
        setHasMorePosts(data.length === (loadMore ? 10 : 20));
      } else {
        setHasMorePosts(false);
      }

    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, activeTab, lastPostId]);

  const formatPost = (post) => {
    const hashtags = extractHashtags(post.content);
    const mentions = extractMentions(post.content);
    
    return {
      ...post,
      userHasLiked: post.post_likes?.some(like => like.user_id === user?.id) || false,
      userHasSaved: false, // Implement saved posts later
      like_count: post.like_count || 0,
      comment_count: post.comment_count || 0,
      share_count: post.share_count || 0,
      view_count: post.views || 0,
      comments: (post.post_comments || []).slice(0, 2),
      showAllComments: false,
      hashtags,
      mentions,
      isTrending: (post.like_count || 0) >= 20,
      isNew: Date.now() - new Date(post.created_at).getTime() < 24 * 60 * 60 * 1000,
      metrics: {
        engagementRate: calculateEngagementRate(post),
        estimatedReach: estimatePostReach(post)
      }
    };
  };

  const extractHashtags = (content) => {
    if (!content) return [];
    const hashtagRegex = /#(\w+)/g;
    return [...content.matchAll(hashtagRegex)].map(match => match[1]);
  };

  const extractMentions = (content) => {
    if (!content) return [];
    const mentionRegex = /@(\w+)/g;
    return [...content.matchAll(mentionRegex)].map(match => match[1]);
  };

  const calculateEngagementRate = (post) => {
    const totalEngagement = (post.like_count || 0) + (post.comment_count || 0) + (post.share_count || 0);
    return (totalEngagement / Math.max(post.view_count, 1)) * 100;
  };

  const estimatePostReach = (post) => {
    // Simple estimation based on engagement
    const baseReach = 100;
    const engagementMultiplier = 1 + (post.like_count || 0) * 0.1;
    return Math.round(baseReach * engagementMultiplier);
  };

  const fetchTrendingData = async () => {
    // Fetch trending hashtags
    const { data: hashtags } = await supabase
      .rpc('get_trending_hashtags', { days: 7 });

    setTrendingHashtags(hashtags || []);

    // Fetch suggested users
    const { data: suggestions } = await supabase
      .rpc('get_suggested_users', { current_user_id: user.id });

    setSuggestedUsers(suggestions || []);
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim() && !imageFile && !showPoll) {
      alert('Please add content to your post');
      return;
    }

    setIsPosting(true);
    
    try {
      let imageUrl = null;
      let pollOptions = null;
      
      if (imageFile) {
        imageUrl = await uploadToStorage(
          'feed-images',
          imageFile,
          `${user.id}/${Date.now()}`
        );
      }

      if (showPoll && pollData.question && pollData.options.filter(opt => opt.trim()).length >= 2) {
        pollOptions = {
          question: pollData.question,
          options: pollData.options.filter(opt => opt.trim()),
          votes: {}
        };
      }

      const postContent = newPost.trim();
      const hashtags = extractHashtags(postContent);
      const mentions = extractMentions(postContent);

      const { data, error } = await supabase
        .from('feed_posts')
        .insert([{
          user_id: user.id,
          content: postContent,
          image_url: imageUrl,
          visibility: visibility,
          like_count: 0,
          comment_count: 0,
          share_count: 0,
          poll_data: pollOptions,
          hashtags: hashtags,
          mentions: mentions
        }])
        .select(`
          *,
          user:users!user_id(
            id,
            firstname,
            surname,
            profile_picture_url
          )
        `)
        .single();

      if (error) throw error;

      // Reset form
      resetPostForm();

      // Show success message
      showNotification('Post published successfully!', 'success');

    } catch (error) {
      console.error('Error creating post:', error);
      showNotification('Failed to create post', 'error');
    } finally {
      setIsPosting(false);
    }
  };

  const resetPostForm = () => {
    setNewPost('');
    setImagePreview(null);
    setImageFile(null);
    setVisibility(POST_VISIBILITY.PUBLIC);
    setShowPoll(false);
    setPollData({ question: '', options: ['', ''] });
    setSelectedHashtags([]);
  };

  const showNotification = (message, type = 'info') => {
    // Implement notification system
    console.log(`${type}: ${message}`);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showNotification('Image size should be less than 10MB', 'warning');
      return;
    }

    if (!file.type.startsWith('image/')) {
      showNotification('Please upload an image file', 'warning');
      return;
    }

    setImageFile(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleLikePost = async (postId, currentlyLiked) => {
    if (!user) {
      showNotification('Please login to like posts', 'warning');
      return;
    }

    try {
      const likeEndpoint = currentlyLiked ? 'unlike' : 'like';
      const { error } = await supabase.rpc(likeEndpoint, {
        post_id: postId,
        user_id: user.id
      });

      if (error) throw error;

    } catch (error) {
      console.error('Error updating like:', error);
      showNotification('Like action failed', 'error');
    }
  };

  const handleAddComment = async (postId, content) => {
    if (!user) {
      showNotification('Please login to comment', 'warning');
      return;
    }

    if (!content.trim()) {
      showNotification('Please write a comment', 'warning');
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
          user:users!user_id(id, firstname, surname, profile_picture_url)
        `)
        .single();

      if (error) throw error;

      // Clear the input
      setCommentInputs(prev => ({
        ...prev,
        [postId]: ''
      }));

      showNotification('Comment added successfully!', 'success');

    } catch (error) {
      console.error('Error adding comment:', error);
      showNotification('Failed to add comment', 'error');
    }
  };

  const handleSharePost = async (postId) => {
    if (!user) {
      showNotification('Please login to share', 'warning');
      return;
    }

    try {
      const { error } = await supabase.rpc('share_post', {
        post_id: postId,
        user_id: user.id
      });

      if (error) throw error;

      showNotification('Post shared successfully!', 'success');

    } catch (error) {
      console.error('Error sharing post:', error);
      showNotification('Failed to share post', 'error');
    }
  };

  const handleSavePost = async (postId, currentlySaved) => {
    if (!user) {
      showNotification('Please login to save posts', 'warning');
      return;
    }

    try {
      if (currentlySaved) {
        await supabase
          .from('saved_posts')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('saved_posts')
          .insert([{
            post_id: postId,
            user_id: user.id
          }]);
      }

    } catch (error) {
      console.error('Error saving post:', error);
      showNotification('Failed to save post', 'error');
    }
  };

  const formatTimeAgo = (dateString) => {
    const postDate = new Date(dateString);
    const now = new Date();
    const diffMs = now - postDate;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffDay / 365);
    
    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHour < 24) return `${diffHour}h`;
    if (diffDay < 7) return `${diffDay}d`;
    if (diffWeek < 4) return `${diffWeek}w`;
    if (diffMonth < 12) return `${diffMonth}mo`;
    return `${diffYear}y`;
  };

  const getInitials = (firstname, surname) => {
    return `${firstname?.[0] || ''}${surname?.[0] || ''}`.toUpperCase();
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMorePosts) {
      fetchPosts(true);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setLastPostId(null);
    setPosts([]);
  };

  const renderFeedStats = useMemo(() => {
    if (!posts.length) return null;
    
    const totalPosts = posts.length;
    const totalLikes = posts.reduce((sum, post) => sum + (post.like_count || 0), 0);
    const totalComments = posts.reduce((sum, post) => sum + (post.comment_count || 0), 0);
    const avgEngagement = posts.reduce((sum, post) => sum + (post.metrics?.engagementRate || 0), 0) / totalPosts;

    return (
      <div className="feed-stats">
        <div className="stat-card">
          <span className="stat-label">Posts</span>
          <span className="stat-value">{totalPosts}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Likes</span>
          <span className="stat-value">{totalLikes.toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Comments</span>
          <span className="stat-value">{totalComments.toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Avg. Engagement</span>
          <span className="stat-value">{avgEngagement.toFixed(1)}%</span>
        </div>
      </div>
    );
  }, [posts]);

  if (loading && posts.length === 0) {
    return (
      <div className="feed-loading">
        <div className="loading-spinner-large"></div>
        <p>Loading community updates...</p>
      </div>
    );
  }

  return (
    <div className="feed-container" ref={feedRef}>
      {/* Header */}
      <div className="feed-header">
        <div className="header-content">
          <h1>AinRu <span className="gradient-text">Community Feed</span></h1>
          <p className="header-subtitle">Connect, Share & Grow with Africans in Russia</p>
        </div>
        
        {user && (
          <div className="header-actions">
            <button className="btn-notifications">
              <Bell size={20} />
              <span className="notification-badge">3</span>
            </button>
            <button className="btn-trending">
              <TrendingUp size={20} />
              <span>Trending</span>
            </button>
          </div>
        )}
      </div>

      {/* Feed Stats */}
      {renderFeedStats}

      {/* Main Content Grid */}
      <div className="feed-grid">
        {/* Left Sidebar - Suggestions */}
        {user && (
          <div className="feed-sidebar">
            <div className="sidebar-card user-card">
              <div className="user-info">
                <div className="user-avatar large">
                  {userProfile?.profile_picture_url ? (
                    <img 
                      src={userProfile.profile_picture_url} 
                      alt={userProfile.firstname}
                    />
                  ) : (
                    <div className="avatar-fallback">
                      {getInitials(userProfile?.firstname, userProfile?.surname)}
                    </div>
                  )}
                </div>
                <h3>{userProfile?.firstname} {userProfile?.surname}</h3>
                <p className="user-bio">{userProfile?.bio || 'AinRu Member'}</p>
                <div className="user-stats">
                  <span>{userProfile?.post_count || 0} Posts</span>
                  <span>{userProfile?.follower_count || 0} Followers</span>
                  <span>{userProfile?.following_count || 0} Following</span>
                </div>
              </div>
            </div>

            {/* Trending Hashtags */}
            <div className="sidebar-card trending-card">
              <h4><TrendingUp size={18} /> Trending Now</h4>
              <div className="trending-list">
                {trendingHashtags.slice(0, 5).map((tag, index) => (
                  <button 
                    key={tag.name}
                    className="trending-item"
                    onClick={() => setSelectedHashtags([...selectedHashtags, tag.name])}
                  >
                    <span className="trending-rank">#{index + 1}</span>
                    <div className="trending-info">
                      <span className="hashtag">#{tag.name}</span>
                      <span className="trending-count">{tag.count} posts</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Suggested Users */}
            <div className="sidebar-card suggestions-card">
              <h4><UserPlus size={18} /> Who to Follow</h4>
              <div className="suggestions-list">
                {suggestedUsers.slice(0, 3).map(suggestion => (
                  <div key={suggestion.id} className="suggestion-item">
                    <div className="suggestion-user">
                      <div className="user-avatar small">
                        {suggestion.profile_picture_url ? (
                          <img src={suggestion.profile_picture_url} alt={suggestion.firstname} />
                        ) : (
                          <div className="avatar-fallback">
                            {getInitials(suggestion.firstname, suggestion.surname)}
                          </div>
                        )}
                      </div>
                      <div className="suggestion-info">
                        <span className="suggestion-name">{suggestion.firstname} {suggestion.surname}</span>
                        <span className="suggestion-bio">{suggestion.university || 'AinRu Member'}</span>
                      </div>
                    </div>
                    <button className="btn-follow">Follow</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Feed */}
        <div className="feed-main">
          {/* Create Post - Only for logged in users */}
          {user && (
            <AdvancedPostCreator
              user={user}
              userProfile={userProfile}
              newPost={newPost}
              setNewPost={setNewPost}
              imagePreview={imagePreview}
              setImagePreview={setImagePreview}
              imageFile={imageFile}
              setImageFile={setImageFile}
              visibility={visibility}
              setVisibility={setVisibility}
              showPoll={showPoll}
              setShowPoll={setShowPoll}
              pollData={pollData}
              setPollData={setPollData}
              selectedHashtags={selectedHashtags}
              setSelectedHashtags={setSelectedHashtags}
              handleCreatePost={handleCreatePost}
              isPosting={isPosting}
              fileInputRef={fileInputRef}
              textareaRef={textareaRef}
              getInitials={getInitials}
              handleImageUpload={handleImageUpload}
            />
          )}

          {/* Feed Navigation */}
          <div className="feed-navigation">
            <div className="nav-tabs">
              <button 
                className={`nav-tab ${activeTab === FEED_TABS.ALL ? 'active' : ''}`}
                onClick={() => handleTabChange(FEED_TABS.ALL)}
              >
                <Globe size={18} />
                <span>All Posts</span>
              </button>
              
              {user && (
                <>
                  <button 
                    className={`nav-tab ${activeTab === FEED_TABS.FOLLOWING ? 'active' : ''}`}
                    onClick={() => handleTabChange(FEED_TABS.FOLLOWING)}
                  >
                    <Users size={18} />
                    <span>Following</span>
                    <span className="tab-badge">12</span>
                  </button>
                  
                  <button 
                    className={`nav-tab ${activeTab === FEED_TABS.MY_POSTS ? 'active' : ''}`}
                    onClick={() => handleTabChange(FEED_TABS.MY_POSTS)}
                  >
                    <Award size={18} />
                    <span>My Posts</span>
                  </button>
                  
                  <button 
                    className={`nav-tab ${activeTab === FEED_TABS.TRENDING ? 'active' : ''}`}
                    onClick={() => handleTabChange(FEED_TABS.TRENDING)}
                  >
                    <TrendingUp size={18} />
                    <span>Trending</span>
                    <span className="tab-badge hot">HOT</span>
                  </button>
                  
                  <button 
                    className={`nav-tab ${activeTab === FEED_TABS.POPULAR ? 'active' : ''}`}
                    onClick={() => handleTabChange(FEED_TABS.POPULAR)}
                  >
                    <Zap size={18} />
                    <span>Popular</span>
                  </button>
                </>
              )}
            </div>
            
            <div className="nav-filters">
              <select className="filter-select">
                <option>Sort by: Newest</option>
                <option>Sort by: Most Liked</option>
                <option>Sort by: Most Comments</option>
              </select>
              <button className="btn-filter">
                <Filter size={18} />
                <span>Filter</span>
              </button>
            </div>
          </div>

          {/* Posts Feed */}
          <div className="posts-feed">
            {posts.length === 0 ? (
              <EmptyFeedState 
                user={user} 
                activeTab={activeTab} 
                onPostClick={() => textareaRef.current?.focus()} 
              />
            ) : (
              <>
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUser={user}
                    onLike={handleLikePost}
                    onComment={handleAddComment}
                    onShare={handleSharePost}
                    onSave={handleSavePost}
                    formatTimeAgo={formatTimeAgo}
                    getInitials={getInitials}
                    commentInput={commentInputs[post.id] || ''}
                    onCommentInputChange={(value) => 
                      setCommentInputs(prev => ({ ...prev, [post.id]: value }))
                    }
                  />
                ))}
                
                {hasMorePosts && (
                  <div className="load-more-container">
                    <button 
                      className="btn-load-more"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? (
                        <>
                          <div className="spinner-small"></div>
                          Loading more posts...
                        </>
                      ) : (
                        'Load More Posts'
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Advanced Post Creator Component
const AdvancedPostCreator = ({
  user,
  userProfile,
  newPost,
  setNewPost,
  imagePreview,
  setImagePreview,
  imageFile,
  setImageFile,
  visibility,
  setVisibility,
  showPoll,
  setShowPoll,
  pollData,
  setPollData,
  selectedHashtags,
  setSelectedHashtags,
  handleCreatePost,
  isPosting,
  fileInputRef,
  textareaRef,
  getInitials,
  handleImageUpload
}) => {
  const [charCount, setCharCount] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);

  const handleTextChange = (e) => {
    const value = e.target.value;
    setNewPost(value);
    setCharCount(value.length);
  };

  const addPollOption = () => {
    if (pollData.options.length < 6) {
      setPollData({
        ...pollData,
        options: [...pollData.options, '']
      });
    }
  };

  const removePollOption = (index) => {
    if (pollData.options.length > 2) {
      const newOptions = [...pollData.options];
      newOptions.splice(index, 1);
      setPollData({
        ...pollData,
        options: newOptions
      });
    }
  };

  const updatePollOption = (index, value) => {
    const newOptions = [...pollData.options];
    newOptions[index] = value;
    setPollData({
      ...pollData,
      options: newOptions
    });
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageFile(null);
  };

  return (
    <div className="create-post-card advanced">
      <div className="post-form-header">
        <div className="user-avatar">
          {userProfile?.profile_picture_url ? (
            <img 
              src={userProfile.profile_picture_url} 
              alt="Profile" 
            />
          ) : (
            <div className="avatar-fallback">
              {getInitials(userProfile?.firstname, userProfile?.surname)}
            </div>
          )}
        </div>
        
        <div className="post-input-wrapper">
          <textarea
            ref={textareaRef}
            className="post-input advanced"
            placeholder="What's on your mind? Share updates, ask questions, or post opportunities..."
            value={newPost}
            onChange={handleTextChange}
            rows="4"
            maxLength={1000}
          />
          
          <div className="post-content-preview">
            {imagePreview && (
              <div className="image-preview">
                <img src={imagePreview} alt="Preview" />
                <button 
                  className="remove-image"
                  onClick={handleRemoveImage}
                >
                  <X size={20} />
                </button>
              </div>
            )}
            
            {showPoll && (
              <div className="poll-preview">
                <h4>Poll: {pollData.question || 'Your poll question'}</h4>
                <div className="poll-options">
                  {pollData.options.map((option, index) => (
                    <div key={index} className="poll-option">
                      <input
                        type="text"
                        placeholder={`Option ${index + 1}`}
                        value={option}
                        onChange={(e) => updatePollOption(index, e.target.value)}
                        className="poll-input"
                      />
                      {pollData.options.length > 2 && (
                        <button 
                          className="remove-option"
                          onClick={() => removePollOption(index)}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  {pollData.options.length < 6 && (
                    <button className="add-option" onClick={addPollOption}>
                      + Add Option
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Post Actions Bar */}
          <div className="post-actions-bar">
            <div className="actions-left">
              <button 
                className="action-btn"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <ImageIcon size={20} />
                <span>Photo/Video</span>
              </button>
              
              <button 
                className="action-btn"
                onClick={() => setShowPoll(!showPoll)}
              >
                <BarChart size={20} />
                <span>Poll</span>
              </button>
              
              <button 
                className="action-btn"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Smile size={20} />
                <span>Emoji</span>
              </button>
              
              <button 
                className="action-btn"
                onClick={() => setShowGifPicker(!showGifPicker)}
              >
                <Gif size={20} />
                <span>GIF</span>
              </button>
              
              <select 
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="visibility-select advanced"
              >
                <option value="public"><Globe size={16} /> Public</option>
                <option value="friends"><Users size={16} /> Friends</option>
                <option value="private"><Lock size={16} /> Private</option>
              </select>
            </div>
            
            <div className="actions-right">
              <div className="character-count">
                {charCount}/1000
              </div>
              <button
                onClick={handleCreatePost}
                disabled={(!newPost.trim() && !imageFile && !showPoll) || isPosting}
                className="submit-btn primary"
              >
                {isPosting ? (
                  <>
                    <div className="spinner-small"></div>
                    Publishing...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Publish
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleImageUpload}
        className="hidden-input"
        multiple
      />
      
      {/* Hashtag Suggestions */}
      <div className="hashtag-suggestions">
        <span className="suggestions-label">Popular hashtags:</span>
        {['#StudyInRussia', '#AfricanCommunity', '#StudentLife', '#Opportunities', '#Events'].map(tag => (
          <button 
            key={tag}
            className="hashtag-suggestion"
            onClick={() => setNewPost(prev => prev + ' ' + tag)}
          >
            {tag}
          </button>
        ))}
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
  onShare, 
  onSave,
  formatTimeAgo, 
  getInitials,
  commentInput,
  onCommentInputChange
}) => {
  const [showComments, setShowComments] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);
    await onLike(post.id, post.userHasLiked);
    setIsLiking(false);
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    await onSave(post.id, post.userHasSaved);
    setIsSaving(false);
  };

  const handleShare = async (platform = 'copy') => {
    if (isSharing) return;
    setIsSharing(true);
    
    try {
      if (platform === 'copy') {
        await navigator.clipboard.writeText(
          `${window.location.origin}/post/${post.id}`
        );
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        await onShare(post.id);
      }
      setShowShareMenu(false);
    } finally {
      setIsSharing(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!commentInput.trim()) return;
    await onComment(post.id, commentInput);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitComment();
    }
  };

  const isOwnPost = post.user_id === currentUser?.id;

  return (
    <div className={`post-card advanced ${post.isTrending ? 'trending' : ''} ${post.isNew ? 'new' : ''}`}>
      {/* Post Header */}
      <div className="post-header advanced">
        <div className="post-author">
          <div className="author-avatar">
            {post.user?.profile_picture_url ? (
              <img 
                src={post.user.profile_picture_url} 
                alt={post.user.firstname}
              />
            ) : (
              <div className="avatar-fallback">
                {getInitials(post.user?.firstname, post.user?.surname)}
              </div>
            )}
            {post.user?.verification_board && (
              <div className="verified-badge" title={`Verified ${post.user.verification_board}`}>
                <Check size={12} />
              </div>
            )}
          </div>
          
          <div className="author-info">
            <div className="author-main">
              <div className="author-name">
                <span className="name">
                  {post.user?.firstname} {post.user?.surname}
                </span>
                {isOwnPost && <span className="you-badge">You</span>}
                {post.user?.university && (
                  <span className="university-badge">
                    {post.user.university}
                  </span>
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
                {post.view_count > 0 && (
                  <span className="post-views">
                    <Eye size={12} />
                    {post.view_count.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            
            <div className="author-extra">
              {post.user?.city && (
                <span className="author-location">
                  <MapPin size={12} />
                  {post.user.city}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Post Actions Menu */}
        <div className="post-actions-menu">
          {isOwnPost && (
            <button 
              className="post-analytics-btn"
              onClick={() => setShowAnalytics(!showAnalytics)}
              title="View Analytics"
            >
              <BarChart size={18} />
            </button>
          )}
          
          <button 
            className="post-menu-btn"
            onClick={() => setShowOptions(!showOptions)}
          >
            <MoreVertical size={20} />
          </button>
          
          {showOptions && (
            <div className="dropdown-menu">
              {isOwnPost ? (
                <>
                  <button className="dropdown-item">
                    <Edit3 size={16} />
                    Edit post
                  </button>
                  <button className="dropdown-item delete">
                    <Trash2 size={16} />
                    Delete post
                  </button>
                  <button 
                    className="dropdown-item"
                    onClick={() => setShowAnalytics(true)}
                  >
                    <BarChart size={16} />
                    View analytics
                  </button>
                </>
              ) : (
                <>
                  <button className="dropdown-item">
                    <UserPlus size={16} />
                    Follow {post.user?.firstname}
                  </button>
                  <button className="dropdown-item">
                    <VolumeX size={16} />
                    Mute {post.user?.firstname}
                  </button>
                  <button className="dropdown-item report">
                    <Flag size={16} />
                    Report post
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Post Analytics (if shown) */}
      {showAnalytics && (
        <div className="post-analytics">
          <div className="analytics-header">
            <h4>Post Analytics</h4>
            <button onClick={() => setShowAnalytics(false)}>
              <X size={20} />
            </button>
          </div>
          <div className="analytics-grid">
            <div className="metric">
              <span className="metric-value">{post.like_count}</span>
              <span className="metric-label">Likes</span>
            </div>
            <div className="metric">
              <span className="metric-value">{post.comment_count}</span>
              <span className="metric-label">Comments</span>
            </div>
            <div className="metric">
              <span className="metric-value">{post.share_count}</span>
              <span className="metric-label">Shares</span>
            </div>
            <div className="metric">
              <span className="metric-value">{post.view_count}</span>
              <span className="metric-label">Views</span>
            </div>
            <div className="metric">
              <span className="metric-value">{post.metrics?.engagementRate?.toFixed(1)}%</span>
              <span className="metric-label">Engagement</span>
            </div>
            <div className="metric">
              <span className="metric-value">{post.metrics?.estimatedReach}</span>
              <span className="metric-label">Estimated Reach</span>
            </div>
          </div>
        </div>
      )}

      {/* Post Content */}
      <div className="post-content">
        <p className="post-text">
          {post.content}
        </p>
        
        {/* Hashtags */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="post-tags">
            {post.hashtags.map(tag => (
              <span key={tag} className="post-tag">
                <Hash size={12} />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Poll */}
        {post.poll_data && (
          <div className="post-poll">
            <h4>{post.poll_data.question}</h4>
            <div className="poll-options">
              {post.poll_data.options.map((option, index) => {
                const votes = post.poll_data.votes?.[index] || 0;
                const totalVotes = Object.values(post.poll_data.votes || {}).reduce((a, b) => a + b, 0);
                const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                
                return (
                  <div key={index} className="poll-option-result">
                    <div className="poll-option-text">
                      {option}
                      <span className="poll-percentage">{percentage.toFixed(0)}%</span>
                    </div>
                    <div className="poll-bar">
                      <div 
                        className="poll-fill"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="poll-votes">{votes} votes</span>
                  </div>
                );
              })}
            </div>
            <div className="poll-footer">
              <span>{Object.values(post.poll_data.votes || {}).reduce((a, b) => a + b, 0)} total votes</span>
              <button className="btn-vote">Vote</button>
            </div>
          </div>
        )}

        {/* Media */}
        {post.image_url && (
          <div className="post-media">
            <img 
              src={post.image_url} 
              alt="Post content"
              loading="lazy"
              className="post-image"
            />
          </div>
        )}
      </div>

      {/* Post Stats */}
      <div className="post-stats-bar advanced">
        <div className="stat-item">
          <Heart size={14} />
          <span>{post.like_count.toLocaleString()} likes</span>
        </div>
        <div className="stat-item">
          <MessageCircle size={14} />
          <span>{post.comment_count.toLocaleString()} comments</span>
        </div>
        <div className="stat-item">
          <Share2 size={14} />
          <span>{post.share_count.toLocaleString()} shares</span>
        </div>
        {post.metrics?.estimatedReach && (
          <div className="stat-item">
            <Eye size={14} />
            <span>~{post.metrics.estimatedReach.toLocaleString()} reach</span>
          </div>
        )}
      </div>

      {/* Post Actions */}
      <div className="post-actions advanced">
        <button 
          className={`action-btn like ${post.userHasLiked ? 'active' : ''}`}
          onClick={handleLike}
          disabled={isLiking}
        >
          <Heart size={20} fill={post.userHasLiked ? 'currentColor' : 'none'} />
          <span>Like</span>
          {post.userHasLiked && <span className="action-text">Liked</span>}
        </button>
        
        <button 
          className="action-btn comment"
          onClick={() => setShowComments(!showComments)}
        >
          <MessageCircle size={20} />
          <span>Comment</span>
        </button>
        
        <div className="share-container">
          <button 
            className="action-btn share"
            onClick={() => setShowShareMenu(!showShareMenu)}
            disabled={isSharing}
          >
            <Share2 size={20} />
            <span>Share</span>
          </button>
          
          {showShareMenu && (
            <div className="share-menu">
              <button 
                className="share-option"
                onClick={() => handleShare('copy')}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button className="share-option">
                <ExternalLink size={16} />
                Share to...
              </button>
            </div>
          )}
        </div>
        
        <button 
          className={`action-btn save ${post.userHasSaved ? 'active' : ''}`}
          onClick={handleSave}
          disabled={isSaving}
        >
          <Bookmark size={20} fill={post.userHasSaved ? 'currentColor' : 'none'} />
          <span>Save</span>
        </button>
      </div>

      {/* Comment Input */}
      {currentUser && (
        <div className="comment-input-section advanced">
          <div className="comment-input-wrapper">
            <div className="comment-avatar">
              {currentUser?.user_metadata?.avatar_url ? (
                <img 
                  src={currentUser.user_metadata.avatar_url} 
                  alt="You"
                />
              ) : (
                <div className="avatar-fallback small">
                  {getInitials(
                    currentUser?.user_metadata?.firstname,
                    currentUser?.user_metadata?.surname
                  )}
                </div>
              )}
            </div>
            
            <div className="comment-input-container">
              <input
                type="text"
                className="comment-input advanced"
                placeholder="Write a comment..."
                value={commentInput}
                onChange={(e) => onCommentInputChange(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <div className="comment-actions">
                <button className="comment-emoji">
                  <Smile size={18} />
                </button>
                <button 
                  className="comment-submit advanced"
                  onClick={handleSubmitComment}
                  disabled={!commentInput.trim()}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comments Section */}
      {showComments && post.comments && post.comments.length > 0 && (
        <div className="comments-section advanced">
          <div className="comments-header">
            <h4>Comments ({post.comment_count})</h4>
            <button className="btn-view-all">
              View all comments
            </button>
          </div>
          
          {post.comments.map((comment) => (
            <div key={comment.id} className="comment advanced">
              <div className="comment-avatar small">
                {comment.user?.profile_picture_url ? (
                  <img 
                    src={comment.user.profile_picture_url} 
                    alt={comment.user.firstname}
                  />
                ) : (
                  <div className="avatar-fallback small">
                    {getInitials(comment.user?.firstname, comment.user?.surname)}
                  </div>
                )}
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
                
                <div className="comment-actions">
                  <button className="comment-like">
                    <Heart size={14} />
                    <span>{comment.like_count || 0}</span>
                  </button>
                  <button className="comment-reply">Reply</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Empty Feed State Component
const EmptyFeedState = ({ user, activeTab, onPostClick }) => {
  const getEmptyMessage = () => {
    if (!user) {
      return {
        title: "Welcome to AinRu Community!",
        message: "Join our community of Africans in Russia to connect, share experiences, and find opportunities.",
        cta: "Sign up to get started"
      };
    }
    
    switch (activeTab) {
      case FEED_TABS.FOLLOWING:
        return {
          title: "No posts from people you follow",
          message: "Start following more community members to see their posts here.",
          cta: "Discover people to follow"
        };
      case FEED_TABS.MY_POSTS:
        return {
          title: "You haven't posted yet",
          message: "Share your first post with the community! Ask questions, share updates, or post opportunities.",
          cta: "Create your first post"
        };
      case FEED_TABS.TRENDING:
        return {
          title: "No trending posts right now",
          message: "Be the first to create a trending post! Share something valuable with the community.",
          cta: "Create a post"
        };
      default:
        return {
          title: "No posts yet",
          message: "Be the first to share something with the community!",
          cta: "Create the first post"
        };
    }
  };

  const emptyState = getEmptyMessage();

  return (
    <div className="empty-feed advanced">
      <div className="empty-illustration">
        <Sparkles size={64} />
      </div>
      <h3>{emptyState.title}</h3>
      <p>{emptyState.message}</p>
      {user ? (
        <button className="btn-primary" onClick={onPostClick}>
          {emptyState.cta}
        </button>
      ) : (
        <button 
          className="btn-primary"
          onClick={() => window.location.href = '/signup'}
        >
          {emptyState.cta}
        </button>
      )}
    </div>
  );
};

export default Feed;