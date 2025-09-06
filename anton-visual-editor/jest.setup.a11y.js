const { toHaveNoViolations } = require('jest-axe');
require('@testing-library/jest-dom');

// Extend Jest matchers with axe matchers
expect.extend(toHaveNoViolations);

// Mock IntersectionObserver for components that use it
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Add custom matchers for accessibility testing
expect.extend({
  toBeAccessible(received) {
    // Check for basic accessibility attributes
    const hasRole = received.getAttribute && received.getAttribute('role');
    const hasAriaLabel = received.getAttribute && received.getAttribute('aria-label');
    const hasAriaLabelledBy = received.getAttribute && received.getAttribute('aria-labelledby');
    const hasTextContent = received.textContent && received.textContent.trim().length > 0;
    
    const isAccessible = hasRole || hasAriaLabel || hasAriaLabelledBy || hasTextContent;
    
    return {
      pass: isAccessible,
      message: () => 
        isAccessible 
          ? `Expected element not to be accessible`
          : `Expected element to have role, aria-label, aria-labelledby, or text content`
    };
  },
  
  toHaveMinimumClickArea(received, minSize = 44) {
    const rect = received.getBoundingClientRect && received.getBoundingClientRect();
    if (!rect) {
      return {
        pass: false,
        message: () => `Element does not have getBoundingClientRect method`
      };
    }
    
    const meetsMinimum = rect.width >= minSize && rect.height >= minSize;
    
    return {
      pass: meetsMinimum,
      message: () =>
        meetsMinimum
          ? `Expected element to have area smaller than ${minSize}x${minSize}px`
          : `Expected element to have minimum area of ${minSize}x${minSize}px, but got ${rect.width}x${rect.height}px`
    };
  }
});