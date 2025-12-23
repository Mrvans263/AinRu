import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import './Marketplace.css';

const Marketplace = () => {
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [categories, setCategories] = useState([
    'Textbooks',
    'Electronics',
    'Furniture',
    'Clothing',
    'Services',
    'Transportation',
    'Housing',
    'Other'
  ]);
  
  // Filter states
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState([0, 1000]);
  const [conditionFilter, setConditionFilter] = useState('All');
  
  // New item form state
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    price: '',
    category: 'Textbooks',
    condition: 'Good',
    location: '',
    university: '',
    contact_email: '',
    contact_phone: '',
    is_negotiable: true
  });
  const [itemImages, setItemImages] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [currentUser, setCurrentUser] = useState(null); // Track current user

  // Fetch current user and marketplace items
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);
        
        // Fetch marketplace items
        await fetchMarketplaceItems();
      } catch (error) {
        console.error('Error initializing data:', error);
        setMessage({ type: 'error', text: 'Failed to load data' });
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, []);

  // Apply filters whenever filters change
  useEffect(() => {
    applyFilters();
  }, [items, selectedCategory, searchQuery, priceRange, conditionFilter]);

  const fetchMarketplaceItems = async () => {
    try {
      setLoading(true);
      
      // Get all marketplace items
      const { data, error } = await supabase
        .from('marketplace_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Add placeholder user info and ownership flag
      const itemsWithOwnership = (data || []).map(item => ({
        ...item,
        profiles: {
          firstname: 'User',
          surname: '',
          avatar_url: null
        },
        isOwner: currentUser && item.user_id === currentUser.id // Add ownership flag
      }));

      setItems(itemsWithOwnership);
      setFilteredItems(itemsWithOwnership);
    } catch (error) {
      console.error('Error fetching marketplace items:', error);
      setMessage({ type: 'error', text: 'Failed to load marketplace items' });
    } finally {
      setLoading(false);
    }
  };

  // Update items with ownership when user changes
  useEffect(() => {
    if (currentUser && items.length > 0) {
      const updatedItems = items.map(item => ({
        ...item,
        isOwner: item.user_id === currentUser.id
      }));
      setItems(updatedItems);
      setFilteredItems(updatedItems);
    }
  }, [currentUser]);

  const applyFilters = () => {
    let filtered = [...items];

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query)) ||
        (item.location && item.location.toLowerCase().includes(query))
      );
    }

    // Filter by price range
    filtered = filtered.filter(item => {
      const price = item.price || 0;
      return price >= priceRange[0] && price <= priceRange[1];
    });

    // Filter by condition
    if (conditionFilter !== 'All') {
      filtered = filtered.filter(item => item.condition === conditionFilter);
    }

    setFilteredItems(filtered);
  };

  const handleImageUpload = async (files) => {
    const newFiles = Array.from(files);
    
    // Validate files
    for (const file of newFiles) {
      if (!file.type.startsWith('image/')) {
        setMessage({ type: 'error', text: 'Please upload only image files (JPEG, PNG, GIF, WebP)' });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Image size must be less than 5MB' });
        return;
      }
    }
    
    // Create preview URLs for local display
    const newImagePreviews = newFiles.map(file => URL.createObjectURL(file));
    
    setImageFiles(prev => [...prev, ...newFiles]);
    setItemImages(prev => [...prev, ...newImagePreviews]);
  };

  const uploadImagesToStorage = async () => {
    const uploadedImageUrls = [];
    
    for (const file of imageFiles) {
      try {
        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('marketplace-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) {
          console.error('Error uploading image:', error);
          continue;
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('marketplace-images')
          .getPublicUrl(fileName);
        
        uploadedImageUrls.push(publicUrl);
      } catch (error) {
        console.error('Image upload error:', error);
      }
    }
    
    return uploadedImageUrls;
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      if (!currentUser) {
        setMessage({ type: 'error', text: 'You must be logged in to create an item' });
        return;
      }

      // Validate required fields
      if (!newItem.title.trim() || !newItem.description.trim() || !newItem.price) {
        setMessage({ type: 'error', text: 'Please fill in all required fields' });
        return;
      }

      const priceValue = parseFloat(newItem.price);
      if (isNaN(priceValue) || priceValue < 0) {
        setMessage({ type: 'error', text: 'Please enter a valid price' });
        return;
      }

      // Upload images if any
      let uploadedImageUrls = [];
      if (imageFiles.length > 0) {
        setUploading(true);
        uploadedImageUrls = await uploadImagesToStorage();
        setUploading(false);
      }

      // Create item in database
      const { data, error } = await supabase
        .from('marketplace_items')
        .insert([{
          user_id: currentUser.id,
          title: newItem.title.trim(),
          description: newItem.description.trim(),
          price: priceValue,
          category: newItem.category,
          condition: newItem.condition,
          images: uploadedImageUrls,
          location: newItem.location.trim(),
          university: newItem.university.trim(),
          contact_email: newItem.contact_email.trim(),
          contact_phone: newItem.contact_phone.trim(),
          is_negotiable: newItem.is_negotiable
        }])
        .select()
        .single();

      if (error) throw error;

      // Clean up preview URLs
      itemImages.forEach(url => URL.revokeObjectURL(url));

      // Reset form and close
      setNewItem({
        title: '',
        description: '',
        price: '',
        category: 'Textbooks',
        condition: 'Good',
        location: '',
        university: '',
        contact_email: '',
        contact_phone: '',
        is_negotiable: true
      });
      setItemImages([]);
      setImageFiles([]);
      setShowCreateForm(false);
      setMessage({ type: 'success', text: 'Item listed successfully!' });

      // Refresh items list
      fetchMarketplaceItems();
      
    } catch (error) {
      console.error('Error creating item:', error);
      setMessage({ 
        type: 'error', 
        text: 'Failed to create item. Please try again.' 
      });
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    try {
      if (!currentUser) {
        setMessage({ type: 'error', text: 'You must be logged in to delete items' });
        return;
      }

      // First, get the item to check if it has images to delete
      const { data: item } = await supabase
        .from('marketplace_items')
        .select('images')
        .eq('id', itemId)
        .single();

      // Delete images from storage if they exist
      if (item && item.images && item.images.length > 0) {
        for (const imageUrl of item.images) {
          try {
            // Extract filename from URL
            const urlParts = imageUrl.split('/');
            const fileName = urlParts[urlParts.length - 1];
            
            await supabase.storage
              .from('marketplace-images')
              .remove([fileName]);
          } catch (storageError) {
            console.warn('Could not delete image from storage:', storageError);
          }
        }
      }

      // Delete item from database
      const { error } = await supabase
        .from('marketplace_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', currentUser.id); // Only delete if user owns the item

      if (error) throw error;

      setMessage({ type: 'success', text: 'Item deleted successfully!' });
      fetchMarketplaceItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      setMessage({ type: 'error', text: 'Failed to delete item. You may not own this item.' });
    }
  };

  const handleMarkAsSold = async (itemId) => {
    try {
      if (!currentUser) {
        setMessage({ type: 'error', text: 'You must be logged in to update items' });
        return;
      }

      const { error } = await supabase
        .from('marketplace_items')
        .update({ is_sold: true })
        .eq('id', itemId)
        .eq('user_id', currentUser.id); // Only update if user owns the item

      if (error) throw error;

      setMessage({ type: 'success', text: 'Item marked as sold!' });
      fetchMarketplaceItems();
    } catch (error) {
      console.error('Error marking item as sold:', error);
      setMessage({ type: 'error', text: 'Failed to update item. You may not own this item.' });
    }
  };

  // Format price
  const formatPrice = (price) => {
    if (!price && price !== 0) return 'Free';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  // Get condition badge color
  const getConditionColor = (condition) => {
    const colors = {
      'New': 'condition-new',
      'Like New': 'condition-like-new',
      'Good': 'condition-good',
      'Fair': 'condition-fair',
      'Poor': 'condition-poor'
    };
    return colors[condition] || 'condition-default';
  };

  const handleRemoveImage = (index) => {
    // Revoke the object URL to prevent memory leaks
    URL.revokeObjectURL(itemImages[index]);
    
    const newImages = [...itemImages];
    const newFiles = [...imageFiles];
    
    newImages.splice(index, 1);
    newFiles.splice(index, 1);
    
    setItemImages(newImages);
    setImageFiles(newFiles);
  };

  // Get the user's email for contact (if they're logged in)
  const getUserContactInfo = async () => {
    if (currentUser && currentUser.email && !newItem.contact_email) {
      setNewItem(prev => ({ ...prev, contact_email: currentUser.email }));
    }
  };

  // Get user contact info when opening form
  useEffect(() => {
    if (showCreateForm) {
      getUserContactInfo();
    }
  }, [showCreateForm, currentUser]);

  if (loading && items.length === 0) {
    return (
      <div className="marketplace-container">
        <div className="loading">Loading marketplace...</div>
      </div>
    );
  }

  return (
    <div className="marketplace-container">
      {/* Header */}
      <div className="marketplace-header">
        <h1 className="marketplace-title">Student Marketplace</h1>
        <p className="marketplace-subtitle">Buy and sell items within your campus community</p>
        
        {currentUser ? (
          <button 
            className="create-item-btn"
            onClick={() => setShowCreateForm(true)}
            disabled={loading}
          >
            + List New Item
          </button>
        ) : (
          <p className="login-prompt">Please log in to list items</p>
        )}
      </div>

      {/* Message Display */}
      {message.text && (
        <div className={`message message-${message.type}`}>
          {message.text}
          <button 
            className="message-close"
            onClick={() => setMessage({ type: '', text: '' })}
          >
            ×
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="filters-grid">
          {/* Search */}
          <div className="filter-group">
            <label className="filter-label">Search</label>
            <input
              type="text"
              className="search-input"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <div className="filter-group">
            <label className="filter-label">Category</label>
            <select
              className="filter-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              disabled={loading}
            >
              <option value="All">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Condition Filter */}
          <div className="filter-group">
            <label className="filter-label">Condition</label>
            <select
              className="filter-select"
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value)}
              disabled={loading}
            >
              <option value="All">All Conditions</option>
              <option value="New">New</option>
              <option value="Like New">Like New</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Poor">Poor</option>
            </select>
          </div>

          {/* Price Range */}
          <div className="filter-group">
            <label className="filter-label">Price Range: ${priceRange[0]} - ${priceRange[1]}</label>
            <div className="price-slider">
              <input
                type="range"
                min="0"
                max="1000"
                step="10"
                value={priceRange[0]}
                onChange={(e) => setPriceRange([parseInt(e.target.value), priceRange[1]])}
                className="range-input"
                disabled={loading}
              />
              <input
                type="range"
                min="0"
                max="1000"
                step="10"
                value={priceRange[1]}
                onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                className="range-input"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="results-count">
          Showing {filteredItems.length} of {items.length} items
          {selectedCategory !== 'All' && ` in ${selectedCategory}`}
        </div>
      </div>

      {/* Create Item Modal */}
      {showCreateForm && currentUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>List New Item</h2>
              <button 
                className="close-btn"
                onClick={() => {
                  if (!uploading && !loading) {
                    // Clean up preview URLs
                    itemImages.forEach(url => URL.revokeObjectURL(url));
                    setShowCreateForm(false);
                  }
                }}
                disabled={uploading || loading}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="create-form">
              <div className="form-grid">
                {/* Title */}
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newItem.title}
                    onChange={(e) => setNewItem({...newItem, title: e.target.value})}
                    placeholder="What are you selling?"
                    required
                    disabled={loading}
                  />
                </div>

                {/* Price */}
                <div className="form-group">
                  <label className="form-label">Price ($) *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newItem.price}
                    onChange={(e) => setNewItem({...newItem, price: e.target.value})}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    required
                    disabled={loading}
                  />
                </div>

                {/* Category */}
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select
                    className="form-input"
                    value={newItem.category}
                    onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                    required
                    disabled={loading}
                  >
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                {/* Condition */}
                <div className="form-group">
                  <label className="form-label">Condition</label>
                  <select
                    className="form-input"
                    value={newItem.condition}
                    onChange={(e) => setNewItem({...newItem, condition: e.target.value})}
                    disabled={loading}
                  >
                    <option value="New">New</option>
                    <option value="Like New">Like New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                  </select>
                </div>

                {/* Location */}
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newItem.location}
                    onChange={(e) => setNewItem({...newItem, location: e.target.value})}
                    placeholder="Where is the item located?"
                    disabled={loading}
                  />
                </div>

                {/* University */}
                <div className="form-group">
                  <label className="form-label">University</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newItem.university}
                    onChange={(e) => setNewItem({...newItem, university: e.target.value})}
                    placeholder="Your university"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea
                  className="form-textarea"
                  value={newItem.description}
                  onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                  placeholder="Describe your item in detail..."
                  rows="4"
                  required
                  disabled={loading}
                />
              </div>

              {/* Images Upload */}
              <div className="form-group">
                <label className="form-label">Images (Optional)</label>
                <div className="image-upload-area">
                  <input
                    type="file"
                    id="item-images"
                    className="image-input"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleImageUpload(e.target.files)}
                    disabled={uploading || loading}
                  />
                  <label htmlFor="item-images" className="upload-label">
                    {uploading ? 'Uploading...' : 'Choose Images (max 5MB each)'}
                  </label>
                  <p className="upload-hint">You can upload up to 5 images</p>
                  {itemImages.length > 0 && (
                    <div className="image-preview">
                      {itemImages.map((img, index) => (
                        <div key={index} className="preview-item">
                          <img src={img} alt={`Preview ${index}`} />
                          <button
                            type="button"
                            className="remove-image-btn"
                            onClick={() => handleRemoveImage(index)}
                            disabled={loading}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Contact Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={newItem.contact_email}
                    onChange={(e) => setNewItem({...newItem, contact_email: e.target.value})}
                    placeholder="your.email@example.com"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Phone</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={newItem.contact_phone}
                    onChange={(e) => setNewItem({...newItem, contact_phone: e.target.value})}
                    placeholder="(123) 456-7890"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Negotiable Checkbox */}
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newItem.is_negotiable}
                    onChange={(e) => setNewItem({...newItem, is_negotiable: e.target.checked})}
                    disabled={loading}
                  />
                  <span>Price is negotiable</span>
                </label>
              </div>

              {/* Form Actions */}
              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    // Clean up preview URLs
                    itemImages.forEach(url => URL.revokeObjectURL(url));
                    setShowCreateForm(false);
                  }}
                  disabled={loading || uploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading || uploading}
                >
                  {loading ? 'Listing...' : 'List Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Items Grid */}
      <div className="items-grid">
        {filteredItems.length === 0 ? (
          <div className="no-items">
            <p>No items found. Try adjusting your filters or be the first to list an item!</p>
            {currentUser && (
              <button 
                className="create-item-btn"
                onClick={() => setShowCreateForm(true)}
                style={{ marginTop: '1rem' }}
              >
                + List Your First Item
              </button>
            )}
          </div>
        ) : (
          filteredItems.map(item => {
            const isOwner = item.isOwner;
            
            return (
              <div key={item.id} className={`item-card ${item.is_sold ? 'sold' : ''}`}>
                {/* Item Images */}
                {item.images && item.images.length > 0 && item.images[0] ? (
                  <div className="item-images">
                    <img src={item.images[0]} alt={item.title} className="item-image" />
                    {item.images.length > 1 && (
                      <div className="image-count">+{item.images.length - 1}</div>
                    )}
                  </div>
                ) : (
                  <div className="item-image-placeholder">
                    <span>📷 No Image</span>
                  </div>
                )}

                {/* Sold Badge */}
                {item.is_sold && (
                  <div className="sold-badge">SOLD</div>
                )}

                {/* Item Info */}
                <div className="item-info">
                  <div className="item-header">
                    <h3 className="item-title">{item.title}</h3>
                    <div className="item-price">{formatPrice(item.price)}</div>
                  </div>

                  <div className="item-meta">
                    <span className={`condition-badge ${getConditionColor(item.condition)}`}>
                      {item.condition}
                    </span>
                    <span className="item-category">{item.category}</span>
                    {item.is_negotiable && (
                      <span className="negotiable-badge">Negotiable</span>
                    )}
                    {isOwner && (
                      <span className="owner-badge">Your Item</span>
                    )}
                  </div>

                  <p className="item-description">
                    {item.description && item.description.length > 150 
                      ? `${item.description.substring(0, 150)}...` 
                      : item.description}
                  </p>

                  <div className="item-footer">
                    <div className="item-location">
                      <span>📍 {item.location || 'Campus Area'}</span>
                      {item.university && <span>• {item.university}</span>}
                    </div>
                    
                    <div className="item-seller">
                      <div className="seller-info">
                        <span>👤 {isOwner ? 'You' : 'Seller'}</span>
                      </div>
                      <span className="item-date">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="item-actions">
                    <button 
                      className="contact-btn"
                      onClick={() => {
                        if (item.contact_email) {
                          window.location.href = `mailto:${item.contact_email}?subject=Interested in ${encodeURIComponent(item.title)}`;
                        } else if (item.contact_phone) {
                          window.location.href = `tel:${item.contact_phone}`;
                        } else {
                          setMessage({ type: 'error', text: 'No contact information available for this item' });
                        }
                      }}
                      disabled={isOwner} // Disable contact button for owner's own items
                    >
                      {isOwner ? 'Your Item' : 'Contact Seller'}
                    </button>
                    
                    {/* Only show sold and delete buttons to owner */}
                    {isOwner && !item.is_sold && (
                      <button 
                        className="sold-btn"
                        onClick={() => handleMarkAsSold(item.id)}
                      >
                        Mark as Sold
                      </button>
                    )}
                    
                    {isOwner && (
                      <button 
                        className="delete-btn"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Marketplace;