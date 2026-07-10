export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

export function createFetchMock(handler) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init, calls);
  };
  fetch.calls = calls;
  return fetch;
}

export const samplePayload = {
  success: true,
  data: {
    items: [
      {
        id: 1,
        slug: 'alpha',
        title: 'Alpha Movie',
        year: 2026,
        region: 'JP',
        type: 'movie',
        description: 'First description',
        poster: '/poster/alpha.jpg'
      },
      {
        id: 2,
        slug: 'beta',
        title: 'Beta Show',
        year: 2025,
        region: 'US',
        type: 'tv',
        description: 'Second description'
      }
    ]
  }
};
