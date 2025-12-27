import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import './TravelDeals.css';

const TravelDeals = () => {
  const [user, setUser] = useState(null);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState({
    fromCountry: '',
    toCountry: '',
    departureDate: '',
    maxDate: '',
    minSpace: '',
    status: 'active'
  });
  const [filterChanged, setFilterChanged] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (filterChanged) {
      fetchDeals();
    }
  }, [filters]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user || null);
    fetchDeals();
  };

  const fetchDeals = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('travel_deals')
        .select(`
          *,
          user:users(firstname, surname, email, phone)
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.fromCountry) {
        query = query.ilike('from_country', `%${filters.fromCountry}%`);
      }
      if (filters.toCountry) {
        query = query.ilike('to_country', `%${filters.toCountry}%`);
      }
      if (filters.departureDate) {
        query = query.gte('departure_date', filters.departureDate);
      }
      if (filters.maxDate) {
        query = query.lte('departure_date', filters.maxDate);
      }
      if (filters.minSpace) {
        query = query.gte('available_space_kg', parseFloat(filters.minSpace));
      }

      const { data, error } = await query;
      if (error) throw error;
      setDeals(data || []);
    } catch (error) {
      console.error('Error fetching travel deals:', error);
      setDeals([]);
    } finally {
      setLoading(false);
      setFilterChanged(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setFilterChanged(true);
  };

  const handleCreateDeal = async (dealData) => {
    try {
      const { data, error } = await supabase
        .from('travel_deals')
        .insert([{
          ...dealData,
          user_id: user.id,
          status: 'active'
        }])
        .select()
        .single();

      if (error) throw error;
      await fetchDeals();
      return data;
    } catch (error) {
      console.error('Error creating travel deal:', error);
      throw error;
    }
  };

  const handleContact = (deal) => {
    if (!deal.contact_info) {
      alert('No contact information available');
      return;
    }

    const travelerName = `${deal.user?.firstname || 'Traveler'} ${deal.user?.surname || ''}`;
    const message = `Hi ${travelerName}, I'm interested in your travel deal from ${deal.from_city} to ${deal.to_city}`;
    
    switch (deal.contact_method) {
      case 'whatsapp':
        const phone = deal.contact_info.replace(/\D/g, '');
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
        break;
      case 'telegram':
        const tgPhone = deal.contact_info.replace(/\D/g, '');
        window.open(`https://t.me/+${tgPhone}`, '_blank');
        break;
      case 'email':
        window.location.href = `mailto:${deal.contact_info}?subject=Travel Deal: ${deal.from_city} to ${deal.to_city}&body=${encodeURIComponent(message)}`;
        break;
      default:
        alert(`Contact ${travelerName} at: ${deal.contact_info}`);
    }
  };

  const handleCompleteDeal = async (dealId) => {
    if (!window.confirm('Mark this travel deal as completed?')) return;
    
    try {
      const { error } = await supabase
        .from('travel_deals')
        .update({ status: 'completed' })
        .eq('id', dealId)
        .eq('user_id', user.id);

      if (error) throw error;
      await fetchDeals();
      alert('Travel deal marked as completed!');
    } catch (error) {
      console.error('Error completing deal:', error);
      alert('Failed to complete deal');
    }
  };

  const handleDeleteDeal = async (dealId) => {
    if (!window.confirm('Are you sure you want to delete this travel deal?')) return;
    
    try {
      const { error } = await supabase
        .from('travel_deals')
        .update({ status: 'cancelled' })
        .eq('id', dealId)
        .eq('user_id', user.id);

      if (error) throw error;
      await fetchDeals();
      alert('Travel deal deleted!');
    } catch (error) {
      console.error('Error deleting deal:', error);
      alert('Failed to delete deal');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCountryFlag = (country) => {
    const flags = {
      'russia': '🇷🇺',
      'zimbabwe': '🇿🇼',
      'south africa': '🇿🇦',
      'usa': '🇺🇸',
      'uk': '🇬🇧',
      'germany': '🇩🇪',
      'france': '🇫🇷',
      'china': '🇨🇳',
      'india': '🇮🇳',
      'nigeria': '🇳🇬',
      'kenya': '🇰🇪',
      'egypt': '🇪🇬',
      'ethiopia': '🇪🇹',
      'ghana': '🇬🇭',
      'tanzania': '🇹🇿'
    };
    return flags[country?.toLowerCase()] || '🌍';
  };

  const getTravelTypeIcon = (type) => {
    const icons = {
      'flight': '✈️',
      'bus': '🚌',
      'train': '🚆',
      'car': '🚗',
      'ship': '🚢',
      'mixed': '🔄'
    };
    return icons[type] || '🧳';
  };

  if (loading && deals.length === 0) {
    return (
      <div className="travel-deals-container">
        <div className="loading">Loading travel deals...</div>
      </div>
    );
  }

  return (
    <div className="travel-deals-container">
      {/* Header */}
      <div className="deals-header">
        <h1>✈️ Travel & Courier Deals</h1>
        <p>Find travelers who can carry items for you or offer luggage space</p>
        
        {user ? (
          <button className="create-deal-btn" onClick={() => setShowCreate(true)}>
            + Post Travel Deal
          </button>
        ) : (
          <p className="login-prompt">Login to post travel deals</p>
        )}
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label>From Country</label>
            <input
              type="text"
              placeholder="e.g., Russia"
              value={filters.fromCountry}
              onChange={(e) => handleFilterChange('fromCountry', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>To Country</label>
            <input
              type="text"
              placeholder="e.g., Zimbabwe"
              value={filters.toCountry}
              onChange={(e) => handleFilterChange('toCountry', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Departure From</label>
            <input
              type="date"
              value={filters.departureDate}
              onChange={(e) => handleFilterChange('departureDate', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Departure To</label>
            <input
              type="date"
              value={filters.maxDate}
              onChange={(e) => handleFilterChange('maxDate', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Min Space (kg)</label>
            <input
              type="number"
              placeholder="e.g., 5"
              value={filters.minSpace}
              onChange={(e) => handleFilterChange('minSpace', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Status</label>
            <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        <div className="filter-actions">
          <button 
            className="clear-filters-btn"
            onClick={() => {
              setFilters({
                fromCountry: '',
                toCountry: '',
                departureDate: '',
                maxDate: '',
                minSpace: '',
                status: 'active'
              });
              setFilterChanged(true);
            }}
          >
            Clear Filters
          </button>
          <button 
            className="apply-filters-btn"
            onClick={fetchDeals}
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Results Count */}
      <div className="results-count">
        Found {deals.length} travel deal{deals.length !== 1 ? 's' : ''}
      </div>

      {/* Deals Grid */}
      <div className="deals-grid">
        {deals.length === 0 ? (
          <div className="no-deals">
            <h3>No travel deals found</h3>
            <p>Be the first to post a travel deal or adjust your filters</p>
          </div>
        ) : (
          deals.map(deal => (
            <DealCard 
              key={deal.id} 
              deal={deal} 
              currentUser={user}
              onContact={() => handleContact(deal)}
              onComplete={() => handleCompleteDeal(deal.id)}
              onDelete={() => handleDeleteDeal(deal.id)}
              formatDate={formatDate}
              getCountryFlag={getCountryFlag}
              getTravelTypeIcon={getTravelTypeIcon}
            />
          ))
        )}
      </div>

      {/* Create Deal Modal */}
      {showCreate && user && (
        <CreateDealModal
          user={user}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreateDeal}
        />
      )}
    </div>
  );
};

// Deal Card Component
const DealCard = ({ deal, currentUser, onContact, onComplete, onDelete, formatDate, getCountryFlag, getTravelTypeIcon }) => {
  const isOwnDeal = deal.user_id === currentUser?.id;
  const today = new Date();
  const departureDate = new Date(deal.departure_date);
  const isUpcoming = departureDate > today;

  return (
    <div className={`deal-card ${!isUpcoming ? 'past-deal' : ''}`}>
      {/* Deal Header */}
      <div className="deal-header">
        <div className="route-info">
          <span className="from-location">
            {getCountryFlag(deal.from_country)} {deal.from_city}
          </span>
          <span className="route-arrow">→</span>
          <span className="to-location">
            {getCountryFlag(deal.to_country)} {deal.to_city}
          </span>
        </div>
        <div className="deal-status">
          {deal.status === 'active' && isUpcoming && <span className="status-active">Active</span>}
          {deal.status === 'active' && !isUpcoming && <span className="status-past">Traveled</span>}
          {deal.status === 'completed' && <span className="status-completed">Completed</span>}
          {deal.status === 'cancelled' && <span className="status-cancelled">Cancelled</span>}
        </div>
      </div>

      {/* Travel Details */}
      <div className="travel-details">
        <div className="detail-row">
          <span className="detail-label">📅 Departure:</span>
          <span className="detail-value">
            {formatDate(deal.departure_date)}
            {deal.return_date && ` • Return: ${formatDate(deal.return_date)}`}
          </span>
        </div>
        
        <div className="detail-row">
          <span className="detail-label">{getTravelTypeIcon(deal.travel_type)} Type:</span>
          <span className="detail-value">{deal.travel_type} • {deal.transport_company || 'Not specified'}</span>
        </div>
        
        <div className="detail-row">
          <span className="detail-label">🎫 Flight/Ticket:</span>
          <span className="detail-value">{deal.flight_number || 'Not specified'}</span>
        </div>
      </div>

      {/* Luggage Space */}
      <div className="space-section">
        <div className="space-header">
          <span className="space-label">🧳 Available Space:</span>
          <span className="space-value">{deal.available_space_kg} kg</span>
        </div>
        
        {deal.commission_per_kg && (
          <div className="commission-row">
            <span className="commission-label">💵 Commission:</span>
            <span className="commission-value">
              ${deal.commission_per_kg}/kg • Total: ${(deal.commission_per_kg * deal.available_space_kg).toFixed(2)}
            </span>
          </div>
        )}
        
        {deal.max_weight_per_item && (
          <div className="weight-row">
            <span className="weight-label">⚖️ Max per item:</span>
            <span className="weight-value">{deal.max_weight_per_item} kg</span>
          </div>
        )}
      </div>

      {/* Restrictions & Notes */}
      {(deal.restricted_items || deal.notes) && (
        <div className="notes-section">
          {deal.restricted_items && (
            <div className="restrictions">
              <span className="notes-label">🚫 Restrictions:</span>
              <span className="notes-value">{deal.restricted_items}</span>
            </div>
          )}
          {deal.notes && (
            <div className="notes">
              <span className="notes-label">📝 Notes:</span>
              <span className="notes-value">{deal.notes}</span>
            </div>
          )}
        </div>
      )}

      {/* Contact & Pickup Info */}
      <div className="contact-section">
        <div className="contact-row">
          <span className="contact-label">📞 Contact via:</span>
          <span className="contact-value">{deal.contact_method}</span>
        </div>
        
        {deal.meeting_point && (
          <div className="meeting-row">
            <span className="meeting-label">📍 Meeting:</span>
            <span className="meeting-value">{deal.meeting_point}</span>
          </div>
        )}
      </div>

      {/* Traveler Info */}
      <div className="traveler-info">
        <span className="traveler-name">
          👤 {deal.user?.firstname || 'Traveler'} {deal.user?.surname || ''}
        </span>
        <span className="deal-date">
          Posted {formatDate(deal.created_at)}
        </span>
      </div>

      {/* Actions */}
      <div className="deal-actions">
        {!isOwnDeal && isUpcoming && deal.status === 'active' ? (
          <button className="contact-btn" onClick={onContact}>
            📞 Contact Traveler
          </button>
        ) : isOwnDeal ? (
          <div className="owner-actions">
            {deal.status === 'active' && isUpcoming && (
              <button className="complete-btn" onClick={onComplete}>
                ✅ Mark as Completed
              </button>
            )}
            <button className="delete-btn" onClick={onDelete}>
              🗑️ {deal.status === 'cancelled' ? 'Remove' : 'Delete'}
            </button>
          </div>
        ) : (
          <button className="contact-btn disabled" disabled>
            ⏳ Travel Completed
          </button>
        )}
      </div>
    </div>
  );
};

// Create Deal Modal Component
const CreateDealModal = ({ user, onClose, onCreate }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    // Route
    from_country: 'Russia',
    from_city: '',
    to_country: 'Zimbabwe',
    to_city: '',
    
    // Travel Details
    departure_date: '',
    return_date: '',
    travel_type: 'flight',
    transport_company: '',
    flight_number: '',
    
    // Luggage Space
    available_space_kg: '',
    commission_per_kg: '',
    max_weight_per_item: '',
    
    // Restrictions & Notes
    restricted_items: '',
    notes: '',
    meeting_point: '',
    
    // Contact
    contact_method: 'whatsapp',
    contact_info: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const dealData = {
        from_country: form.from_country,
        from_city: form.from_city,
        to_country: form.to_country,
        to_city: form.to_city,
        departure_date: form.departure_date,
        return_date: form.return_date || null,
        travel_type: form.travel_type,
        transport_company: form.transport_company || null,
        flight_number: form.flight_number || null,
        available_space_kg: parseFloat(form.available_space_kg),
        commission_per_kg: form.commission_per_kg ? parseFloat(form.commission_per_kg) : null,
        max_weight_per_item: form.max_weight_per_item ? parseFloat(form.max_weight_per_item) : null,
        restricted_items: form.restricted_items || null,
        notes: form.notes || null,
        meeting_point: form.meeting_point || null,
        contact_method: form.contact_method,
        contact_info: form.contact_info,
      };
      
      await onCreate(dealData);
      onClose();
    } catch (error) {
      alert('Failed to create travel deal. Please try again.');
      console.error('Create deal error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Set default departure date to tomorrow
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const formattedDate = tomorrow.toISOString().split('T')[0];
    setForm(prev => ({ ...prev, departure_date: formattedDate }));
  }, []);

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>✈️ Post Travel Deal</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          {/* Route Information */}
          <div className="form-section">
            <h3>📍 Route Information</h3>
            <div className="form-columns">
              <div className="form-column">
                <div className="form-group">
                  <label>From Country *</label>
                  <input
                    type="text"
                    placeholder="e.g., Russia"
                    value={form.from_country}
                    onChange={(e) => setForm({...form, from_country: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>From City *</label>
                  <input
                    type="text"
                    placeholder="e.g., Moscow"
                    value={form.from_city}
                    onChange={(e) => setForm({...form, from_city: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="form-column">
                <div className="form-group">
                  <label>To Country *</label>
                  <input
                    type="text"
                    placeholder="e.g., Zimbabwe"
                    value={form.to_country}
                    onChange={(e) => setForm({...form, to_country: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>To City *</label>
                  <input
                    type="text"
                    placeholder="e.g., Harare"
                    value={form.to_city}
                    onChange={(e) => setForm({...form, to_city: e.target.value})}
                    required
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Travel Details */}
          <div className="form-section">
            <h3>✈️ Travel Details</h3>
            <div className="form-columns">
              <div className="form-column">
                <div className="form-group">
                  <label>Departure Date *</label>
                  <input
                    type="date"
                    value={form.departure_date}
                    onChange={(e) => setForm({...form, departure_date: e.target.value})}
                    required
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                
                <div className="form-group">
                  <label>Return Date (Optional)</label>
                  <input
                    type="date"
                    value={form.return_date}
                    onChange={(e) => setForm({...form, return_date: e.target.value})}
                    min={form.departure_date}
                  />
                </div>
              </div>
              
              <div className="form-column">
                <div className="form-group">
                  <label>Travel Type *</label>
                  <select value={form.travel_type} onChange={(e) => setForm({...form, travel_type: e.target.value})}>
                    <option value="flight">✈️ Flight</option>
                    <option value="bus">🚌 Bus</option>
                    <option value="train">🚆 Train</option>
                    <option value="car">🚗 Car</option>
                    <option value="ship">🚢 Ship</option>
                    <option value="mixed">🔄 Mixed</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Transport Company (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g., Aeroflot, Emirates"
                    value={form.transport_company}
                    onChange={(e) => setForm({...form, transport_company: e.target.value})}
                  />
                </div>
              </div>
            </div>
            
            <div className="form-group">
              <label>Flight/Ticket Number (Optional)</label>
              <input
                type="text"
                placeholder="e.g., SU 1234"
                value={form.flight_number}
                onChange={(e) => setForm({...form, flight_number: e.target.value})}
              />
            </div>
          </div>
          
          {/* Luggage Space */}
          <div className="form-section">
            <h3>🧳 Luggage Space</h3>
            <div className="form-columns">
              <div className="form-column">
                <div className="form-group">
                  <label>Available Space (kg) *</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="e.g., 23.5"
                    value={form.available_space_kg}
                    onChange={(e) => setForm({...form, available_space_kg: e.target.value})}
                    required
                    min="0.5"
                  />
                </div>
                
                <div className="form-group">
                  <label>Max Weight per Item (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="e.g., 10"
                    value={form.max_weight_per_item}
                    onChange={(e) => setForm({...form, max_weight_per_item: e.target.value})}
                    min="0.5"
                  />
                </div>
              </div>
              
              <div className="form-column">
                <div className="form-group">
                  <label>Commission per kg ($) (Optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g., 5.00"
                    value={form.commission_per_kg}
                    onChange={(e) => setForm({...form, commission_per_kg: e.target.value})}
                    min="0"
                  />
                  <small className="form-hint">
                    Leave empty if no commission required
                  </small>
                </div>
              </div>
            </div>
          </div>
          
          {/* Restrictions & Notes */}
          <div className="form-section">
            <h3>📝 Additional Information</h3>
            
            <div className="form-group">
              <label>Restricted Items</label>
              <textarea
                placeholder="Items you cannot carry (e.g., liquids over 100ml, electronics, perishables)"
                value={form.restricted_items}
                onChange={(e) => setForm({...form, restricted_items: e.target.value})}
                rows="3"
              />
            </div>
            
            <div className="form-group">
              <label>Additional Notes</label>
              <textarea
                placeholder="Any other important information for senders"
                value={form.notes}
                onChange={(e) => setForm({...form, notes: e.target.value})}
                rows="3"
              />
            </div>
            
            <div className="form-group">
              <label>Meeting Point (Optional)</label>
              <input
                type="text"
                placeholder="e.g., Domodedovo Airport, Terminal A"
                value={form.meeting_point}
                onChange={(e) => setForm({...form, meeting_point: e.target.value})}
              />
            </div>
          </div>
          
          {/* Contact Information */}
          <div className="form-section">
            <h3>📞 Contact Information</h3>
            
            <div className="form-group">
              <label>Contact Method *</label>
              <select value={form.contact_method} onChange={(e) => setForm({...form, contact_method: e.target.value})}>
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
                <option value="email">Email</option>
                <option value="phone">Phone Call</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>{user.contact_method} Contact *</label>
              <input
                type="text" 
                placeholder= {form.contact_method + " contact"} 
                value={form.contact_info}
                onChange={(e) => setForm({...form, contact_info: e.target.value})}
                required
              />
              <small className="form-hint">
                People will contact you using this information
              </small>
            </div>
          </div>
          
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Post Travel Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TravelDeals;