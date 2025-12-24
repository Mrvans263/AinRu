import React, { useState, useEffect, useCallback } from 'react';
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

  // DEBUG: Log everything
  useEffect(() => {
    console.log('=== FEED DEBUG ===');
    console.log('User:', user?.id);
    console.log('Posts count:', posts.length);
    console.log('Loading:', loading);
  }, [user, posts, loading]);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      console.log('Fetching posts for user:', user.id);
      fetchPosts();
    }
  }, [user, activeTab]);

  const checkUser = async () => {
    console.log('Checking user session...');
    const { data: { session }, error } = await supabase.auth.getSession();
    console.log('Session:', session?.user?.id, 'Error:', error);
    setUser(session?.user || null);
  };

  const fetchPosts = async () => {
    console.log('=== FETCHING POSTS ===');
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

      // TEMPORARILY REMOVE FOLLOWING LOGIC
      if (activeTab === 'my' && user) {
        console.log('Filtering to my posts');
        query = query.eq('user_id', user.id);
      }

      // Apply privacy - SIMPLIFY FOR NOW
      if (user) {
        // Show public posts OR user's own posts
        query = query.or(`visibility.eq.public,user_id.eq.${user.id}`);
      } else {
        query = query.eq('visibility', 'public');
      }

      console.log('Executing query...');
      const { data, error, count } = await query.limit(20);
      
      if (error) {
        console.error('Query error:', error);
        throw error;
      }
      
      console.log('Fetched data:', data?.length, 'posts');
      console.log('Sample post:', data?.[0]);
      
      // Process posts
      const processedPosts = (data || []).map(post => {
        const processed = {
          ...post,
          userHasLiked: post.likes?.some(like => like.user_id === user?.id) || false,
          comments: post.comments?.slice(0, 3) || [],
          showAllComments: false,
          like_count: post.like_count || 0,
          comment_count: post.comment_count || 0,
          share_count: post.share_count || 0
        };
        console.log('Processed post:', processed.id, 'likes:', processed.like_count);
        return processed;
      });
      
      setPosts(processedPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
      alert(`Failed to load posts: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    console.log('=== CREATING POST ===');
    
    if (!newPost.trim() && !imageFile) {
      console.log('Empty post');
      alert('Please write something or add an image');
      return;
    }

    try {
      let imageUrl = null;
      
      // Upload image if exists - SKIP FOR NOW TO DEBUG
      if (imageFile) {
        console.log('Image upload skipped for debugging');
        // Temporarily skip image upload
      }

      console.log('Inserting post with:', {
        user_id: user.id,
        content: newPost.trim(),
        image_url: imageUrl,
        visibility: visibility,
        like_count: 0,
        comment_count: 0,
        share_count: 0
      });

      // Create post WITHOUT image for now
      const { data, error } = await supabase
        .from('feed_posts')
        .insert([{
          user_id: user.id,
          content: newPost.trim(),
          image_url: null, // No image for debugging
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

      if (error) {
        console.error('Insert error:', error);
        throw error;
      }

      console.log('Post created successfully:', data);

      // Add to posts list
      const newPostObj = {
        ...data,
        userHasLiked: false,
        likes: [],
        comments: [],
        showAllComments: false
      };
      
      setPosts(prev => [newPostObj, ...prev]);
      console.log('Updated posts list');

      // Reset form
      setNewPost('');
      setImagePreview(null);
      setImageFile(null);
      setVisibility('public');

    } catch (error) {
      console.error('Error creating post:', error);
      alert(`Failed to create post: ${error.message}`);
    }
  };

  const handleLikePost = async (postId, currentlyLiked) => {
    console.log('=== LIKING POST ===', { postId, currentlyLiked });
    
    if (!user) {
      alert('Please login to like posts');
      return;
    }

    try {
      if (currentlyLiked) {
        // Unlike
        console.log('Removing like...');
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Update like count
        await supabase
          .from('feed_posts')
          .update({ like_count: supabase.raw('like_count - 1') })
          .eq('id', postId);

      } else {
        // Like
        console.log('Adding like...');
        const { error } = await supabase
          .from('post_likes')
          .insert([{
            post_id: postId,
            user_id: user.id
          }]);

        if (error) throw error;

        // Update like count
        await supabase
          .from('feed_posts')
          .update({ like_count: supabase.raw('like_count + 1') })
          .eq('id', postId);
      }

      // Update local state
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          const newLikeCount = currentlyLiked ? post.like_count - 1 : post.like_count + 1;
          console.log('Updating post', postId, 'new like count:', newLikeCount);
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
      alert(`Like failed: ${error.message}`);
    }
  };

  const handleAddComment = async (postId, content) => {
    console.log('=== ADDING COMMENT ===', { postId, content });
    
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

      console.log('Comment created:', data);

      // Update comment count
      await supabase
        .from('feed_posts')
        .update({ comment_count: supabase.raw('comment_count + 1') })
        .eq('id', postId);

      // Update local state
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          console.log('Updating post', postId, 'comment count:', post.comment_count + 1);
          return {
            ...post,
            comment_count: post.comment_count + 1,
            comments: [data, ...(post.comments || [])]
          };
        }
        return post;
      }));

    } catch (error) {
      console.error('Error adding comment:', error);
      alert(`Failed to add comment: ${error.message}`);
    }
  };

  // ... keep the rest of your code (handleImageUpload, formatTimeAgo, etc.)

  // TEMPORARY: Add test buttons for debugging
  const testOperations = async () => {
    console.clear();
    console.log('=== MANUAL TESTS ===');
    
    // Test 1: Check if we can fetch users
    const { data: users } = await supabase
      .from('users')
      .select('id, firstname, surname')
      .limit(1);
    console.log('Users test:', users);
    
    // Test 2: Try to create a post directly
    const testPost = {
      user_id: user.id,
      content: 'MANUAL TEST POST',
      visibility: 'public',
      like_count: 0,
      comment_count: 0
    };
    
    const { data: post, error } = await supabase
      .from('feed_posts')
      .insert([testPost])
      .select()
      .single();
      
    console.log('Manual insert:', error ? `FAIL: ${error.message}` : `SUCCESS: ${post.id}`);
    
    if (post) {
      // Clean up
      await supabase.from('feed_posts').delete().eq('id', post.id);
    }
  };

  // In your JSX, add this button temporarily:
  // <button onClick={testOperations} style={{background: 'blue', color: 'white', padding: '10px', margin: '10px'}}>
  //   TEST OPERATIONS
  // </button>

  // ... rest of your JSX remains the same