// This is a more complete patch for the missing asset registry
// Based on the implementation in expo-asset

// Enhanced asset registry patch for expo-router

// Simple map to store assets
const assets = new Map();

// Create a proxy to handle any property access
const assetRegistry = new Proxy({
  // Core functions for asset registration
  registerAsset: (asset) => {
    if (!asset || typeof asset !== 'object') return null;
    
    // Generate a unique ID for the asset if not provided
    const id = asset.id || Math.floor(Math.random() * 1000000);
    const registeredAsset = { ...asset, id };
    
    // Store the asset with its ID
    assets.set(id, registeredAsset);
    
    return id;
  },
  
  getAssetByID: (assetId) => {
    return assets.get(assetId) || null;
  },
  
  unregisterAsset: (assetId) => {
    assets.delete(assetId);
  },
  
  // Helper functions that may be needed
  getAssetRegistry: () => assets,
  containsAsset: (assetId) => assets.has(assetId),
  getApacityName: () => '',    // These are dummy implementations
  getApacitySuffix: () => '',  // for functions that might be
  getScaleSuffix: () => '',    // called but aren't critical
}, {
  // Handle any missing property access gracefully
  get: (target, prop) => {
    if (prop in target) {
      return target[prop];
    }
    
    // Return a no-op function for any missing methods
    return () => null;
  }
});

module.exports = assetRegistry; 