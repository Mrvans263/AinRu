import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import './Services.css';

const Services = () => {
  const [user, setUser] = useState(null);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    serviceType: '',
    minPrice: '',
    maxPrice: '',
    location: '',
    serviceStatus: 'active',
    sortBy: 'newest'
  });
  const [filterChanged, setFilterChanged] = useState(false);

  // Fetch initial data
  useEffect(() => {
    checkUser();
    fetchCategories();
  }, []);

  // Fetch services when filters change
  useEffect(() => {
    if (filterChanged) {
      fetchServices();
    }
  }, [filters]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user || null);
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('services')
        .select(`
          *,
          category:service_categories(name, icon),
          user:users(firstname, surname, email, phone, profile_picture_url, university)
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.serviceStatus !== 'all') {
        query = query.eq('status', filters.serviceStatus);
      }
      if (filters.category) {
        query = query.eq('category_id', filters.category);
      }
      if (filters.serviceType) {
        query = query.eq('service_type', filters.serviceType);
      }
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,tags.ilike.%${filters.search}%`);
      }
      if (filters.location) {
        query = query.or(`location.ilike.%${filters.location}%,meeting_place.ilike.%${filters.location}%`);
      }
      if (filters.minPrice) {
        query = query.gte('price', parseFloat(filters.minPrice));
      }
      if (filters.maxPrice) {
        query = query.lte('price', parseFloat(filters.maxPrice));
      }

      // Apply sorting
      switch (filters.sortBy) {
        case 'price_low':
          query = query.order('price', { ascending: true });
          break;
        case 'price_high':
          query = query.order('price', { ascending: false });
          break;
        case 'rating':
          query = query.order('average_rating', { ascending: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
      setServices([]);
    } finally {
      setLoading(false);
      setFilterChanged(false);
    }
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setFilterChanged(true);
  };

  const handleCreateService = async (serviceData) => {
    try {
      const { data, error } = await supabase
        .from('services')
        .insert([{
          ...serviceData,
          user_id: user.id,
          status: 'active'
        }])
        .select()
        .single();

      if (error) throw error;
      
      setMessage({ type: 'success', text: 'Service created successfully!' });
      setShowCreateModal(false);
      await fetchServices();
      return data;
    } catch (error) {
      console.error('Error creating service:', error);
      setMessage({ type: 'error', text: 'Failed to create service' });
      throw error;
    }
  };

  const handleUpdateService = async (serviceId, updates) => {
    try {
      const { error } = await supabase
        .from('services')
        .update(updates)
        .eq('id', serviceId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      setMessage({ type: 'success', text: 'Service updated successfully!' });
      await fetchServices();
    } catch (error) {
      console.error('Error updating service:', error);
      setMessage({ type: 'error', text: 'Failed to update service' });
    }
  };

  const handleDeleteService = async (serviceId) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;

    try {
      const { error } = await supabase
        .from('services')
        .update({ status: 'deleted' })
        .eq('id', serviceId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      setServices(services.filter(service => service.id !== serviceId));
      setMessage({ type: 'success', text: 'Service deleted successfully!' });
    } catch (error) {
      console.error('Error deleting service:', error);
      setMessage({ type: 'error', text: 'Failed to delete service' });
    }
  };

  const handleContactServiceProvider = (service) => {
    if (!service.contact_info) {
      alert('No contact information available');
      return;
    }

    const providerName = `${service.user?.firstname || 'Provider'} ${service.user?.surname || ''}`;
    const messageText = `Hi ${providerName}, I'm interested in your service: ${service.title}`;
    
    switch (service.contact_method) {
      case 'whatsapp':
        const phone = service.contact_info.replace(/\D/g, '');
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`, '_blank');
        break;
      case 'telegram':
        const tgPhone = service.contact_info.replace(/\D/g, '');
        window.open(`https://t.me/+${tgPhone}`, '_blank');
        break;
      case 'email':
        window.location.href = `mailto:${service.contact_info}?subject=Service Inquiry: ${service.title}&body=${encodeURIComponent(messageText)}`;
        break;
      case 'phone':
        if (window.confirm(`Call ${providerName} at ${service.contact_info}?`)) {
          window.location.href = `tel:${service.contact_info}`;
        }
        break;
      case 'in_app':
        // Navigate to messages with this user
        window.location.href = `/messages?user=${service.user_id}`;
        break;
      default:
        alert(`Contact ${providerName} at: ${service.contact_info}`);
    }
  };

  const formatPrice = (price, currency = 'RUB') => {
    const symbols = {
      'RUB': '₽',
      'USD': '$',
      'EUR': '€',
      'ZAR': 'R',
      'ZWL': 'Z$'
    };
    const symbol = symbols[currency] || currency;
    return `${symbol} ${parseFloat(price).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const getCurrencyFlag = (currency) => {
    const flags = {
      'RUB': '🇷🇺',
      'USD': '🇺🇸',
      'EUR': '🇪🇺',
      'ZAR': '🇿🇦',
      'ZWL': '🇿🇼'
    };
    return flags[currency] || '💱';
  };

  const getServiceTypeIcon = (type) => {
    const icons = {
      'academic': '📚',
      'tutoring': '👨‍🏫',
      'translation': '🔤',
      'transportation': '🚗',
      'housing': '🏠',
      'food': '🍕',
      'legal': '⚖️',
      'medical': '🏥',
      'beauty': '💅',
      'fitness': '💪',
      'tech': '💻',
      'design': '🎨',
      'writing': '✍️',
      'consulting': '💼',
      'other': '🔧'
    };
    return icons[type] || '🔧';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const clearMessage = () => {
    setMessage({ type: '', text: '' });
  };

  if (loading && services.length === 0) {
    return (
      <div className="services-container">
        <div className="loading">Loading services...</div>
      </div>
    );
  }

  return (
    <div className="services-container">
      {/* Header */}
      <div className="services-header">
        <h1>🔧 Community Services</h1>
        <p>Find and offer services within the AinRu community</p>
        
        {user ? (
          <button 
            className="create-service-btn"
            onClick={() => setShowCreateModal(true)}
          >
            + Offer a Service
          </button>
        ) : (
          <div className="login-prompt">
            <p>Log in to offer your services or contact providers</p>
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
            <label>Search Services</label>
            <input
              type="text"
              placeholder="Search by title, description, or tags..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="search-input"
            />
          </div>

          {/* Category */}
          <div className="filter-group">
            <label>Category</label>
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="filter-select"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Service Type */}
          <div className="filter-group">
            <label>Service Type</label>
            <select
              value={filters.serviceType}
              onChange={(e) => handleFilterChange('serviceType', e.target.value)}
              className="filter-select"
            >
              <option value="">All Types</option>
              <option value="academic">📚 Academic</option>
              <option value="tutoring">👨‍🏫 Tutoring</option>
              <option value="translation">🔤 Translation</option>
              <option value="transportation">🚗 Transportation</option>
              <option value="housing">🏠 Housing</option>
              <option value="food">🍕 Food</option>
              <option value="tech">💻 Tech</option>
              <option value="other">🔧 Other</option>
            </select>
          </div>

          {/* Location */}
          <div className="filter-group">
            <label>Location</label>
            <input
              type="text"
              placeholder="City or area"
              value={filters.location}
              onChange={(e) => handleFilterChange('location', e.target.value)}
              className="search-input"
            />
          </div>

          {/* Price Range */}
          <div className="filter-group">
            <label>Price Range</label>
            <div className="price-range-inputs">
              <input
                type="number"
                placeholder="Min"
                value={filters.minPrice}
                onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                className="price-input"
              />
              <span>to</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.maxPrice}
                onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                className="price-input"
              />
            </div>
          </div>

          {/* Status */}
          <div className="filter-group">
            <label>Status</label>
            <select
              value={filters.serviceStatus}
              onChange={(e) => handleFilterChange('serviceStatus', e.target.value)}
              className="filter-select"
            >
              <option value="active">Active Services</option>
              <option value="all">All Services</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="filter-group">
            <label>Sort By</label>
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              className="filter-select"
            >
              <option value="newest">Newest First</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>

        <div className="filter-actions">
          <button 
            className="clear-filters-btn"
            onClick={() => {
              setFilters({
                search: '',
                category: '',
                serviceType: '',
                minPrice: '',
                maxPrice: '',
                location: '',
                serviceStatus: 'active',
                sortBy: 'newest'
              });
              setFilterChanged(true);
            }}
          >
            Clear Filters
          </button>
          <button 
            className="apply-filters-btn"
            onClick={() => setFilterChanged(true)}
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Results Count */}
      <div className="results-count">
        {services.length} service{services.length !== 1 ? 's' : ''} found
      </div>

      {/* Services Grid */}
      <div className="services-grid">
        {services.length === 0 ? (
          <div className="no-services">
            <h3>No services found</h3>
            <p>Be the first to offer a service or adjust your filters</p>
          </div>
        ) : (
          services.map(service => (
            <ServiceCard
              key={service.id}
              service={service}
              currentUser={user}
              onContact={() => handleContactServiceProvider(service)}
              onUpdate={handleUpdateService}
              onDelete={handleDeleteService}
              formatPrice={formatPrice}
              getCurrencyFlag={getCurrencyFlag}
              getServiceTypeIcon={getServiceTypeIcon}
              formatDate={formatDate}
            />
          ))
        )}
      </div>

      {/* Create Service Modal */}
      {showCreateModal && user && (
        <CreateServiceModal
          user={user}
          categories={categories}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateService}
        />
      )}
    </div>
  );
};

// Service Card Component
const ServiceCard = ({ 
  service, 
  currentUser, 
  onContact, 
  onUpdate, 
  onDelete,
  formatPrice,
  getCurrencyFlag,
  getServiceTypeIcon,
  formatDate
}) => {
  const isOwnService = service.user_id === currentUser?.id;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="service-card">
      {/* Service Header */}
      <div className="service-header">
        <div className="service-type-icon">
          {getServiceTypeIcon(service.service_type || 'other')}
        </div>
        <div className="service-title-section">
          <h3 className="service-title">{service.title}</h3>
          <div className="service-category">
            {service.category?.icon} {service.category?.name}
          </div>
        </div>
        <div className="service-price">
          <span className="currency-flag">{getCurrencyFlag(service.currency || 'RUB')}</span>
          <span className="price-amount">{formatPrice(service.price, service.currency || 'RUB')}</span>
          {service.price_type === 'hourly' && <span className="price-type">/hour</span>}
          {service.price_type === 'daily' && <span className="price-type">/day</span>}
          {service.price_type === 'project' && <span className="price-type">/project</span>}
        </div>
      </div>

      {/* Service Description */}
      <div className="service-description">
        {service.description.length > 150 ? (
          <>
            {expanded ? service.description : `${service.description.substring(0, 150)}...`}
            <button 
              className="read-more-btn"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Read Less' : 'Read More'}
            </button>
          </>
        ) : (
          service.description
        )}
      </div>

      {/* Service Tags */}
      {service.tags && (
        <div className="service-tags">
          {service.tags.split(',').map((tag, index) => (
            <span key={index} className="service-tag">
              #{tag.trim()}
            </span>
          ))}
        </div>
      )}

      {/* Service Details */}
      <div className="service-details">
        {service.location && (
          <div className="detail-item">
            <span className="detail-icon">📍</span>
            <span className="detail-text">{service.location}</span>
          </div>
        )}
        {service.availability && (
          <div className="detail-item">
            <span className="detail-icon">🕒</span>
            <span className="detail-text">{service.availability}</span>
          </div>
        )}
        {service.experience_years && (
          <div className="detail-item">
            <span className="detail-icon">📅</span>
            <span className="detail-text">{service.experience_years} years experience</span>
          </div>
        )}
        {service.meeting_place && (
          <div className="detail-item">
            <span className="detail-icon">🏢</span>
            <span className="detail-text">{service.meeting_place}</span>
          </div>
        )}
      </div>

      {/* Provider Info */}
      <div className="provider-info">
        <div className="provider-header">
          {service.user?.profile_picture_url ? (
            <img 
              src={service.user.profile_picture_url} 
              alt="Provider" 
              className="provider-avatar"
            />
          ) : (
            <div className="provider-avatar-initials">
              {service.user?.firstname?.[0]?.toUpperCase() || 'P'}
            </div>
          )}
          <div className="provider-details">
            <div className="provider-name">
              👤 {service.user?.firstname} {service.user?.surname}
            </div>
            {service.user?.university && (
              <div className="provider-university">
                🎓 {service.user.university}
              </div>
            )}
          </div>
        </div>
        
        {/* Rating */}
        {service.average_rating && (
          <div className="service-rating">
            <div className="rating-stars">
              {'⭐'.repeat(Math.floor(service.average_rating))}
              {'☆'.repeat(5 - Math.floor(service.average_rating))}
            </div>
            <span className="rating-value">
              {service.average_rating.toFixed(1)} ({service.review_count || 0} reviews)
            </span>
          </div>
        )}
      </div>

      {/* Service Status */}
      <div className="service-status">
        {service.status === 'active' && <span className="status-active">✅ Available</span>}
        {service.status === 'booked' && <span className="status-booked">📅 Booked</span>}
        {service.status === 'unavailable' && <span className="status-unavailable">⏸️ Unavailable</span>}
      </div>

      {/* Actions */}
      <div className="service-actions">
        {!isOwnService ? (
          <button 
            className="contact-btn"
            onClick={onContact}
            disabled={service.status !== 'active'}
            title={service.status !== 'active' ? 'Service not available' : `Contact via ${service.contact_method || 'email'}`}
          >
            📞 Contact Provider
          </button>
        ) : (
          <div className="owner-actions">
            {service.status === 'active' && (
              <button 
                className="update-btn"
                onClick={() => {
                  const newStatus = service.status === 'active' ? 'unavailable' : 'active';
                  onUpdate(service.id, { status: newStatus });
                }}
              >
                {service.status === 'active' ? '⏸️ Mark Unavailable' : '✅ Mark Available'}
              </button>
            )}
            <button 
              className="delete-btn"
              onClick={() => onDelete(service.id)}
            >
              🗑️ Delete
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="service-footer">
        <span className="service-date">Posted {formatDate(service.created_at)}</span>
        {service.updated_at !== service.created_at && (
          <span className="service-updated">Updated {formatDate(service.updated_at)}</span>
        )}
      </div>
    </div>
  );
};

// Create Service Modal Component
const CreateServiceModal = ({ user, categories, onClose, onCreate }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category_id: '',
    service_type: 'other',
    price: '',
    currency: 'RUB',
    price_type: 'hourly',
    location: '',
    meeting_place: '',
    availability: 'Flexible',
    experience_years: '',
    tags: '',
    contact_method: 'whatsapp',
    contact_info: user?.email || '',
    status: 'active'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Validation
      if (!form.title.trim()) {
        alert('Please enter a service title');
        return;
      }
      if (!form.description.trim()) {
        alert('Please enter a service description');
        return;
      }
      if (!form.price || parseFloat(form.price) <= 0) {
        alert('Please enter a valid price');
        return;
      }
      if (!form.category_id) {
        alert('Please select a category');
        return;
      }

      const serviceData = {
        title: form.title.trim(),
        description: form.description.trim(),
        category_id: form.category_id,
        service_type: form.service_type,
        price: parseFloat(form.price),
        currency: form.currency,
        price_type: form.price_type,
        location: form.location || null,
        meeting_place: form.meeting_place || null,
        availability: form.availability || null,
        experience_years: form.experience_years ? parseInt(form.experience_years) : null,
        tags: form.tags || null,
        contact_method: form.contact_method,
        contact_info: form.contact_info,
      };

      await onCreate(serviceData);
    } catch (error) {
      console.error('Error creating service:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content large-modal">
        <div className="modal-header">
          <h2>🔧 Offer Your Service</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>Basic Information</h3>
            <div className="form-columns">
              <div className="form-column">
                <div className="form-group">
                  <label>Service Title *</label>
                  <input
                    type="text"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="e.g., Russian Language Tutoring"
                    required
                    maxLength={100}
                  />
                </div>
                
                <div className="form-group">
                  <label>Category *</label>
                  <select
                    name="category_id"
                    value={form.category_id}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select a category</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.icon} {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Service Type</label>
                  <select
                    name="service_type"
                    value={form.service_type}
                    onChange={handleChange}
                  >
                    <option value="academic">📚 Academic</option>
                    <option value="tutoring">👨‍🏫 Tutoring</option>
                    <option value="translation">🔤 Translation</option>
                    <option value="transportation">🚗 Transportation</option>
                    <option value="housing">🏠 Housing</option>
                    <option value="food">🍕 Food</option>
                    <option value="tech">💻 Tech</option>
                    <option value="other">🔧 Other</option>
                  </select>
                </div>
              </div>
              
              <div className="form-column">
                <div className="form-group">
                  <label>Price *</label>
                  <div className="price-input-group">
                    <input
                      type="number"
                      name="price"
                      value={form.price}
                      onChange={handleChange}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      required
                      className="price-input"
                    />
                    <select
                      name="currency"
                      value={form.currency}
                      onChange={handleChange}
                      className="currency-select"
                    >
                      <option value="RUB">🇷🇺 RUB</option>
                      <option value="USD">🇺🇸 USD</option>
                      <option value="EUR">🇪🇺 EUR</option>
                      <option value="ZAR">🇿🇦 ZAR</option>
                      <option value="ZWL">🇿🇼 ZWL</option>
                    </select>
                    <select
                      name="price_type"
                      value={form.price_type}
                      onChange={handleChange}
                      className="price-type-select"
                    >
                      <option value="hourly">per hour</option>
                      <option value="daily">per day</option>
                      <option value="project">per project</option>
                      <option value="fixed">fixed price</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    name="location"
                    value={form.location}
                    onChange={handleChange}
                    placeholder="e.g., Moscow, Online"
                  />
                </div>
                
                <div className="form-group">
                  <label>Experience (years)</label>
                  <input
                    type="number"
                    name="experience_years"
                    value={form.experience_years}
                    onChange={handleChange}
                    placeholder="e.g., 2"
                    min="0"
                    max="50"
                  />
                </div>
              </div>
            </div>
            
            <div className="form-group">
              <label>Description *</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe your service in detail. Include what you offer, your qualifications, and what clients can expect."
                rows="4"
                required
                maxLength={2000}
              />
            </div>
            
            <div className="form-group">
              <label>Tags (comma separated)</label>
              <input
                type="text"
                name="tags"
                value={form.tags}
                onChange={handleChange}
                placeholder="e.g., tutoring, russian, language, online"
              />
              <small className="form-hint">Help people find your service with relevant tags</small>
            </div>
          </div>
          
          <div className="form-section">
            <h3>Service Details</h3>
            <div className="form-columns">
              <div className="form-column">
                <div className="form-group">
                  <label>Availability</label>
                  <input
                    type="text"
                    name="availability"
                    value={form.availability}
                    onChange={handleChange}
                    placeholder="e.g., Weekdays 9am-5pm, Flexible"
                  />
                </div>
                
                <div className="form-group">
                  <label>Meeting Place</label>
                  <input
                    type="text"
                    name="meeting_place"
                    value={form.meeting_place}
                    onChange={handleChange}
                    placeholder="e.g., Online, University Campus, Coffee Shop"
                  />
                </div>
              </div>
              
              <div className="form-column">
                <div className="form-group">
                  <label>Contact Method *</label>
                  <select
                    name="contact_method"
                    value={form.contact_method}
                    onChange={handleChange}
                    required
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="telegram">Telegram</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone Call</option>
                    <option value="in_app">In-app Messaging</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Contact Information *</label>
                  <input
                    type="text"
                    name="contact_info"
                    value={form.contact_info}
                    onChange={handleChange}
                    placeholder={
                      form.contact_method === 'email' ? 'your.email@example.com' :
                      form.contact_method === 'whatsapp' || form.contact_method === 'phone' ? '+27 12 345 6789' :
                      form.contact_method === 'telegram' ? '@username or phone number' :
                      'Contact information'
                    }
                    required
                  />
                  <small className="form-hint">
                    {form.contact_method === 'email' 
                      ? 'Clients will contact you via email'
                      : form.contact_method === 'in_app'
                      ? 'Clients will message you within the app'
                      : 'Include country code for phone numbers'}
                  </small>
                </div>
              </div>
            </div>
          </div>
          
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Publish Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Services;