// jest.setup.js
import '@testing-library/jest-dom'; // Optional: extends Jest expect with DOM matchers.

// You can add other global setup here, e.g., mocking global objects or functions
// For example, if you use fetch and want to mock it globally for all tests:
// global.fetch = jest.fn(() =>
//   Promise.resolve({
//     json: () => Promise.resolve({}),
//   })
// );

// Mocking next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => '/', // Default pathname or mock as needed
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}));

// Mock a simple Supabase client if not already handled by more specific component mocks
// This is a very basic mock. Adjust as needed for your tests.
jest.mock('./src/lib/supabaseClient', () => {
  const mockSupabaseClient = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: {}, error: null }), // Default for .single()
    // Add other functions you use like .auth, .rpc, etc.
  };
  // Ensure that functions like 'select', 'insert' etc. return a Promise for their resolution
  mockSupabaseClient.select.mockResolvedValue({ data: [], error: null });
  mockSupabaseClient.insert.mockResolvedValue({ data: [{}], error: null });
  mockSupabaseClient.update.mockResolvedValue({ data: [{}], error: null });

  return {
    supabase: mockSupabaseClient,
  };
});
