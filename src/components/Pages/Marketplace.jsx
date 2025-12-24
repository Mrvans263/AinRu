import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import './Marketplace.css';
import {
  formatPrice,
  getCurrencyFlag,
  formatDate,
  getConditionClass,
  handleContactSeller,
  getContactButtonText,
  fetchUserDetails,
  fetchListingImages,
  getPrimaryImageUrl
} from './MarketplaceHelpers';

const Marketplace = () => {
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
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

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('marketplace_listings')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }
      if (filters.category) {
        query = query.eq('category_id', filters.category);
      }
      if (filters.currency) {
        query = query.eq('currency', filters.currency);
      }
      if (filters.minPrice) {
        query = query.gte('price', parseFloat(filters.minPrice));
      }
      if (filters.maxPrice) {
        query = query.lte('price', parseFloat(filters.maxPrice));
      }
      if (filters.condition) {
        query = query.eq('condition', filters.condition);
      }
      if (filters.negotiable === 'true') {
        query = query.eq('price_negotiable', true);
      } else if (filters.negotiable === 'false') {
        query = query.eq('price_negotiable', false);
      }

      // Apply sorting
      switch (filters.sortBy) {
        case 'price_low':
          query = query.order('price', { ascending: true });
          break;
        case 'price_high':
          query = query.order('price', { ascending: false });
          break;
        case 'views':
          query = query.order('views_count', { ascending: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data: listingsData, error } = await query;
      if (error) throw error;

      // Get categories for display
      const categoriesMap = {};
      categories.forEach(cat => {
        categoriesMap[cat.id] = cat;
      });
      
      // Fetch all related data in parallel
      const enrichedListings = await Promise.all(
        (listingsData || []).map(async (listing) => {
          try {
            const [userDetails, images] = await Promise.all([
              fetchUserDetails(listing.user_id),
              fetchListingImages(listing.id)
            ]);
            
            return {
              ...listing,
              category: categoriesMap[listing.category_id] || null,
              images: images,
              user: userDetails
            };
          } catch (error) {
            console.error('Error enriching listing:', listing.id, error);
            return {
              ...listing,
              category: categoriesMap[listing.category_id] || null,
              images: [],
              user: {
                firstname: 'User',
                surname: '',
                email: '',
                phone: ''
              }
            };
          }
        })
      );

      setListings(enrichedListings);
    } catch (error) {
      console.error('Error fetching listings:', error);
      setMessage({ type: 'error', text: 'Failed to load listings' });
    } finally {
      setLoading(false);
    }
  }, [filters, categories]);

  const handleCreateListing = async (listingData) => {
    try {
      // 1. Create the main listing
      const { data: listing, error } = await supabase
        .from('marketplace_listings')
        .insert([{
          title: listingData.title,
          description: listingData.description,
          category_id: listingData.category_id,
          price: parseFloat(listingData.price),
          currency: listingData.currency || 'RUB',
          price_negotiable: listingData.price_negotiable,
          condition: listingData.condition,
          location: listingData.location,
          contact_method: listingData.contact_method,
          contact_info: listingData.contact_info,
          user_id: user.id,
          status: 'active'
        }])
        .select()
        .single();

      if (error) throw error;

      // 2. Handle image uploads if there are images
      if (listingData.images && listingData.images.length > 0) {
        try {
          const imageRecords = listingData.images.map((img, index) => ({
            listing_id: listing.id,
            image_url: img,
            is_primary: index === 0,
            order_index: index
          }));

          await supabase
            .from('listing_images')
            .insert(imageRecords);
        } catch (imageError) {
          console.warn('Could not save images:', imageError);
          // Don't fail the whole creation if images fail
        }
      }

      setShowCreateModal(false);
      setMessage({ type: 'success', text: 'Listing created successfully!' });
      fetchListings();
      
    } catch (error) {
      console.error('Error creating listing:', error);
      setMessage({ type: 'error', text: 'Failed to create listing' });
      throw error;
    }
  };

  const handleDeleteListing = async (listingId) => {
    if (!window.confirm('Are you sure you want to delete this listing?')) return;

    try {
      const { error } = await supabase
        .from('marketplace_listings')
        .update({ status: 'deleted' })
        .eq('id', listingId)
        .eq('user_id', user.id);

      if (error) throw error;

      setListings(listings.filter(listing => listing.id !== listingId));
      setMessage({ type: 'success', text: 'Listing deleted successfully!' });
      
    } catch (error) {
      console.error('Error deleting listing:', error);
      setMessage({ type: 'error', text: 'Failed to delete listing' });
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

          {/* Price Range - Fixed Input Size */}
          <div className="filter-group">
            <label className="filter-label">Price Range</label>
            <div className="price-slider">
              <input
                type="number"
                className="search-input price-input"
                placeholder="Min"
                value={filters.minPrice}
                onChange={(e) => setFilters({...filters, minPrice: e.target.value})}
                style={{ fontSize: '14px', padding: '8px', width: '100px' }}
              />
              <span>to</span>
              <input
                type="number"
                className="search-input price-input"
                placeholder="Max"
                value={filters.maxPrice}
                onChange={(e) => setFilters({...filters, maxPrice: e.target.value})}
                style={{ fontSize: '14px', padding: '8px', width: '100px' }}
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
            <ListingCard
              key={listing.id}
              listing={listing}
              currentUser={user}
              onContactSeller={() => handleContactSeller(listing, user)}
              onMarkAsSold={handleMarkAsSold}
              onDelete={handleDeleteListing}
            />
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

// Separate Listing Card Component
const ListingCard = ({ listing, currentUser, onContactSeller, onMarkAsSold, onDelete }) => {
  const primaryImageUrl = getPrimaryImageUrl(listing.images);
  const isOwnListing = listing.user_id === currentUser?.id;

  return (
    <div className={`item-card ${listing.status === 'sold' ? 'sold' : ''}`}>
      {/* Sold Badge */}
      {listing.status === 'sold' && (
        <div className="sold-badge">SOLD</div>
      )}

      {/* Images */}
      <div className="item-images">
        {primaryImageUrl ? (
          <>
            <img 
              src={primaryImageUrl} 
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
          {isOwnListing && (
            <span className="owner-badge">Your Item</span>
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
  👤 {listing.user?.firstname || 'Seller'} {listing.user?.surname || ''}
</span>
            <span className="item-date">{formatDate(listing.created_at)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="item-actions">
          {/* Contact Options for non-owners */}
          {!isOwnListing ? (
            <button 
              className="contact-btn"
              onClick={onContactSeller}
              title={`Contact via ${listing.contact_method || 'email'}`}
            >
              {getContactButtonText(listing.contact_method || 'email')}
            </button>
          ) : (
            <>
              {/* Owner actions */}
              <button 
                className="owner-btn"
                disabled
                title="This is your listing"
              >
                👤 Your Item
              </button>
              {listing.status === 'active' && (
                <button 
                  className="sold-btn"
                  onClick={() => onMarkAsSold(listing.id)}
                >
                  ✅ Mark as Sold
                </button>
              )}
              <button 
                className="delete-btn"
                onClick={() => onDelete(listing.id)}
              >
                🗑️ Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Create Listing Modal
const CreateListingModal = ({ user, categories, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    price: '',
    currency: 'RUB',
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

    // Validate contact info based on method
    if (formData.contact_method !== 'in_app' && !formData.contact_info.trim()) {
      alert(`Please provide ${formData.contact_method} contact information`);
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

            {/* Price with Currency - Fixed Large Input */}
            <div className="form-group">
              <label className="form-label">Price *</label>
              <div className="price-input-group">
                <input
                  type="number"
                  className="form-input price-input-large"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                  style={{ fontSize: '16px', padding: '12px', width: '150px' }}
                />
                <select
                  className="form-input currency-select"
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  required
                  style={{ width: '100px' }}
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
              <label className="form-label">Preferred Contact Method *</label>
              <select
                className="form-input"
                name="contact_method"
                value={formData.contact_method}
                onChange={handleChange}
                required
              >
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
                <option value="phone">Phone Call</option>
                <option value="in_app">In-app Messaging</option>
              </select>
            </div>

            {/* Contact Info - Dynamic placeholder */}
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
                    '+27 12 345 6789'
                  }
                  required={formData.contact_method !== 'in_app'}
                />
                <small className="form-hint">
                  {formData.contact_method === 'email' 
                    ? 'Buyers will contact you via email'
                    : 'Include country code (e.g., +27 for South Africa)'}
                </small>
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