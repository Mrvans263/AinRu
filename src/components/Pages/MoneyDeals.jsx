import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import './MoneyDeals.css';

const MoneyDeals = () => {
  const [user, setUser] = useState(null);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState({
    haveCurrency: '',
    wantCurrency: '',
    haveCountry: '',
    wantCountry: '',
    minAmount: '',
    maxAmount: ''
  });
  const [filterChanged, setFilterChanged] = useState(false);

  // Check user on mount
  useEffect(() => {
    checkUser();
  }, []);

  // Fetch deals only when filters change, not on initial render
  useEffect(() => {
    if (filterChanged) {
      fetchDeals();
    }
  }, [filters]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user || null);
    // Fetch deals after user check
    fetchDeals();
  };

  const fetchDeals = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('money_deals')
        .select(`
          *,
          user:users(firstname, surname, email, phone)
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.haveCurrency) {
        query = query.eq('have_currency', filters.haveCurrency);
      }
      if (filters.wantCurrency) {
        query = query.eq('want_currency', filters.wantCurrency);
      }
      if (filters.haveCountry) {
        query = query.ilike('have_country', `%${filters.haveCountry}%`);
      }
      if (filters.wantCountry) {
        query = query.ilike('want_country', `%${filters.wantCountry}%`);
      }
      if (filters.minAmount) {
        query = query.gte('have_amount', parseFloat(filters.minAmount));
      }
      if (filters.maxAmount) {
        query = query.lte('have_amount', parseFloat(filters.maxAmount));
      }

      const { data, error } = await query;
      if (error) throw error;

      // Find matches for each deal
      const dealsWithMatches = await Promise.all(
        (data || []).map(async (deal) => {
          const matches = await findMatches(deal);
          return { ...deal, matches };
        })
      );

      setDeals(dealsWithMatches);
    } catch (error) {
      console.error('Error fetching deals:', error);
      setDeals([]);
    } finally {
      setLoading(false);
      setFilterChanged(false);
    }
  };

  const findMatches = async (deal) => {
    try {
      // Find complementary deals
      const { data, error } = await supabase
        .from('money_deals')
        .select('*, user:users(firstname, surname)')
        .eq('status', 'active')
        .eq('have_currency', deal.want_currency)
        .eq('want_currency', deal.have_currency)
        .neq('user_id', deal.user_id)
        .limit(5);

      if (error) return [];
      return data || [];
    } catch (error) {
      console.error('Error finding matches:', error);
      return [];
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setFilterChanged(true);
  };

  const handleCreateDeal = async (dealData) => {
    try {
      const { data, error } = await supabase
        .from('money_deals')
        .insert([{
          ...dealData,
          user_id: user.id,
          status: 'active'
        }])
        .select()
        .single();

      if (error) throw error;
      
      // Refresh deals
      await fetchDeals();
      return data;
    } catch (error) {
      console.error('Error creating deal:', error);
      throw error;
    }
  };

  const handleContact = (deal) => {
    if (!deal.contact_info) {
      alert('No contact information available');
      return;
    }

    const sellerName = `${deal.user?.firstname || 'Seller'} ${deal.user?.surname || ''}`;
    const message = `Hi ${sellerName}, I'm interested in your money exchange deal: ${deal.title}`;
    
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
        window.location.href = `mailto:${deal.contact_info}?subject=Money Exchange: ${deal.title}&body=${encodeURIComponent(message)}`;
        break;
      case 'phone':
        if (window.confirm(`Call ${sellerName} at ${deal.contact_info}?`)) {
          window.location.href = `tel:${deal.contact_info}`;
        }
        break;
      default:
        alert(`Contact ${sellerName} at: ${deal.contact_info}`);
    }
  };

  const handleCompleteDeal = async (dealId) => {
    if (!window.confirm('Mark this deal as completed?')) return;
    
    try {
      const { error } = await supabase
        .from('money_deals')
        .update({ status: 'completed' })
        .eq('id', dealId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Refresh deals
      await fetchDeals();
      alert('Deal marked as completed!');
    } catch (error) {
      console.error('Error completing deal:', error);
      alert('Failed to complete deal');
    }
  };

  const handleDeleteDeal = async (dealId) => {
    if (!window.confirm('Are you sure you want to delete this deal?')) return;
    
    try {
      const { error } = await supabase
        .from('money_deals')
        .update({ status: 'cancelled' })
        .eq('id', dealId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Refresh deals
      await fetchDeals();
      alert('Deal deleted!');
    } catch (error) {
      console.error('Error deleting deal:', error);
      alert('Failed to delete deal');
    }
  };

  const formatAmount = (amount, currency) => {
    const symbols = {
      'RUB': '₽', 'USD': '$', 'ZWL': 'Z$', 'ZAR': 'R',
      'EUR': '€', 'GBP': '£'
    };
    const symbol = symbols[currency] || currency;
    const formattedAmount = parseFloat(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${symbol} ${formattedAmount}`;
  };

  const getMethodIcon = (method) => {
    const icons = {
      'cash': '💵',
      'sberbank': '🏦',
      'tinkoff': '🏛️',
      'alfa-bank': '🏢',
      'ecocash': '📱',
      'inbucks': '💰',
      'one money': '💸',
      'bank transfer': '🏦',
      'paypal': '🔵',
      'wise': '🟢'
    };
    return icons[method?.toLowerCase()] || '💳';
  };

  const getCountryFlag = (country) => {
    const flags = {
      'russia': '🇷🇺',
      'zimbabwe': '🇿🇼',
      'south africa': '🇿🇦',
      'usa': '🇺🇸',
      'uk': '🇬🇧',
      'germany': '🇩🇪'
    };
    return flags[country?.toLowerCase()] || '🌍';
  };

  if (loading && deals.length === 0) {
    return (
      <div className="money-deals-container">
        <div className="loading">Loading money deals...</div>
      </div>
    );
  }

  return (
    <div className="money-deals-container">
      {/* Header */}
      <div className="deals-header">
        <h1>💱 Peer-to-Peer Money Exchange</h1>
        <p>Find people who have what you need, and need what you have</p>
        
        {user ? (
          <button className="create-deal-btn" onClick={() => setShowCreate(true)}>
            + Create Exchange Deal
          </button>
        ) : (
          <p className="login-prompt">Login to create exchange deals</p>
        )}
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label>I Have Currency</label>
            <select 
              value={filters.haveCurrency} 
              onChange={(e) => handleFilterChange('haveCurrency', e.target.value)}
            >
              <option value="">Any Currency</option>
              <option value="RUB">🇷🇺 Russian Ruble (RUB)</option>
              <option value="USD">🇺🇸 US Dollar (USD)</option>
              <option value="ZWL">🇿🇼 Zimbabwe Dollar (ZWL)</option>
              <option value="ZAR">🇿🇦 South African Rand (ZAR)</option>
            </select>
          </div>

          <div className="filter-group">
            <label>I Want Currency</label>
            <select 
              value={filters.wantCurrency} 
              onChange={(e) => handleFilterChange('wantCurrency', e.target.value)}
            >
              <option value="">Any Currency</option>
              <option value="RUB">🇷🇺 Russian Ruble (RUB)</option>
              <option value="USD">🇺🇸 US Dollar (USD)</option>
              <option value="ZWL">🇿🇼 Zimbabwe Dollar (ZWL)</option>
              <option value="ZAR">🇿🇦 South African Rand (ZAR)</option>
            </select>
          </div>

          <div className="filter-group">
            <label>From Country</label>
            <input
              type="text"
              placeholder="e.g., Russia"
              value={filters.haveCountry}
              onChange={(e) => handleFilterChange('haveCountry', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>To Country</label>
            <input
              type="text"
              placeholder="e.g., Zimbabwe"
              value={filters.wantCountry}
              onChange={(e) => handleFilterChange('wantCountry', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Min Amount</label>
            <input
              type="number"
              placeholder="Minimum"
              value={filters.minAmount}
              onChange={(e) => handleFilterChange('minAmount', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Max Amount</label>
            <input
              type="number"
              placeholder="Maximum"
              value={filters.maxAmount}
              onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
            />
          </div>
        </div>

        <div className="filter-actions">
          <button 
            className="clear-filters-btn"
            onClick={() => {
              setFilters({
                haveCurrency: '',
                wantCurrency: '',
                haveCountry: '',
                wantCountry: '',
                minAmount: '',
                maxAmount: ''
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
        Found {deals.length} deal{deals.length !== 1 ? 's' : ''}
      </div>

      {/* Deals Grid */}
      <div className="deals-grid">
        {deals.length === 0 ? (
          <div className="no-deals">
            <h3>No exchange deals found</h3>
            <p>Be the first to create a deal or adjust your filters</p>
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
              formatAmount={formatAmount}
              getMethodIcon={getMethodIcon}
              getCountryFlag={getCountryFlag}
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
const DealCard = ({ deal, currentUser, onContact, onComplete, onDelete, formatAmount, getMethodIcon, getCountryFlag }) => {
  const isOwnDeal = deal.user_id === currentUser?.id;

  return (
    <div className="deal-card">
      {/* Deal Header */}
      <div className="deal-header">
        <h3>{deal.title || 'Exchange Deal'}</h3>
        <div className="deal-status">
          {deal.status === 'active' && <span className="status-active">Active</span>}
          {deal.status === 'matched' && <span className="status-matched">Matched</span>}
          {deal.status === 'completed' && <span className="status-completed">Completed</span>}
        </div>
      </div>

      {/* What I Have */}
      <div className="deal-section have-section">
        <div className="section-title">I Have:</div>
        <div className="amount-row">
          <span className="amount">{formatAmount(deal.have_amount, deal.have_currency)}</span>
          <span className="currency-flag">{getCountryFlag(deal.have_country)}</span>
        </div>
        <div className="method-row">
          <span className="method-icon">{getMethodIcon(deal.have_method)}</span>
          <span className="method-name">{deal.have_method}</span>
          {deal.have_city && <span className="location"> in {deal.have_city}</span>}
        </div>
        {deal.have_details && (
          <div className="details">{deal.have_details}</div>
        )}
      </div>

      {/* Arrow */}
      <div className="exchange-arrow">⇄</div>

      {/* What I Want */}
      <div className="deal-section want-section">
        <div className="section-title">I Want:</div>
        <div className="amount-row">
          <span className="amount">{formatAmount(deal.want_amount, deal.want_currency)}</span>
          <span className="currency-flag">{getCountryFlag(deal.want_country)}</span>
        </div>
        <div className="method-row">
          <span className="method-icon">{getMethodIcon(deal.want_method)}</span>
          <span className="method-name">{deal.want_method}</span>
          {deal.want_city && <span className="location"> in {deal.want_city}</span>}
        </div>
        {deal.want_details && (
          <div className="details">{deal.want_details}</div>
        )}
      </div>

      {/* Exchange Rate */}
      {deal.exchange_rate && (
        <div className="rate-section">
          <span className="rate-label">Rate:</span>
          <span className="rate-value">
            1 {deal.have_currency} = {parseFloat(deal.exchange_rate).toFixed(4)} {deal.want_currency}
          </span>
          <span className="rate-source">({deal.rate_source || 'custom'})</span>
        </div>
      )}

      {/* Seller Info */}
      <div className="seller-info">
        <span className="seller-name">
          👤 {deal.user?.firstname || 'User'} {deal.user?.surname || ''}
        </span>
        <span className="deal-date">
          {new Date(deal.created_at).toLocaleDateString()}
        </span>
      </div>

      {/* Description */}
      {deal.description && (
        <div className="deal-description">
          {deal.description}
        </div>
      )}

      {/* Matches Found */}
      {deal.matches && deal.matches.length > 0 && (
        <div className="matches-section">
          <div className="matches-count">
            🔄 {deal.matches.length} potential match{deal.matches.length !== 1 ? 'es' : ''} found
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="deal-actions">
        {!isOwnDeal ? (
          <button className="contact-btn" onClick={onContact}>
            💬 Contact for Exchange
          </button>
        ) : (
          <div className="owner-actions">
            {deal.status === 'active' && (
              <>
                {deal.matches?.length > 0 && (
                  <button className="view-matches-btn">
                    🔄 View Matches ({deal.matches.length})
                  </button>
                )}
                <button className="complete-btn" onClick={onComplete}>
                  ✅ Mark as Completed
                </button>
              </>
            )}
            <button className="delete-btn" onClick={onDelete}>
              🗑️ Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Create Deal Modal Component
const CreateDealModal = ({ user, onClose, onCreate }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    
    // What I Have
    have_amount: '',
    have_currency: 'RUB',
    have_country: 'Russia',
    have_city: '',
    have_method: 'cash',
    have_details: '',
    
    // What I Want
    want_amount: '',
    want_currency: 'USD',
    want_country: 'Zimbabwe',
    want_city: '',
    want_method: 'ecocash',
    want_details: '',
    
    // Exchange Rate
    exchange_rate: '',
    rate_source: 'google',
    
    // Contact
    contact_method: 'whatsapp',
    contact_info: user?.email || '',
    
    // Description
    description: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Calculate want_amount if exchange_rate is provided
      let wantAmount = form.want_amount;
      if (form.exchange_rate && form.have_amount) {
        wantAmount = (parseFloat(form.have_amount) * parseFloat(form.exchange_rate)).toFixed(2);
      } else if (!form.want_amount) {
        alert('Please enter the amount you want to receive');
        setLoading(false);
        return;
      }
      
      const dealData = {
        title: form.title || `Exchange ${form.have_amount} ${form.have_currency} to ${wantAmount} ${form.want_currency}`,
        have_amount: parseFloat(form.have_amount),
        have_currency: form.have_currency,
        have_country: form.have_country,
        have_city: form.have_city,
        have_method: form.have_method,
        have_details: form.have_details,
        want_amount: parseFloat(wantAmount),
        want_currency: form.want_currency,
        want_country: form.want_country,
        want_city: form.want_city,
        want_method: form.want_method,
        want_details: form.want_details,
        exchange_rate: form.exchange_rate ? parseFloat(form.exchange_rate) : null,
        rate_source: form.rate_source,
        contact_method: form.contact_method,
        contact_info: form.contact_info,
        description: form.description,
      };
      
      await onCreate(dealData);
      onClose();
    } catch (error) {
      alert('Failed to create deal. Please try again.');
      console.error('Create deal error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHaveAmountChange = (value) => {
    setForm(prev => {
      const newForm = { ...prev, have_amount: value };
      // Auto-calculate want amount if rate is set
      if (prev.exchange_rate && value) {
        newForm.want_amount = (parseFloat(value) * parseFloat(prev.exchange_rate)).toFixed(2);
      }
      return newForm;
    });
  };

  const handleExchangeRateChange = (value) => {
    setForm(prev => {
      const newForm = { ...prev, exchange_rate: value };
      // Auto-calculate want amount if have amount is set
      if (prev.have_amount && value) {
        newForm.want_amount = (parseFloat(prev.have_amount) * parseFloat(value)).toFixed(2);
      }
      return newForm;
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Create Exchange Deal</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div className="form-group">
            <label>Deal Title*</label>
            <input
              type="text"
              placeholder="e.g., RUB to USD via Ecocash"
              value={form.title}
              onChange={(e) => setForm({...form, title: e.target.value})}
              required
            />
          </div>
          
          {/* Two Column Layout */}
          <div className="form-columns">
            {/* LEFT: What I Have */}
            <div className="form-column">
              <h3>💰 What I Have</h3>
              
              <div className="form-group">
                <label>Amount I Have*</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="1000"
                  value={form.have_amount}
                  onChange={(e) => handleHaveAmountChange(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Currency*</label>
                <select value={form.have_currency} onChange={(e) => setForm({...form, have_currency: e.target.value})}>
                  <option value="RUB">🇷🇺 Russian Ruble (RUB)</option>
                  <option value="USD">🇺🇸 US Dollar (USD)</option>
                  <option value="EUR">🇪🇺 Euro (EUR)</option>
                  <option value="ZWL">🇿🇼 Zimbabwe Dollar (ZWL)</option>
                  <option value="ZAR">🇿🇦 South African Rand (ZAR)</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Country*</label>
                <input
                  type="text"
                  placeholder="e.g., Russia"
                  value={form.have_country}
                  onChange={(e) => setForm({...form, have_country: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>City</label>
                <input
                  type="text"
                  placeholder="e.g., Moscow"
                  value={form.have_city}
                  onChange={(e) => setForm({...form, have_city: e.target.value})}
                />
              </div>
              
              <div className="form-group">
                <label>Payment Method*</label>
                <select value={form.have_method} onChange={(e) => setForm({...form, have_method: e.target.value})}>
                  <option value="cash">💵 Cash</option>
                  <option value="sberbank">🏦 Sberbank</option>
                  <option value="tinkoff">🏛️ Tinkoff</option>
                  <option value="alfa-bank">🏢 Alfa-Bank</option>
                  <option value="paypal">🔵 PayPal</option>
                  <option value="wise">🟢 Wise</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Details (optional)</label>
                <textarea
                  placeholder="Account number, meeting place, etc."
                  value={form.have_details}
                  onChange={(e) => setForm({...form, have_details: e.target.value})}
                  rows="3"
                />
              </div>
            </div>
            
            {/* RIGHT: What I Want */}
            <div className="form-column">
              <h3>🎯 What I Want</h3>
              
              <div className="form-group">
                <label>Amount I Want*</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount to receive"
                  value={form.want_amount}
                  onChange={(e) => setForm({...form, want_amount: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Currency*</label>
                <select value={form.want_currency} onChange={(e) => setForm({...form, want_currency: e.target.value})}>
                  <option value="USD">🇺🇸 US Dollar (USD)</option>
                  <option value="ZWL">🇿🇼 Zimbabwe Dollar (ZWL)</option>
                  <option value="ZAR">🇿🇦 South African Rand (ZAR)</option>
                  <option value="RUB">🇷🇺 Russian Ruble (RUB)</option>
                  <option value="EUR">🇪🇺 Euro (EUR)</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Country*</label>
                <input
                  type="text"
                  placeholder="e.g., Zimbabwe"
                  value={form.want_country}
                  onChange={(e) => setForm({...form, want_country: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>City</label>
                <input
                  type="text"
                  placeholder="e.g., Harare"
                  value={form.want_city}
                  onChange={(e) => setForm({...form, want_city: e.target.value})}
                />
              </div>
              
              <div className="form-group">
                <label>Receive Method*</label>
                <select value={form.want_method} onChange={(e) => setForm({...form, want_method: e.target.value})}>
                  <option value="ecocash">📱 Ecocash</option>
                  <option value="inbucks">💰 Inbucks</option>
                  <option value="one money">💸 One Money</option>
                  <option value="bank transfer">🏦 Bank Transfer</option>
                  <option value="cash">💵 Cash</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Receive Details*</label>
                <textarea
                  placeholder="Ecocash number, bank account, etc."
                  value={form.want_details}
                  onChange={(e) => setForm({...form, want_details: e.target.value})}
                  required
                  rows="3"
                />
              </div>
            </div>
          </div>
          
          {/* Exchange Rate */}
          <div className="form-group">
            <label>Exchange Rate (optional)</label>
            <div className="rate-input-group">
              <span className="rate-label">1 {form.have_currency} =</span>
              <input
                type="number"
                step="0.0001"
                placeholder="Rate"
                value={form.exchange_rate}
                onChange={(e) => handleExchangeRateChange(e.target.value)}
                className="rate-input"
              />
              <span className="rate-label">{form.want_currency}</span>
              <select 
                value={form.rate_source} 
                onChange={(e) => setForm({...form, rate_source: e.target.value})}
                className="rate-source"
              >
                <option value="google">Google Rate</option>
                <option value="custom">Custom Rate</option>
                <option value="xe">XE.com</option>
              </select>
            </div>
            <small className="form-hint">
              If you enter a rate, the "Amount I Want" will be calculated automatically
            </small>
          </div>
          
          {/* Description */}
          <div className="form-group">
            <label>Description (optional)</label>
            <textarea
              placeholder="Any additional information about the deal..."
              value={form.description}
              onChange={(e) => setForm({...form, description: e.target.value})}
              rows="3"
            />
          </div>
          
          {/* Contact Info */}
          <div className="form-group">
            <label>Contact Method*</label>
            <select value={form.contact_method} onChange={(e) => setForm({...form, contact_method: e.target.value})}>
              <option value="whatsapp">WhatsApp</option>
              <option value="telegram">Telegram</option>
              <option value="email">Email</option>
              <option value="phone">Phone Call</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Contact Information*</label>
            <input
              type="text"
              placeholder="Phone number or email"
              value={form.contact_info}
              onChange={(e) => setForm({...form, contact_info: e.target.value})}
              required
            />
            <small className="form-hint">
              Buyers will contact you using this information
            </small>
          </div>
          
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Exchange Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MoneyDeals;