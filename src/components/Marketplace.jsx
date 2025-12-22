import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const Marketplace = () => {
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [categories] = useState(['all', 'books', 'electronics', 'furniture', 'services', 'housing', 'other']);
  const [filters, setFilters] = useState({
    category: 'all',
    priceMin: '',
    priceMax: '',
    search: ''
  });

  const [newListing, setNewListing] = useState({
    title: '',
    description: '',
    category: 'other',
    price: '',
    price_type: 'fixed',
    location: '',
    contact_phone: '',
    contact_email: ''
  });

  useEffect(() => {
    fetchListings();
  }, []);

  useEffect(() => {
    filterListings();
  }, [listings, filters]);

  const fetchListings = async () => {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          *,
          users:user_id (
            firstname,
            surname,
            university,
            profile_picture_url
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setListings(data || []);
    } catch (error) {
      console.error('Error fetching listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterListings = () => {
    let filtered = [...listings];

    // Filter by category
    if (filters.category !== 'all') {
      filtered = filtered.filter(listing => listing.category === filters.category);
    }

    // Filter by price range
    if (filters.priceMin) {
      filtered = filtered.filter(listing => 
        listing.price >= parseFloat(filters.priceMin)
      );
    }
    if (filters.priceMax) {
      filtered = filtered.filter(listing => 
        listing.price <= parseFloat(filters.priceMax)
      );
    }

    // Filter by search term
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(listing =>
        listing.title.toLowerCase().includes(searchTerm) ||
        listing.description.toLowerCase().includes(searchTerm) ||
        listing.location?.toLowerCase().includes(searchTerm)
      );
    }

    setFilteredListings(filtered);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateListing = async (e) => {
    e.preventDefault();
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        alert('Please login to create a listing');
        return;
      }

      const { error } = await supabase
        .from('listings')
        .insert({
          user_id: userData.user.id,
          ...newListing,
          price: newListing.price ? parseFloat(newListing.price) : null
        });

      if (error) throw error;

      alert('Listing created successfully!');
      setShowCreateModal(false);
      setNewListing({
        title: '',
        description: '',
        category: 'other',
        price: '',
        price_type: 'fixed',
        location: '',
        contact_phone: '',
        contact_email: ''
      });
      fetchListings(); // Refresh listings
      
    } catch (error) {
      console.error('Error creating listing:', error);
      alert('Error creating listing: ' + error.message);
    }
  };

  const handleContactSeller = (listing) => {
    const contactInfo = listing.contact_phone || listing.contact_email;
    if (contactInfo) {
      alert(`Contact seller at: ${contactInfo}`);
    } else {
      alert('No contact information available for this listing.');
    }
  };

  const formatPrice = (price, priceType) => {
    if (priceType === 'free') return 'Free';
    if (!price) return 'Price on request';
    return `$${parseFloat(price).toFixed(2)}`;
  };

  const getCategoryClass = (category) => {
    const classes = {
      'books': 'category-books',
      'electronics': 'category-electronics',
      'furniture': 'category-furniture',
      'services': 'category-services',
      'housing': 'category-housing',
      'other': 'category-other'
    };
    return classes[category] || 'category-other';
  };

  const getCategoryLabel = (category) => {
    const labels = {
      'books': 'Books',
      'electronics': 'Electronics',
      'furniture': 'Furniture',
      'services': 'Services',
      'housing': 'Housing',
      'other': 'Other'
    };
    return labels[category] || 'Other';
  };

  if (loading) {
    return (
      <div className="marketplace-container">
        <div className="loading-listings">
          Loading marketplace...
        </div>
      </div>
    );
  }

  return (
    <div className="marketplace-container">
      <div className="marketplace-header">
        <h1 className="marketplace-title">Campus Marketplace</h1>
        <button 
          className="create-listing-btn"
          onClick={() => setShowCreateModal(true)}
        >
          + Create Listing
        </button>
      </div>

      <div className="marketplace-filters">
        <div className="filter-group">
          <select 
            name="category" 
            value={filters.category}
            onChange={handleFilterChange}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : getCategoryLabel(cat)}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <input
            type="number"
            name="priceMin"
            placeholder="Min Price"
            value={filters.priceMin}
            onChange={handleFilterChange}
          />
        </div>

        <div className="filter-group">
          <input
            type="number"
            name="priceMax"
            placeholder="Max Price"
            value={filters.priceMax}
            onChange={handleFilterChange}
          />
        </div>

        <div className="filter-group search-input">
          <input
            type="text"
            name="search"
            placeholder="Search listings..."
            value={filters.search}
            onChange={handleFilterChange}
          />
        </div>
      </div>

      {filteredListings.length === 0 ? (
        <div className="no-listings">
          <h3>No listings found</h3>
          <p>Be the first to create a listing!</p>
        </div>
      ) : (
        <div className="listings-grid">
          {filteredListings.map(listing => (
            <div 
              key={listing.id} 
              className="listing-card"
              onClick={() => {
                setSelectedListing(listing);
                setShowModal(true);
              }}
            >
              {listing.image_urls && listing.image_urls.length > 0 ? (
                <img 
                  src={listing.image_urls[0]} 
                  alt={listing.title}
                  className="listing-image"
                />
              ) : (
                <div className="listing-image" style={{
                  backgroundColor: '#f8f9fa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6c757d'
                }}>
                  No Image
                </div>
              )}
              
              <div className="listing-content">
                <span className={`listing-category ${getCategoryClass(listing.category)}`}>
                  {getCategoryLabel(listing.category)}
                </span>
                
                <h3 className="listing-title">{listing.title}</h3>
                
                <p className="listing-description">{listing.description}</p>
                
                <div className="listing-price">
                  {formatPrice(listing.price, listing.price_type)}
                </div>
                
                {listing.location && (
                  <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                    📍 {listing.location}
                  </p>
                )}
                
                <div className="listing-footer">
                  <div className="listing-user">
                    {listing.users?.profile_picture_url ? (
                      <img 
                        src={listing.users.profile_picture_url} 
                        alt={listing.users.firstname}
                        className="user-avatar"
                      />
                    ) : (
                      <div className="user-avatar" style={{
                        backgroundColor: '#667eea',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px'
                      }}>
                        {listing.users?.firstname?.[0]}
                      </div>
                    )}
                    <div className="user-info">
                      <span className="user-name">
                        {listing.users?.firstname} {listing.users?.surname}
                      </span>
                      {listing.users?.university && (
                        <span className="user-university">
                          {listing.users.university}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <span className="listing-date">
                    {new Date(listing.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Listing Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Listing</h2>
              <button 
                className="close-modal"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateListing}>
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  className="form-control"
                  value={newListing.title}
                  onChange={e => setNewListing({...newListing, title: e.target.value})}
                  required
                  placeholder="What are you selling/offering?"
                />
              </div>

              <div className="form-group">
                <label>Description *</label>
                <textarea
                  className="form-control"
                  value={newListing.description}
                  onChange={e => setNewListing({...newListing, description: e.target.value})}
                  required
                  rows="4"
                  placeholder="Describe your item or service in detail..."
                />
              </div>

              <div className="form-row" style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Category *</label>
                  <select
                    className="form-control"
                    value={newListing.category}
                    onChange={e => setNewListing({...newListing, category: e.target.value})}
                    required
                  >
                    <option value="books">Books</option>
                    <option value="electronics">Electronics</option>
                    <option value="furniture">Furniture</option>
                    <option value="services">Services</option>
                    <option value="housing">Housing</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label>Price Type</label>
                  <select
                    className="form-control"
                    value={newListing.price_type}
                    onChange={e => setNewListing({...newListing, price_type: e.target.value})}
                  >
                    <option value="fixed">Fixed Price</option>
                    <option value="negotiable">Negotiable</option>
                    <option value="free">Free</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Price (leave empty if free or negotiable)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  value={newListing.price}
                  onChange={e => setNewListing({...newListing, price: e.target.value})}
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  className="form-control"
                  value={newListing.location}
                  onChange={e => setNewListing({...newListing, location: e.target.value})}
                  placeholder="Campus area or meeting point"
                />
              </div>

              <div className="form-row" style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Contact Phone (Optional)</label>
                  <input
                    type="tel"
                    className="form-control"
                    value={newListing.contact_phone}
                    onChange={e => setNewListing({...newListing, contact_phone: e.target.value})}
                    placeholder="Your phone number"
                  />
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label>Contact Email (Optional)</label>
                  <input
                    type="email"
                    className="form-control"
                    value={newListing.contact_email}
                    onChange={e => setNewListing({...newListing, contact_email: e.target.value})}
                    placeholder="Your email"
                  />
                </div>
              </div>

              <div className="form-group">
                <small style={{ color: '#666', fontSize: '12px' }}>
                  Note: Your email and phone will be visible to other users. Your name and university will be shown with the listing.
                </small>
              </div>

              <div className="listing-actions">
                <button 
                  type="submit" 
                  className="btn-contact"
                >
                  Create Listing
                </button>
                <button 
                  type="button" 
                  className="btn-save"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Listing Detail Modal */}
      {showModal && selectedListing && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{selectedListing.title}</h2>
              <button 
                className="close-modal"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>

            {selectedListing.image_urls && selectedListing.image_urls.length > 0 ? (
              <img 
                src={selectedListing.image_urls[0]} 
                alt={selectedListing.title}
                className="listing-detail-image"
              />
            ) : (
              <div className="listing-detail-image" style={{
                backgroundColor: '#f8f9fa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6c757d',
                fontSize: '18px'
              }}>
                No Image Available
              </div>
            )}

            <div className="listing-detail-content">
              <span className={`listing-category ${getCategoryClass(selectedListing.category)}`}>
                {getCategoryLabel(selectedListing.category)}
              </span>
              
              <div className="listing-detail-price">
                {formatPrice(selectedListing.price, selectedListing.price_type)}
              </div>
              
              {selectedListing.location && (
                <p style={{ color: '#666', marginBottom: '15px' }}>
                  <strong>📍 Location:</strong> {selectedListing.location}
                </p>
              )}
              
              <h4>Description</h4>
              <p className="listing-detail-description">{selectedListing.description}</p>
              
              <div style={{ 
                backgroundColor: '#f8f9fa', 
                padding: '15px', 
                borderRadius: '6px',
                marginTop: '20px'
              }}>
                <h4>Seller Information</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '10px' }}>
                  {selectedListing.users?.profile_picture_url ? (
                    <img 
                      src={selectedListing.users.profile_picture_url} 
                      alt={selectedListing.users.firstname}
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '50%',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '20px',
                      fontWeight: 'bold'
                    }}>
                      {selectedListing.users?.firstname?.[0]}
                    </div>
                  )}
                  
                  <div>
                    <p style={{ margin: 0, fontWeight: '600' }}>
                      {selectedListing.users?.firstname} {selectedListing.users?.surname}
                    </p>
                    {selectedListing.users?.university && (
                      <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                        {selectedListing.users.university}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="listing-actions">
                <button 
                  className="btn-contact"
                  onClick={() => handleContactSeller(selectedListing)}
                >
                  Contact Seller
                </button>
                <button 
                  className="btn-save"
                  onClick={() => setShowModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Marketplace;