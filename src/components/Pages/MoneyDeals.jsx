import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    checkUser();
    fetchDeals();
  }, [filters]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user || null);
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
        query = query.gte('have_amount', filters.minAmount);
      }
      if (filters.maxAmount) {
        query = query.lte('have_amount', filters.maxAmount);
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
    } finally {
      setLoading(false);
    }
  };

  const findMatches = async (deal) => {
    // Find complementary deals: someone who has what this deal wants, and wants what this deal has
    const { data, error } = await supabase
      .from('money_deals')
      .select('*')
      .eq('status', 'active')
      .eq('have_currency', deal.want_currency)
      .eq('want_currency', deal.have_currency)
      .eq('have_country', deal.want_country)
      .eq('want_country', deal.have_country)
      .neq('user_id', deal.user_id) // Not the same user
      .limit(5);

    if (error) return [];
    return data || [];
  };

  const formatAmount = (amount, currency) => {
    const symbols = {
      'RUB': '₽', 'USD': '$', 'ZWL': 'Z$', 'ZAR': 'R',
      'EUR': '€', 'GBP': '£'
    };
    return `${symbols[currency] || currency} ${parseFloat(amount).toLocaleString()}`;
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
    return icons[method.toLowerCase()] || '💳';
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
    return flags[country.toLowerCase()] || '🌍';
  };

  if (loading) {
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
            <select value={filters.haveCurrency} onChange={(e) => setFilters({...filters, haveCurrency: e.target.value})}>
              <option value="">Any Currency</option>
              <option value="RUB">🇷🇺 Russian Ruble (RUB)</option>
              <option value="USD">🇺🇸 US Dollar (USD)</option>
              <option value="ZWL">🇿🇼 Zimbabwe Dollar (ZWL)</option>
              <option value="ZAR">🇿🇦 South African Rand (ZAR)</option>
            </select>
          </div>

          <div className="filter-group">
            <label>I Want Currency</label>
            <select value={filters.wantCurrency} onChange={(e) => setFilters({...filters, wantCurrency: e.target.value})}>
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
              onChange={(e) => setFilters({...filters, haveCountry: e.target.value})}
            />
          </div>

          <div className="filter-group">
            <label>To Country</label>
            <input
              type="text"
              placeholder="e.g., Zimbabwe"
              value={filters.wantCountry}
              onChange={(e) => setFilters({...filters, wantCountry: e.target.value})}
            />
          </div>
        </div>
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
const DealCard = ({ deal, currentUser, onContact }) => {
  const isOwnDeal = deal.user_id === currentUser?.id;

  return (
    <div className="deal-card">
      {/* Deal Header */}
      <div className="deal-header">
        <h3>{deal.title}</h3>
        <div className="deal-status">
          {deal.status === 'active' && <span className="status-active">Active</span>}
          {deal.status === 'matched' && <span className="status-matched">Matched</span>}
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
            1 {deal.have_currency} = {deal.exchange_rate} {deal.want_currency}
          </span>
          <span className="rate-source">({deal.rate_source})</span>
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

      {/* Matches Found */}
      {deal.matches && deal.matches.length > 0 && (
        <div className="matches-section">
          <div className="matches-count">
            🔄 {deal.matches.length} potential match{deal.matches.length !== 1 ? 'es' : ''} found
          </div>
          {deal.matches.slice(0, 2).map(match => (
            <div key={match.id} className="match-preview">
              <span>{match.user?.firstname || 'User'}</span>
              <span>{formatAmount(match.have_amount, match.have_currency)}</span>
              <span>via {match.have_method}</span>
            </div>
          ))}
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
            <button className="view-matches-btn">
              🔄 View Matches ({deal.matches?.length || 0})
            </button>
            <button className="complete-btn">
              ✅ Mark as Completed
            </button>
            <button className="delete-btn">
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
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Calculate want_amount if exchange_rate is provided
    let wantAmount = form.want_amount;
    if (form.exchange_rate && form.have_amount) {
      wantAmount = (parseFloat(form.have_amount) * parseFloat(form.exchange_rate)).toFixed(2);
    }
    
    const dealData = {
      ...form,
      have_amount: parseFloat(form.have_amount),
      want_amount: parseFloat(wantAmount),
      exchange_rate: form.exchange_rate ? parseFloat(form.exchange_rate) : null,
    };
    
    // Call API to create deal
    const { data, error } = await supabase
      .from('money_deals')
      .insert([{
        ...dealData,
        user_id: user.id,
        status: 'active'
      }]);
    
    if (!error) {
      onCreate();
      onClose();
    }
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
                <label>Amount*</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="1000"
                  value={form.have_amount}
                  onChange={(e) => setForm({...form, have_amount: e.target.value})}
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
                </select>
              </div>
              
              <div className="form-group">
                <label>Details (optional)</label>
                <textarea
                  placeholder="Account number, meeting place, etc."
                  value={form.have_details}
                  onChange={(e) => setForm({...form, have_details: e.target.value})}
                />
              </div>
            </div>
            
            {/* RIGHT: What I Want */}
            <div className="form-column">
              <h3>🎯 What I Want</h3>
              
              <div className="form-group">
                <label>Amount*</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount you want to receive"
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
                onChange={(e) => setForm({...form, exchange_rate: e.target.value})}
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
          </div>
          
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create Exchange Deal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MoneyDeals;