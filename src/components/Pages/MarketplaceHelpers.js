// MarketplaceHelpers.js - CLEANED VERSION
import { supabase } from '../../lib/supabase';

// Format price with currency
export const formatPrice = (price, currency = 'RUB') => {
  const currencyConfigs = {
    'RUB': { locale: 'ru-RU', currency: 'RUB', symbol: '₽' },
    'USD': { locale: 'en-US', currency: 'USD', symbol: '$' },
    'ZAR': { locale: 'en-ZA', currency: 'ZAR', symbol: 'R' }
  };
  
  const config = currencyConfigs[currency] || currencyConfigs['RUB'];
  
  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(price);
  } catch (error) {
    return `${config.symbol} ${price.toFixed(2)}`;
  }
};

// Get currency flag
export const getCurrencyFlag = (currency) => {
  const flags = { 'RUB': '🇷🇺', 'USD': '🇺🇸', 'ZAR': '🇿🇦' };
  return flags[currency] || '🇷🇺';
};

// Format date
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  
  return date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
};

// Get condition class
export const getConditionClass = (condition) => {
  switch (condition) {
    case 'new': return 'condition-new';
    case 'like_new': return 'condition-like-new';
    case 'good': return 'condition-good';
    case 'fair': return 'condition-fair';
    case 'poor': return 'condition-poor';
    default: return 'condition-default';
  }
};

// Handle contact seller
export const handleContactSeller = (listing, currentUser) => {
  if (listing.user_id === currentUser?.id) {
    alert("This is your own listing!");
    return;
  }
  
  const contactMethod = listing.contact_method || 'email';
  const contactInfo = listing.contact_info || listing.user?.email || '';
  const sellerName = `${listing.user?.firstname || 'Seller'} ${listing.user?.surname || ''}`;
  
  switch (contactMethod) {
    case 'email':
      if (contactInfo) {
        window.location.href = `mailto:${contactInfo}?subject=Regarding your listing: ${listing.title}`;
      } else {
        alert(`${sellerName} has not provided an email address`);
      }
      break;
      
    case 'whatsapp':
      if (contactInfo) {
        const phone = contactInfo.replace(/\D/g, '');
        const message = encodeURIComponent(`Hi ${sellerName}, I'm interested in your listing: ${listing.title}`);
        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
      } else {
        alert(`${sellerName} has not provided a phone number for WhatsApp`);
      }
      break;
      
    case 'telegram':
      if (contactInfo) {
        const phone = contactInfo.replace(/\D/g, '');
        window.open(`https://t.me/+${phone}`, '_blank');
      } else {
        alert(`${sellerName} has not provided a phone number for Telegram`);
      }
      break;
      
    case 'phone':
      if (contactInfo) {
        const confirmCall = window.confirm(
          `Call ${sellerName}: ${contactInfo}\n\nWould you like to copy the number?`
        );
        if (confirmCall) {
          navigator.clipboard.writeText(contactInfo);
          alert('Phone number copied to clipboard!');
        }
      } else {
        alert(`${sellerName} has not provided a phone number`);
      }
      break;
      
    case 'in_app':
      alert('In-app messaging feature coming soon!');
      break;
      
    default:
      if (contactInfo) {
        alert(`Contact ${sellerName} at: ${contactInfo}`);
      } else {
        alert('No contact information available');
      }
  }
};

// Get contact button text
export const getContactButtonText = (contactMethod) => {
  const texts = {
    'email': '📧 Email Seller',
    'whatsapp': '💬 WhatsApp Seller', 
    'telegram': '📱 Telegram Seller',
    'phone': '📞 Call Seller',
    'in_app': '💬 Message Seller'
  };
  return texts[contactMethod] || '📧 Contact Seller';
};

// Fetch user details
export const fetchUserDetails = async (userId) => {
  if (!userId) {
    return { firstname: 'User', surname: '', email: '', phone: '' };
  }
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('firstname, surname, email, phone')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.warn('Error fetching user:', error.message);
      return { firstname: 'User', surname: '', email: '', phone: '' };
    }
    
    return data || { firstname: 'User', surname: '', email: '', phone: '' };
  } catch (error) {
    console.error('Error in fetchUserDetails:', error);
    return { firstname: 'User', surname: '', email: '', phone: '' };
  }
};

// Fetch listing images
export const fetchListingImages = async (listingId) => {
  try {
    const { data, error } = await supabase
      .from('listing_images')
      .select('*')
      .eq('listing_id', listingId)
      .order('is_primary', { ascending: false })
      .order('order_index');
    
    if (error) {
      console.warn('Error fetching images:', error.message);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error fetching images:', error);
    return [];
  }
};

// Get primary image URL
export const getPrimaryImageUrl = (images) => {
  if (!images || images.length === 0) return null;
  return images.find(img => img.is_primary)?.image_url || images[0].image_url;
};

// Fetch ALL marketplace data - FINAL WORKING VERSION
export const fetchMarketplaceData = async (filters = {}) => {
  try {
    // Show ALL listings (active and sold) but not deleted
    let query = supabase
      .from('marketplace_listings')
      .select('*')
      .in('status', ['active', 'sold']) // Show both active AND sold
      .order('created_at', { ascending: false }); // Newest first
    
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
    
    if (filters.negotiable !== '') {
      query = query.eq('price_negotiable', filters.negotiable === 'true');
    }
    
    // Apply sorting based on filter
    if (filters.sortBy === 'price_low') {
      query = query.order('price', { ascending: true });
    } else if (filters.sortBy === 'price_high') {
      query = query.order('price', { ascending: false });
    }
    // For 'newest' and 'views' we keep the default newest first
    
    const { data: listingsData, error } = await query;
    
    if (error) throw error;
    if (!listingsData || listingsData.length === 0) return [];
    
    // Get all unique user IDs
    const userIds = [...new Set(listingsData.map(listing => listing.user_id))];
    
    // Fetch all users
    const usersMap = {};
    if (userIds.length > 0) {
      const orConditions = userIds.map(id => `id.eq.${id}`).join(',');
      const { data: usersData } = await supabase
        .from('users')
        .select('id, firstname, surname, email, phone')
        .or(orConditions);
      
      (usersData || []).forEach(user => {
        usersMap[user.id] = {
          firstname: user.firstname || 'User',
          surname: user.surname || '',
          email: user.email || '',
          phone: user.phone || ''
        };
      });
    }
    
    // Fetch categories
    const { data: categoriesData } = await supabase
      .from('marketplace_categories')
      .select('*');
    
    const categoriesMap = {};
    (categoriesData || []).forEach(cat => {
      categoriesMap[cat.id] = cat;
    });
    
    // Combine everything
    const enrichedListings = await Promise.all(
      listingsData.map(async (listing) => {
        const { data: images } = await supabase
          .from('listing_images')
          .select('*')
          .eq('listing_id', listing.id)
          .order('is_primary', { ascending: false })
          .order('order_index');
        
        return {
          ...listing,
          user: usersMap[listing.user_id] || { 
            firstname: 'User', 
            surname: '', 
            email: '', 
            phone: '' 
          },
          category: categoriesMap[listing.category_id] || null,
          images: images || []
        };
      })
    );
    
    return enrichedListings;
    
  } catch (error) {
    console.error('Error in fetchMarketplaceData:', error);
    throw error;
  }
};