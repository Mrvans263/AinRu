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
    status: 'active',
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
        .from('marketplace_categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCategories(data || []);
      
      // Fetch services after categories
      fetchServices();
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
          category:marketplace_categories(name, icon),
          user:users(firstname, surname, email, phone, profile_picture_url, university)
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.category) {
        query = query.eq('category_id', filters.category);
      }
      if (filters.serviceType) {
        query = query.eq('service_type', filters.serviceType);
      }
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }
      if (filters.location) {
        query = query.ilike('location', `%${filters.location}%`);
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

  // Image upload function - FIXED VERSION
  const uploadImage = async (file, userId) => {
    try {
      console.log('📤 Starting image upload...', {
        fileName: file?.name,
        fileSize: file?.size,
        fileType: file?.type,
        userId
      });
      
      if (!file) {
        console.log('No file provided');
        return null;
      }
      
      if (!userId) {
        throw new Error('User ID is required for image upload');
      }
      
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size must be less than 5MB');
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      
      console.log('Uploading to bucket: service-images');
      console.log('Filename:', fileName);
      
      // Upload the file
      const { data, error: uploadError } = await supabase.storage
        .from('service-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        
        // Check bucket access
        const { data: buckets } = await supabase.storage.listBuckets();
        console.log('Available buckets:', buckets);
        
        throw uploadError;
      }

      console.log('Upload successful, data:', data);
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('service-images')
        .getPublicUrl(fileName);
      
      console.log('Generated public URL:', urlData.publicUrl);
      
      return urlData.publicUrl;
    } catch (error) {
      console.error('Image upload failed with details:', {
        name: error.name,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
  };

  const handleCreateService = async (serviceData) => {
    try {
      console.log('Creating service:', serviceData);
      
      const insertData = {
        user_id: user.id,
        category_id: serviceData.category_id ? parseInt(serviceData.category_id) : null,
        title: serviceData.title,
        description: serviceData.description,
        price: parseFloat(serviceData.price),
        currency: serviceData.currency || 'RUB',
        price_negotiable: serviceData.price_negotiable || false,
        service_type: serviceData.service_type || 'academic',
        condition: 'new',
        availability: serviceData.availability || null,
        experience_years: serviceData.experience_years ? parseInt(serviceData.experience_years) : null,
        meeting_place: serviceData.meeting_place || null,
        location: serviceData.location || null,
        contact_method: serviceData.contact_method || 'whatsapp',
        contact_info: serviceData.contact_info,
        status: 'active',
        tags: Array.isArray(serviceData.tags) ? serviceData.tags : [],
        image_url: serviceData.image_url || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('Insert data:', insertData);
      
      const { data, error } = await supabase
        .from('services')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      
      setMessage({ type: 'success', text: 'Service created successfully!' });
      setShowCreateModal(false);
      await fetchServices();
      return data;
    } catch (error) {
      console.error('Error creating service:', error);
      setMessage({ type: 'error', text: 'Failed to create service: ' + error.message });
      throw error;
    }
  };

  const handleUpdateService = async (serviceId, updates) => {
    try {
      const { error } = await supabase
        .from('services')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
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
      default:
        alert(`Contact ${providerName} at: ${service.contact_info}`);
    }
  };

  // Test storage function
  const testStorageSetup = async () => {
    console.log('🔍 Testing storage setup...');
    
    try {
      // 1. Get current user
      if (!user) {
        console.error('❌ User not authenticated. Please log in first.');
        alert('Please log in first to test storage');
        return;
      }
      
      // 2. List buckets to confirm service-images exists
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      if (bucketsError) {
        console.error('❌ Cannot list buckets:', bucketsError);
        alert('Cannot list buckets: ' + bucketsError.message);
        return;
      }
      
      console.log('📦 Available buckets:', buckets.map(b => b.name));
      const serviceBucket = buckets.find(b => b.name === 'service-images');
      
      if (!serviceBucket) {
        console.error('❌ service-images bucket not found!');
        alert('service-images bucket not found! Please create it in Supabase Dashboard → Storage');
        return;
      }
      
      console.log('✅ service-images bucket found:', serviceBucket);
      
      // 3. Test upload with a small text file
      console.log('⬆️ Testing upload...');
      const testContent = 'This is a test file for storage verification';
      const testFile = new File([testContent], 'storage-test.txt', { 
        type: 'text/plain' 
      });
      
      const testFileName = `test-${user.id}-${Date.now()}.txt`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('service-images')
        .upload(testFileName, testFile);
      
      if (uploadError) {
        console.error('❌ Upload failed:', uploadError);
        alert('Upload test failed: ' + uploadError.message + '\n\nCheck your storage policies in the dashboard.');
        return;
      }
      
      console.log('✅ Upload successful:', uploadData);
      
      // 4. Get public URL
      const { data: urlData } = supabase.storage
        .from('service-images')
        .getPublicUrl(testFileName);
      
      console.log('🔗 Public URL:', urlData.publicUrl);
      
      // 5. Test that we can access the file
      const response = await fetch(urlData.publicUrl);
      if (response.ok) {
        const text = await response.text();
        console.log('✅ File accessible via URL. Content:', text);
        alert('✅ Storage test PASSED!\n\nBucket: service-images\nUpload: ✓\nPublic URL: ✓\n\nYou can now upload service images!');
      } else {
        console.error('❌ Cannot access file via URL');
        alert('Upload worked but cannot access file via URL. Check bucket is set to "Public"');
      }
      
      // 6. Clean up test file
      await supabase.storage
        .from('service-images')
        .remove([testFileName]);
      
      console.log('🧹 Test file cleaned up');
      
    } catch (err) {
      console.error('❌ Storage test failed:', err);
      alert('Storage test failed: ' + err.message);
    }
  };

  // Helper functions
  const formatPrice = (price, currency = 'RUB') => {
    const symbols = { 'RUB': '₽', 'USD': '$', 'EUR': '€', 'ZAR': 'R', 'ZWL': 'Z$' };
    const symbol = symbols[currency] || currency;
    return `${symbol} ${parseFloat(price).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const getCurrencyFlag = (currency) => {
    const flags = { 'RUB': '🇷🇺', 'USD': '🇺🇸', 'EUR': '🇪🇺', 'ZAR': '🇿🇦', 'ZWL': '🇿🇼' };
    return flags[currency] || '💱';
  };

  const getServiceTypeIcon = (type) => {
    const icons = {
      'academic': '📚', 'tutoring': '👨‍🏫', 'translation': '🔤', 'transportation': '🚗',
      'housing': '🏠', 'food': '🍕', 'legal': '⚖️', 'medical': '🏥', 'beauty': '💅',
      'fitness': '💪', 'tech': '💻', 'design': '🎨', 'writing': '✍️', 'consulting': '💼',
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
        <h1>🔧 AinRu Services</h1>
        <p>Find and offer services within our African community in Russia</p>
        
        <div className="header-actions">
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
          
          {/* Storage Test Button - Temporary for debugging */}
          {user && (
            <button 
              className="test-storage-btn"
              onClick={testStorageSetup}
              style={{
                marginLeft: '10px',
                background: '#6c757d',
                fontSize: '12px',
                padding: '5px 10px'
              }}
            >
              Test Storage
            </button>
          )}
        </div>
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
          <div className="filter-group">
            <label>Search</label>
            <input
              type="text"
              placeholder="Search services..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="search-input"
            />
          </div>

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
              <option value="other">🔧 Other</option>
            </select>
          </div>

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
                status: 'active',
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
          uploadImage={uploadImage}
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

  return (
    <div className="service-card">
      {/* Service Image (Optional) */}
      {service.image_url && (
        <div className="service-image-container">
          <img 
            src={service.image_url} 
            alt={service.title}
            className="service-image"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentElement.innerHTML = `
                <div class="image-error-placeholder">
                  📷 Image not available
                </div>
              `;
            }}
          />
        </div>
      )}

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
          {service.price_negotiable && <span className="negotiable-badge">Negotiable</span>}
        </div>
      </div>

      {/* Service Description */}
      <div className="service-description">
        {service.description}
      </div>

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
      </div>

      {/* Provider Info */}
      <div className="provider-info">
        <div className="provider-header">
          <div className="avatar-container">
            {service.user?.profile_picture_url ? (
              <>
                <img 
                  src={service.user.profile_picture_url} 
                  alt="Provider" 
                  className="provider-avatar"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div className="provider-avatar-initials">
                  {service.user?.firstname?.[0]?.toUpperCase() || 'P'}
                </div>
              </>
            ) : (
              <div className="provider-avatar-initials">
                {service.user?.firstname?.[0]?.toUpperCase() || 'P'}
              </div>
            )}
          </div>
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
      </div>
    </div>
  );
};

// Create Service Modal Component - UPDATED with fixed image upload
const CreateServiceModal = ({ user, categories, onClose, onCreate, uploadImage }) => {
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    category_id: '',
    service_type: 'academic',
    price: '',
    currency: 'RUB',
    price_negotiable: false,
    location: '',
    meeting_place: '',
    availability: 'Flexible',
    experience_years: '',
    tags: '',
    contact_method: 'whatsapp',
    contact_info: user?.email || '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Validation
      if (!form.title.trim()) {
        alert('Please enter a service title');
        setLoading(false);
        return;
      }
      if (!form.description.trim()) {
        alert('Please enter a service description');
        setLoading(false);
        return;
      }
      if (!form.price || parseFloat(form.price) <= 0) {
        alert('Please enter a valid price');
        setLoading(false);
        return;
      }
      if (!form.category_id) {
        alert('Please select a category');
        setLoading(false);
        return;
      }

      // Upload image if selected
      let imageUrl = null;
      if (imageFile && user?.id) {
        setUploadingImage(true);
        try {
          console.log('Uploading image for service creation...');
          imageUrl = await uploadImage(imageFile, user.id);
          console.log('Image uploaded successfully:', imageUrl);
        } catch (error) {
          console.error('Image upload error:', error);
          // Don't fail the whole submission if image upload fails
          // Just continue without the image
          imageUrl = null;
        } finally {
          setUploadingImage(false);
        }
      }

      // Parse tags
      const tagsArray = form.tags 
        ? form.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
        : [];

      const serviceData = {
        title: form.title.trim(),
        description: form.description.trim(),
        category_id: parseInt(form.category_id),
        service_type: form.service_type,
        price: parseFloat(form.price),
        currency: form.currency,
        price_negotiable: form.price_negotiable,
        location: form.location || null,
        meeting_place: form.meeting_place || null,
        availability: form.availability || null,
        experience_years: form.experience_years ? parseInt(form.experience_years) : null,
        tags: tagsArray,
        contact_method: form.contact_method,
        contact_info: form.contact_info,
        image_url: imageUrl,
      };

      console.log('Submitting service data:', serviceData);
      await onCreate(serviceData);
      setLoading(false);
    } catch (error) {
      console.error('Error creating service:', error);
      alert('Failed to create service: ' + error.message);
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
      }
      
      setImageFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  // Calculate formatted price for preview
  const getCurrencyFlag = (currency) => {
    const flags = { 'RUB': '🇷🇺', 'USD': '🇺🇸', 'EUR': '🇪🇺', 'ZAR': '🇿🇦', 'ZWL': '🇿🇼' };
    return flags[currency] || '💱';
  };

  const formattedPrice = form.price 
    ? `${getCurrencyFlag(form.currency)} ${parseFloat(form.price).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`
    : '';

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>🔧 Offer Your Service</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          {/* Image Upload */}
          <div className="form-section">
            <h3>Service Image (Optional)</h3>
            <div className="image-upload-section">
              {imagePreview ? (
                <div className="image-preview-container">
                  <img src={imagePreview} alt="Preview" className="image-preview" />
                  <button 
                    type="button" 
                    className="remove-image-btn"
                    onClick={removeImage}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="image-upload-area">
                  <input
                    type="file"
                    id="service-image-upload"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="image-input"
                  />
                  <label htmlFor="service-image-upload" className="upload-label">
                    📷 Upload Service Image
                  </label>
                  <p className="upload-hint">Optional. Max 5MB</p>
                </div>
              )}
            </div>
          </div>

          <div className="form-section">
            <h3>Basic Information</h3>
            
            <div className="form-group">
              <label>Service Title *</label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="e.g., Russian Language Tutoring"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Description *</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe your service..."
                rows="4"
                required
              />
            </div>
            
            <div className="form-columns">
              <div className="form-column">
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
                    <option value="other">🔧 Other</option>
                  </select>
                </div>
              </div>
              
              <div className="form-column">
                {/* Wide Price Input */}
                <div className="form-group">
                  <label>Price *</label>
                  <div className="wide-price-input-group">
                    <div className="price-input-with-preview">
                      <input
                        type="number"
                        name="price"
                        value={form.price}
                        onChange={handleChange}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        required
                        className="wide-price-input"
                      />
                      {form.price && (
                        <div className="price-preview">
                          {formattedPrice}
                        </div>
                      )}
                    </div>
                    <div className="price-options-row">
                      <select
                        name="currency"
                        value={form.currency}
                        onChange={handleChange}
                        className="currency-select-wide"
                      >
                        <option value="RUB">🇷🇺 RUB</option>
                        <option value="USD">🇺🇸 USD</option>
                        <option value="EUR">🇪🇺 EUR</option>
                        <option value="ZAR">🇿🇦 ZAR</option>
                      </select>
                      <div className="checkbox-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            name="price_negotiable"
                            checked={form.price_negotiable}
                            onChange={handleChange}
                          />
                          Price negotiable
                        </label>
                      </div>
                    </div>
                  </div>
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
                  />
                </div>
              </div>
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
            </div>
          </div>
          
          <div className="form-section">
            <h3>Location & Availability</h3>
            
            <div className="form-columns">
              <div className="form-column">
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
                  <label>Meeting Place</label>
                  <input
                    type="text"
                    name="meeting_place"
                    value={form.meeting_place}
                    onChange={handleChange}
                    placeholder="e.g., University Campus"
                  />
                </div>
              </div>
              
              <div className="form-column">
                <div className="form-group">
                  <label>Availability</label>
                  <input
                    type="text"
                    name="availability"
                    value={form.availability}
                    onChange={handleChange}
                    placeholder="e.g., Weekdays 9am-5pm"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="form-section">
            <h3>Contact Information</h3>
            
            <div className="form-columns">
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
                    <option value="phone">Phone</option>
                  </select>
                </div>
              </div>
              
              <div className="form-column">
                <div className="form-group">
                  <label>Contact Information *</label>
                  <input
                    type="text"
                    name="contact_info"
                    value={form.contact_info}
                    onChange={handleChange}
                    placeholder={
                      form.contact_method === 'email' ? 'your.email@example.com' : '+27 12 345 6789'
                    }
                    required
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading || uploadingImage}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading || uploadingImage}>
              {uploadingImage ? 'Uploading Image...' : loading ? 'Creating Service...' : 'Publish Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Services;