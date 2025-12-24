import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import './Marketplace.css';

const Marketplace = () => {
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Filters - RUB is first in all selects
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    currency: '',
    minPrice: '',
    maxPrice: '',
    condition: '',
    negotiable: '',
    sortBy: 'newest'
  });

  // Fetch user and data
  useEffect(() => {
    fetchUserAndData();
  }, []);

  // Fetch listings when filters change
  useEffect(() => {
    fetchListings();
  }, [filters]);

  const fetchUserAndData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      
      // Fetch categories
      const { data: categoriesData } = await supabase
        .from('marketplace_categories')
        .select('*')
        .order('name');
      setCategories(categoriesData || []);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  };

 const fetchListings = async () => {
  setLoading(true);
  
  try {
    console.log('🔍 [DEBUG] Step 1: Testing basic users query...');
    
    // Test if we can query users directly
    const { data: testUsers, error: usersError } = await supabase
      .from('users')
      .select('id, firstname, surname, email, phone, avatar_url')
      .limit(2);
    
    console.log('Users direct query:', usersError ? `❌ ${usersError.message}` : `✅ ${testUsers?.length} users found`);
    
    // Test a simple join
    console.log('🔍 [DEBUG] Step 2: Testing simple join...');
    const simpleJoin = await supabase
      .from('marketplace_listings')
      .select(`
        *,
        users!inner(id, firstname, surname)
      `)
      .eq('status', 'active')
      .limit(2);
    
    console.log('Simple join result:', simpleJoin);
    
    if (simpleJoin.error) {
      console.log('❌ Simple join failed, trying different syntax...');
      
      // Try alternative syntax
      const altJoin = await supabase
        .from('marketplace_listings')
        .select(`
          *,
          user:users(id, firstname, surname)
        `)
        .eq('status', 'active')
        .limit(2);
      
      console.log('Alternative join:', altJoin);
      
      if (altJoin.error) {
        throw altJoin.error;
      }
      
      console.log('✅ Alternative join worked! Using this syntax.');
      
      // Now build the full query with working syntax
      let query = supabase
        .from('marketplace_listings')
        .select(`
          *,
          category:marketplace_categories(name, icon),
          images:listing_images(image_url, is_primary),
          user:users(id, firstname, surname, email, phone, avatar_url),
          saves:listing_saves(count)
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
        
      // ... apply your filters ...
      
      const { data, error } = await query;
      
      if (error) throw error;
      setListings(data);
      
    } else {
      // The original syntax works
      console.log('✅ Original syntax works, building full query...');
      
      let query = supabase
        .from('marketplace_listings')
        .select(`
          *,
          category:marketplace_categories(*),
          images:listing_images(*),
          users!inner(*),
          saves:listing_saves(count)
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
        
      // ... apply your filters ...
      
      const { data, error } = await query;
      
      if (error) throw error;
      setListings(data);
    }
    
  } catch (error) {
    console.error('❌ Final error:', error);
    setMessage({ type: 'error', text: `Failed to load listings: ${error.message}` });
  } finally {
    setLoading(false);
  }
};

  const handleMarkAsSold = async (listingId) => {
    try {
      const { error } = await supabase
        .from('marketplace_listings')
        .update({ status: 'sold' })
        .eq('id', listingId)
        .eq('user_id', user.id);

      if (error) throw error;

      setListings(listings.map(listing => 
        listing.id === listingId 
          ? { ...listing, status: 'sold' }
          : listing
      ));
      setMessage({ type: 'success', text: 'Marked as sold!' });
      
    } catch (error) {
      console.error('Error marking as sold:', error);
      setMessage({ type: 'error', text: 'Failed to update listing' });
    }
  };

  const handleContactSeller = (listing, method) => {
    const seller = listing.user;
    
    switch (method) {
      case 'email':
        window.location.href = `mailto:${seller.email}?subject=Regarding your listing: ${listing.title}`;
        break;
        
      case 'telegram':
        if (seller.phone) {
          // Clean phone number for Telegram
          const cleanPhone = seller.phone.replace(/\D/g, '');
          window.open(`https://t.me/+${cleanPhone}`, '_blank');
        } else {
          alert('Seller has not provided a phone number for Telegram');
        }
        break;
        
      case 'whatsapp':
        if (seller.phone) {
          const message = encodeURIComponent(`Hi, I'm interested in your listing: ${listing.title}`);
          window.open(`https://wa.me/${seller.phone}?text=${message}`, '_blank');
        } else {
          alert('Seller has not provided a phone number for WhatsApp');
        }
        break;
        
      case 'in_app':
        alert('In-app messaging feature coming soon!');
        if (seller.phone) {
          const confirmContact = window.confirm(
            `Contact seller directly:\n\nName: ${seller.firstname} ${seller.surname}\nPhone: ${seller.phone}\n\nWould you like to copy the phone number?`
          );
          if (confirmContact) {
            navigator.clipboard.writeText(seller.phone);
            alert('Phone number copied to clipboard!');
          }
        }
        break;
        
      default:
        if (listing.contact_info) {
          alert(`Contact seller at: ${listing.contact_info}`);
        } else if (seller.email) {
          window.location.href = `mailto:${seller.email}`;
        } else {
          alert('No contact information available');
        }
    }
  };

  const formatPrice = (price, currency = 'RUB') => {
    const currencyConfigs = {
      'RUB': {
        locale: 'ru-RU',
        options: {
          style: 'currency',
          currency: 'RUB',
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        },
        symbol: '₽'
      },
      'USD': {
        locale: 'en-US',
        options: {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        },
        symbol: '$'
      },
      'ZAR': {
        locale: 'en-ZA',
        options: {
          style: 'currency',
          currency: 'ZAR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        },
        symbol: 'R'
      }
    };
    
    const config = currencyConfigs[currency] || currencyConfigs['RUB'];
    
    try {
      return new Intl.NumberFormat(config.locale, config.options).format(price);
    } catch (error) {
      return `${config.symbol} ${price.toFixed(2)}`;
    }
  };

  const getCurrencyFlag = (currency) => {
    const flags = {
      'RUB': '🇷🇺',
      'USD': '🇺🇸', 
      'ZAR': '🇿🇦'
    };
    return flags[currency] || '🇷🇺';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    
    return date.toLocaleDateString('en-ZA', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getConditionClass = (condition) => {
    switch (condition) {
      case 'new': return 'condition-new';
      case 'like_new': return 'condition-like-new';
      case 'good': return 'condition-good';
      case 'fair': return 'condition-fair';
      case 'poor': return 'condition-poor';
      default: return 'condition-default';
    }
  };

  const clearMessage = () => {
    setMessage({ type: '', text: '' });
  };

  if (loading && listings.length === 0) {
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
        <h1 className="marketplace-title">Campus Marketplace</h1>
        <p className="marketplace-subtitle">Buy, sell, and trade with fellow students</p>
        
        {user ? (
          <button 
            className="create-item-btn"
            onClick={() => setShowCreateModal(true)}
          >
            + Create New Listing
          </button>
        ) : (
          <div className="login-prompt">
            <p>Log in to create your own listings</p>
          </div>
        )}
      </div>

      {/* Message Display */}
      {message.text && (
        <div className={`message message-${message.type}`}>
          <span>{message.text}</span>
          <button className="message-close" onClick={clearMessage}>×</button>
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
              placeholder="Search listings..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
            />
          </div>

          {/* Category */}
          <div className="filter-group">
            <label className="filter-label">Category</label>
            <select
              className="filter-select"
              value={filters.category}
              onChange={(e) => setFilters({...filters, category: e.target.value})}
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Currency Filter - RUB first */}
          <div className="filter-group">
            <label className="filter-label">Currency</label>
            <select
              className="filter-select"
              value={filters.currency}
              onChange={(e) => setFilters({...filters, currency: e.target.value})}
            >
              <option value="">All Currencies</option>
              <option value="RUB">🇷🇺 Russian Ruble (RUB)</option>
              <option value="USD">🇺🇸 US Dollar (USD)</option>
              <option value="ZAR">🇿🇦 South African Rand (ZAR)</option>
            </select>
          </div>

          {/* Price Range */}
          <div className="filter-group">
            <label className="filter-label">Price Range</label>
            <div className="price-slider">
              <input
                type="number"
                className="search-input"
                placeholder="Min"
                value={filters.minPrice}
                onChange={(e) => setFilters({...filters, minPrice: e.target.value})}
              />
              <span>to</span>
              <input
                type="number"
                className="search-input"
                placeholder="Max"
                value={filters.maxPrice}
                onChange={(e) => setFilters({...filters, maxPrice: e.target.value})}
              />
            </div>
          </div>

          {/* Condition */}
          <div className="filter-group">
            <label className="filter-label">Condition</label>
            <select
              className="filter-select"
              value={filters.condition}
              onChange={(e) => setFilters({...filters, condition: e.target.value})}
            >
              <option value="">Any Condition</option>
              <option value="new">New</option>
              <option value="like_new">Like New</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
          </div>

          {/* Negotiable */}
          <div className="filter-group">
            <label className="filter-label">Price Negotiable</label>
            <select
              className="filter-select"
              value={filters.negotiable}
              onChange={(e) => setFilters({...filters, negotiable: e.target.value})}
            >
              <option value="">All</option>
              <option value="true">Negotiable Only</option>
              <option value="false">Fixed Price Only</option>
            </select>
          </div>

          {/* Sort */}
          <div className="filter-group">
            <label className="filter-label">Sort By</label>
            <select
              className="filter-select"
              value={filters.sortBy}
              onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
            >
              <option value="newest">Newest First</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
              <option value="views">Most Viewed</option>
            </select>
          </div>
        </div>

        <div className="results-count">
          {listings.length} {listings.length === 1 ? 'listing' : 'listings'} found
        </div>
      </div>

      {/* Listings Grid */}
      <div className="items-grid">
        {listings.length === 0 ? (
          <div className="no-items">
            <h3>No listings found</h3>
            <p>Try adjusting your filters or create the first listing!</p>
          </div>
        ) : (
          listings.map(listing => (
            <div 
              key={listing.id} 
              className={`item-card ${listing.status === 'sold' ? 'sold' : ''}`}
            >
              {/* Sold Badge */}
              {listing.status === 'sold' && (
                <div className="sold-badge">SOLD</div>
              )}

              {/* Images */}
              <div className="item-images">
                {listing.images && listing.images.length > 0 ? (
                  <>
                    <img 
                      src={listing.images.find(img => img.is_primary)?.image_url || listing.images[0].image_url} 
                      alt={listing.title}
                      className="item-image"
                    />
                    {listing.images.length > 1 && (
                      <div className="image-count">+{listing.images.length - 1}</div>
                    )}
                  </>
                ) : (
                  <div className="item-image-placeholder">
                    <span>No Image</span>
                  </div>
                )}
              </div>

              {/* Item Info */}
              <div className="item-info">
                {/* Header with title and price */}
                <div className="item-header">
                  <h3 className="item-title">{listing.title}</h3>
                  <div className="item-price">
                    <span className="currency-flag">{getCurrencyFlag(listing.currency || 'RUB')}</span>
                    {formatPrice(listing.price, listing.currency || 'RUB')}
                  </div>
                </div>

                {/* Meta info */}
                <div className="item-meta">
                  <span className="item-category">{listing.category?.name}</span>
                  {listing.price_negotiable && (
                    <span className="negotiable-badge">Negotiable</span>
                  )}
                  <span className={`condition-badge ${getConditionClass(listing.condition)}`}>
                    {listing.condition.replace('_', ' ')}
                  </span>
                  {listing.user_id === user?.id && (
                    <span className="owner-badge">Your Listing</span>
                  )}
                </div>

                {/* Description */}
                <p className="item-description">{listing.description}</p>

                {/* Footer with location and seller info */}
                <div className="item-footer">
                  {listing.location && (
                    <div className="item-location">
                      📍 {listing.location}
                    </div>
                  )}
                  <div className="item-seller">
                    <span className="seller-info">
                      👤 {listing.user?.firstname} {listing.user?.surname}
                    </span>
                    <span className="item-date">{formatDate(listing.created_at)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="item-actions">
                  {/* Contact Options for non-owners */}
                  {listing.user_id !== user?.id ? (
                    <>
                      <button 
                        className="contact-btn"
                        onClick={() => handleContactSeller(listing, 'email')}
                        title="Email seller"
                      >
                        📧 Email
                      </button>
                      <button 
                        className="contact-btn"
                        onClick={() => handleContactSeller(listing, 'whatsapp')}
                        title="Contact via WhatsApp"
                      >
                        💬 WhatsApp
                      </button>
                      <button 
                        className="contact-btn"
                        onClick={() => handleContactSeller(listing, 'telegram')}
                        title="Contact via Telegram"
                      >
                        📱 Telegram
                      </button>
                      <button 
                        className="contact-btn"
                        onClick={() => handleContactSeller(listing, 'in_app')}
                        title="In-app messaging"
                      >
                        💬 Message
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Owner actions */}
                      <button 
                        className="contact-btn"
                        disabled
                        title="This is your listing"
                      >
                        👤 Your Listing
                      </button>
                      {listing.status === 'active' && (
                        <button 
                          className="sold-btn"
                          onClick={() => handleMarkAsSold(listing.id)}
                        >
                          ✅ Mark as Sold
                        </button>
                      )}
                      <button 
                        className="delete-btn"
                        onClick={() => handleDeleteListing(listing.id)}
                      >
                        🗑️ Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Listing Modal */}
      {showCreateModal && (
        <CreateListingModal
          user={user}
          categories={categories}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateListing}
        />
      )}
    </div>
  );
};

// Create Listing Modal Component
const CreateListingModal = ({ user, categories, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    price: '',
    currency: 'RUB', // Default is RUB
    price_negotiable: true,
    condition: 'good',
    location: '',
    contact_method: 'email',
    contact_info: user?.email || '',
    status: 'active'
  });
  
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previews, setPreviews] = useState([]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageUpload = async (files) => {
    setUploading(true);
    try {
      const uploadedUrls = [];
      
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          alert(`File "${file.name}" is too large (max 5MB)`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('marketplace-images')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('marketplace-images')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
        
        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviews(prev => [...prev, reader.result]);
        };
        reader.readAsDataURL(file);
      }
      
      setImages(prev => [...prev, ...uploadedUrls]);
      
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Failed to upload some images');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title.trim() || !formData.description.trim() || !formData.price || !formData.category_id) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        ...formData,
        price: parseFloat(formData.price),
        images: images
      });
    } catch (error) {
      alert('Failed to create listing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Create New Listing</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form className="create-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            {/* Title */}
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input
                type="text"
                className="form-input"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="What are you selling?"
                required
                maxLength={200}
              />
            </div>

            {/* Category */}
            <div className="form-group">
              <label className="form-label">Category *</label>
              <select
                className="form-input"
                name="category_id"
                value={formData.category_id}
                onChange={handleChange}
                required
              >
                <option value="">Select Category</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Price with Currency - RUB first */}
            <div className="form-group">
              <label className="form-label">Price *</label>
              <div className="price-input-group">
                <input
                  type="number"
                  className="form-input price-input"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                />
                <select
                  className="form-input currency-select"
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  required
                >
                  <option value="RUB">🇷🇺 RUB</option>
                  <option value="USD">🇺🇸 USD</option>
                  <option value="ZAR">🇿🇦 ZAR</option>
                </select>
              </div>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="price_negotiable"
                    checked={formData.price_negotiable}
                    onChange={handleChange}
                  />
                  Price is negotiable
                </label>
              </div>
            </div>

            {/* Condition */}
            <div className="form-group">
              <label className="form-label">Condition</label>
              <select
                className="form-input"
                name="condition"
                value={formData.condition}
                onChange={handleChange}
              >
                <option value="new">New</option>
                <option value="like_new">Like New</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>

            {/* Location */}
            <div className="form-group">
              <label className="form-label">Location</label>
              <input
                type="text"
                className="form-input"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Where is the item located?"
              />
            </div>

            {/* Contact Method */}
            <div className="form-group">
              <label className="form-label">Preferred Contact Method</label>
              <select
                className="form-input"
                name="contact_method"
                value={formData.contact_method}
                onChange={handleChange}
              >
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
                <option value="phone">Phone Call</option>
                <option value="in_app">In-app Messaging</option>
              </select>
            </div>

            {/* Contact Info */}
            {formData.contact_method !== 'in_app' && (
              <div className="form-group">
                <label className="form-label">Contact Information *</label>
                <input
                  type="text"
                  className="form-input"
                  name="contact_info"
                  value={formData.contact_info}
                  onChange={handleChange}
                  placeholder={
                    formData.contact_method === 'email' ? 'your.email@example.com' :
                    formData.contact_method === 'whatsapp' || formData.contact_method === 'telegram' ? '+27 12 345 6789' :
                    'Contact information'
                  }
                  required
                />
              </div>
            )}

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Description *</label>
              <textarea
                className="form-textarea"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe your item in detail..."
                rows="4"
                required
              />
            </div>

            {/* Image Upload */}
            <div className="form-group">
              <label className="form-label">Images (Optional)</label>
              <div className="image-upload-area">
                <input
                  type="file"
                  className="image-input"
                  id="image-upload"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleImageUpload(Array.from(e.target.files))}
                />
                <label htmlFor="image-upload" className="upload-label">
                  📷 Upload Images
                </label>
                <p className="upload-hint">Max 5MB per image</p>

                {/* Image Previews */}
                {previews.length > 0 && (
                  <div className="image-preview">
                    {previews.map((preview, index) => (
                      <div key={index} className="preview-item">
                        <img src={preview} alt={`Preview ${index + 1}`} />
                        <button
                          type="button"
                          className="remove-image-btn"
                          onClick={() => handleRemoveImage(index)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {uploading && <p>Uploading images...</p>}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Marketplace;