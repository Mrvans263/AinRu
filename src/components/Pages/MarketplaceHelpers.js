// MarketplaceHelpers.js
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

// Handle contact seller based on their preferred method
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

// Get contact button text based on method
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

// Fetch user details (without avatar_url)
// MarketplaceHelpers.js - Corrected fetchUserDetails
export const fetchUserDetails = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('firstname, surname, email, phone')
      .eq('id', userId)
      .maybeSingle();
    
    if (error) {
      console.error('Query error:', error.message);
      return { firstname: 'User', surname: '', email: '', phone: '' };
    }
    
    // THIS IS THE FIX: Return data even if it exists
    if (data) {
      console.log('Found user:', data.firstname, data.surname);
      return data;
    }
    
    // Only return fallback if truly no data
    console.log(`User ${userId} not found`);
    return { firstname: 'User', surname: '', email: '', phone: '' };
    
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