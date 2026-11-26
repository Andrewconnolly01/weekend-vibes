// Weekend Vibes settings
// After registering the app in Azure (see README.md, step 3),
// paste your Application (client) ID between the quotes below.
window.WV_CONFIG = {
  clientId: '',

  // Used for the forecast when you turn off location access
  fallbackLocation: { name: 'Tauranga', lat: -37.6878, lon: 176.1651 },

  // Outlook calendar category that marks events as Weekend Vibes events
  calendarCategory: 'Weekend Vibes'
};
