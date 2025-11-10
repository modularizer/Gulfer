/**
 * Runtime patch for asset paths on GitHub Pages
 * This patches the asset resolution to prepend the base path
 */

if (typeof window !== 'undefined') {
  // Get base path
  function getBasePath(): string {
    if (typeof document !== 'undefined') {
      const scripts = document.querySelectorAll('script[src]');
      for (const script of Array.from(scripts)) {
        const src = script.getAttribute('src');
        if (src && src.includes('/_expo/')) {
          const match = src.match(/^(\/[^\/]+\/)/);
          if (match) {
            return match[1];
          }
        }
      }
    }
    
    if (window.location.pathname !== '/') {
      const pathSegments = window.location.pathname.split('/').filter(Boolean);
      if (pathSegments.length > 0) {
        return `/${pathSegments[0]}/`;
      }
    }
    
    return '/';
  }

  const basePath = getBasePath();
  
  if (basePath !== '/') {
    // Patch XMLHttpRequest and fetch to intercept asset requests
    const originalFetch = window.fetch;
    window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      if (typeof input === 'string') {
        // If it's an absolute path starting with /assets/, prepend base path
        if (input.startsWith('/assets/') && !input.startsWith(basePath)) {
          input = basePath + input.substring(1);
        }
      } else if (input instanceof Request) {
        const url = input.url;
        if (url.startsWith('/assets/') && !url.startsWith(basePath)) {
          input = new Request(basePath + url.substring(1), input);
        }
      }
      return originalFetch.call(this, input, init);
    };

    // Also patch XMLHttpRequest for older code
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null
    ): void {
      if (typeof url === 'string' && url.startsWith('/assets/') && !url.startsWith(basePath)) {
        url = basePath + url.substring(1);
      }
      return originalOpen.call(this, method, url, async, username, password);
    };
  }
}

