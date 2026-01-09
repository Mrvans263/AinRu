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
  fetchMarketplaceData
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
    status: 'active',
    sortBy: 'newest'
  });

  // Fetch user and categories
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Get current user
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);
        
        // Fetch categories
        const { data: categoriesData } = await supabase
          .from('marketplace_categories')
          .select('*')
          .order('name');
        setCategories(categoriesData || []);
        
        // Fetch initial listings
        await fetchListings();
      } catch (error) {
        console.error('Error fetching initial data:', error);
        setMessage({ type: 'error', text: 'Failed to load marketplace' });
      }
    };
    
    fetchInitialData();
  }, []);

  // Fetch listings when filters change
  useEffect(() => {
    if (categories.length > 0) {
      fetchListings();
    }
  }, [filters]);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMarketplaceData(filters);
      setListings(data);
    } catch (error) {
      console.error('Error fetching listings:', error);
      setMessage({ type: 'error', text: 'Failed to load listings' });
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const handleCreateListing = async (listingData) => {
    try {
      // Create the main listing
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

      // Handle image uploads
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
        }
      }

      setShowCreateModal(false);
      setMessage({ type: 'success', text: 'Listing created successfully!' });
      await fetchListings();
      
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
      <FiltersSection 
        filters={filters}
        setFilters={setFilters}
        categories={categories}
        listingsCount={listings.length}
      />

      {/* Listings Grid */}
      <ListingsGrid 
        listings={listings}
        currentUser={user}
        onContactSeller={handleContactSeller}
        onMarkAsSold={handleMarkAsSold}
        onDelete={handleDeleteListing}
      />

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

// ==================== SEPARATE COMPONENTS ====================

// Filters Section Component
const FiltersSection = ({ filters, setFilters, categories, listingsCount }) => (
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

      {/* Status Filter */}
      <div className="filter-group">
        <label className="filter-label">Status</label>
        <select
          className="filter-select"
          value={filters.status}
          onChange={(e) => setFilters({...filters, status: e.target.value})}
        >
          <option value="active">Active Listings</option>
          <option value="sold">Sold Items</option>
          <option value="all">All Listings</option>
        </select>
      </div>

      {/* Currency Filter */}
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
        </select>
      </div>
    </div>

    <div className="results-count">
      {listingsCount} {listingsCount === 1 ? 'listing' : 'listings'} found
    </div>
  </div>
);

// Listings Grid Component
const ListingsGrid = ({ listings, currentUser, onContactSeller, onMarkAsSold, onDelete }) => (
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
          currentUser={currentUser}
          onContactSeller={() => onContactSeller(listing, currentUser)}
          onMarkAsSold={onMarkAsSold}
          onDelete={onDelete}
        />
      ))
    )}
  </div>
);

// Listing Card Component
const ListingCard = ({ listing, currentUser, onContactSeller, onMarkAsSold, onDelete }) => {
  const primaryImageUrl = listing.images?.find(img => img.is_primary)?.image_url || 
                         listing.images?.[0]?.image_url || null;
  const isOwnListing = listing.user_id === currentUser?.id;
  const isSold = listing.status === 'sold';

  return (
    <div className={`item-card ${isSold ? 'sold-item' : ''}`}>
      {/* Sold Overlay - Only show if sold */}
      {isSold && (
        <div className="sold-overlay">
          <div className="sold-badge-large">SOLD</div>
          <div className="sold-message">This item has been sold</div>
        </div>
      )}

      {/* Images */}
      <div className="item-images">
        {primaryImageUrl ? (
          <>
            <img 
              src={primaryImageUrl} 
              alt={listing.title}
              className="item-image"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/placeholder-image.png';
              }}
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
            {isSold && <span className="sold-price-indicator"> (Sold)</span>}
          </div>
        </div>

        {/* Meta info */}
        <div className="item-meta">
          <span className="item-category">{listing.category?.name}</span>
          {listing.price_negotiable && !isSold && (
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
          <div className="seller-details">
            <span className="seller-info">
              {isOwnListing ? '👤 Your Item' : `👤 ${listing.user?.firstname || 'Seller'} ${listing.user?.surname || ''}`.trim()}
            </span>
            <span className="item-date">{formatDate(listing.created_at)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="item-actions">
          {!isOwnListing ? (
            <button 
              className={`contact-btn ${isSold ? 'disabled-btn' : ''}`}
              onClick={isSold ? undefined : onContactSeller}
              title={isSold ? 'Item has been sold' : `Contact via ${listing.contact_method || 'email'}`}
              disabled={isSold}
            >
              {isSold ? '❌ Sold' : getContactButtonText(listing.contact_method || 'email')}
            </button>
          ) : (
            <>
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

// Create Listing Modal Component
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
    if (!formData.title.trim()) {
      alert('Please enter a title for your listing');
      return;
    }
    
    if (!formData.description.trim()) {
      alert('Please enter a description for your listing');
      return;
    }
    
    if (!formData.price) {
      alert('Please enter a price for your listing');
      return;
    }
    
    if (!formData.category_id) {
      alert('Please select a category for your listing');
      return;
    }

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
      alert('Failed to create listing. Please try again.');
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

            {/* Price with Currency */}
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
                   formData.contact_method + " contact"
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